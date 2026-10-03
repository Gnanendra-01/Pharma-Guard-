const cron = require('node-cron');
const { getDb } = require('../db/database');
const { runAlertCheck } = require('./alertEngine');

let scheduledTask = null;

/**
 * Initializes the background alert scheduler using node-cron.
 * - Production: runs daily at 08:00 ('0 8 * * *')
 * - Demo mode (DEMO_MODE=true): runs every 1 minute ('* * * * *')
 */
function initScheduler() {
  const isDemo = process.env.DEMO_MODE === 'true';
  const cronExpression = isDemo ? '* * * * *' : '0 8 * * *';

  console.log(`[Scheduler] Initializing alert scheduler (${isDemo ? 'DEMO MODE: every 1 min' : 'PRODUCTION: daily at 08:00'}). Expression: "${cronExpression}"`);

  scheduledTask = cron.schedule(cronExpression, async () => {
    const timestamp = new Date().toISOString();
    console.log(`[Scheduler] [${timestamp}] Starting scheduled alert check run...`);

    try {
      const db = getDb();
      const users = db.prepare('SELECT id, email FROM users').all();

      for (const user of users) {
        console.log(`[Scheduler] Running alert check for user ${user.email} (ID: ${user.id})...`);
        const result = await runAlertCheck(user.id, new Date());
        console.log(`[Scheduler] User ${user.email} check completed: LowStock=${result.lowStockCount}, Expiring=${result.expiringCount}, Expired=${result.expiredCount}, DigestsSent=${result.digestsSent}`);
      }

      console.log(`[Scheduler] Completed scheduled run for ${users.length} user(s).`);
    } catch (err) {
      console.error('[Scheduler] Error during scheduled alert run:', err);
    }
  });

  return scheduledTask;
}

/**
 * Stops the scheduled cron task if running.
 */
function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Scheduler] Alert scheduler stopped.');
  }
}

module.exports = {
  initScheduler,
  stopScheduler
};
