import { afterAll, afterEach, beforeAll } from 'vitest';
import mongoose from 'mongoose';

/**
 * Test database lifecycle.
 * A single embedded MongoDB is reused for the whole run (one fork), and every
 * test starts from empty collections. Tests never touch a real database.
 */
let mongo;

beforeAll(async () => {
  const { MongoMemoryServer } = await import('mongodb-memory-server');

  if (!globalThis.__MEDitrack_TEST_MONGO__) {
    mongo = await MongoMemoryServer.create({ instance: { dbName: 'meditrack_test' } });
    globalThis.__MEDitrack_TEST_MONGO__ = mongo;
  } else {
    mongo = globalThis.__MEDitrack_TEST_MONGO__;
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongo.getUri(), { dbName: 'meditrack_test' });
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  // Leave the process cleanly; vitest tears down the worker afterwards.
});
