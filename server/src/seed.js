/**
 * Seed the demo workspace into the database pointed at by MONGODB_URI
 * (or the embedded development database).
 *
 *   npm run seed
 *
 * WARNING: this rebuilds the demo account and its family. Never run it against a
 * database that holds real records.
 */
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { seedDemoData, DEMO_EMAIL, DEMO_PASSWORD } from './services/seedDemo.js';
import logger from './utils/logger.js';

async function main() {
  await connectDatabase();

  const summary = await seedDemoData({ replace: true });

  logger.info('Seed complete.');
  logger.info(`  Login:     ${DEMO_EMAIL}`);
  logger.info(`  Password:  ${DEMO_PASSWORD}`);
  logger.info(`  Family:    ${summary.familyName} (${summary.profiles} profiles)`);
  logger.info(`  Medicines: ${summary.medicines}`);
  logger.info(`  Care plan: ${summary.carePlan}`);

  await disconnectDatabase();
}

main().catch(async (err) => {
  logger.error('Seed failed:', err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
