const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { runAlertCheck } = require('../services/alertEngine');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/alerts
 * Returns the alert log for the authenticated user, newest first.
 * Joins with medicines table to include medicine details if available.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const alerts = db.prepare(`
      SELECT 
        a.id,
        a.user_id,
        a.medicine_id,
        a.type,
        a.channel,
        a.status,
        a.message,
        a.sent_at,
        m.name AS medicine_name,
        m.batch_id AS medicine_batch_id
      FROM alert_log a
      LEFT JOIN medicines m ON a.medicine_id = m.id
      WHERE a.user_id = ?
      ORDER BY a.sent_at DESC, a.id DESC
      LIMIT 100
    `).all(req.user.id);

    return res.status(200).json(alerts);
  } catch (err) {
    console.error('Error fetching alert logs:', err);
    return res.status(500).json({ error: 'Failed to fetch alert logs.' });
  }
});

/**
 * POST /api/alerts/run-check
 * DEMO endpoint: runs the alert engine now for the logged-in user.
 * Accepts optional body: { demoDate: 'YYYY-MM-DD' } to simulate a different "today".
 */
router.post('/run-check', async (req, res) => {
  try {
    const { demoDate } = req.body;
    let targetDate = new Date();

    if (demoDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(demoDate)) {
        return res.status(400).json({ error: 'demoDate must be in YYYY-MM-DD format.' });
      }
      const [year, month, day] = demoDate.split('-').map(Number);
      targetDate = new Date(year, month - 1, day, 12, 0, 0); // local midday to prevent tz roll
    }

    console.log(`[Alerts Route] Running manual alert check for user ${req.user.id} with date: ${targetDate.toISOString().split('T')[0]}`);

    const result = await runAlertCheck(req.user.id, targetDate);

    // Fetch fresh alert log count
    const db = getDb();
    const totalLogs = db.prepare('SELECT COUNT(*) as count FROM alert_log WHERE user_id = ?').get(req.user.id);

    return res.status(200).json({
      message: 'Alert check executed successfully.',
      simulatedDate: targetDate.toISOString().split('T')[0],
      summary: result,
      totalLogsRecorded: totalLogs.count
    });
  } catch (err) {
    console.error('Error running manual alert check:', err);
    return res.status(500).json({ error: 'Failed to run alert check. Please try again.' });
  }
});

module.exports = router;
