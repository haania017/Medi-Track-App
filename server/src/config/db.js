import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import config from './env.js';
import logger from '../utils/logger.js';

let memoryServer = null;

/**
 * Connect to MongoDB. In development/test, when no MONGODB_URI is configured,
 * fall back to an in-memory MongoDB so the app boots with zero external services.
 */
export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  let uri = config.mongoUri;

  if (!uri) {
    if (config.isProd) {
      throw new Error('MONGODB_URI is required in production.');
    }
    // mongodb-memory-server is a dev dependency; import lazily so production
    // builds never require it.
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const instance = { dbName: config.mongoDbName };

    // Ephemeral by default (fast, resets on restart). Opt in to an on-disk
    // instance with DEV_PERSIST_DB=true, or point MONGODB_URI at a real MongoDB.
    if (config.devPersistDb && !config.isTest) {
      const dbPath = path.resolve(config.serverRoot, '.data/mongo');
      await fs.mkdir(dbPath, { recursive: true });
      instance.dbPath = dbPath;
    }

    memoryServer = await MongoMemoryServer.create({ instance });
    uri = memoryServer.getUri();
    logger.warn(
      config.isTest
        ? 'Using an ephemeral in-memory MongoDB for tests.'
        : 'No MONGODB_URI configured — using an embedded MongoDB. Data resets on restart; set MONGODB_URI (or DEV_PERSIST_DB=true) to keep it.',
    );
  }

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err.message);
  });

  await mongoose.connect(uri, {
    dbName: config.mongoDbName,
    serverSelectionTimeoutMS: 10000,
  });

  logger.info(`MongoDB connected (${maskUri(uri)})`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

/**
 * Run a callback inside a MongoDB transaction when the deployment supports it
 * (replica sets / Atlas). Falls back to a non-transactional path otherwise, so
 * the same idempotency guards must hold in the surrounding code either way.
 */
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    // Transactions are unsupported on standalone mongod; run without one.
    if (
      err &&
      (err.code === 20 ||
        err.codeName === 'IllegalOperation' ||
        /Transaction numbers are only allowed/i.test(err.message || ''))
    ) {
      logger.warn('Transactions unavailable on this deployment; running without a session.');
      return fn(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

function maskUri(uri) {
  return uri.replace(/\/\/([^@/]+)@/, '//***:***@');
}

export default connectDatabase;
