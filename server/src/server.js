import config from './config/env.js';
import logger from './utils/logger.js';
import { connectDatabase, disconnectDatabase, isDatabaseReady } from './config/db.js';
import { prepareApp } from './app.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';
import { ensureDemoData } from './services/seedDemo.js';

async function main() {
  await connectDatabase();

  if (config.seedDemo) {
    try {
      await ensureDemoData();
    } catch (err) {
      logger.warn('Demo seeding skipped:', err.message);
    }
  }

  const app = await prepareApp();

  const server = app.listen(config.port, () => {
    logger.info(`MediTrack API listening on http://localhost:${config.port}`);
    logger.info(`Health check: http://localhost:${config.port}/api/v1/health`);
    logger.info(`CORS origin: ${config.clientOrigin}`);
    if (config.seedDemo && isDatabaseReady()) {
      logger.info('Demo login: demo@meditrack.test / Password123');
    }
  });

  startScheduler();

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully...`);
    stopScheduler();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
  });
}

main().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
