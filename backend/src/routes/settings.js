const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/settings
 * Returns settings for authenticated user
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    let settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);

    if (!settings) {
      // Create fallback settings if missing
      db.prepare(`
        INSERT INTO settings (user_id, alert_email, low_stock_threshold, expiry_warning_days, alert_repeat_days)
        VALUES (?, ?, 100, 30, 10)
      `).run(req.user.id, req.user.email);
      settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
    }

    return res.status(200).json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    return res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

/**
 * PUT /api/settings
 * Body: { alert_email, low_stock_threshold, expiry_warning_days, alert_repeat_days }
 */
router.put('/', (req, res) => {
  try {
    const { alert_email, low_stock_threshold, expiry_warning_days, alert_repeat_days } = req.body;
    const db = getDb();

    // Validation
    if (!alert_email || typeof alert_email !== 'string' || !alert_email.includes('@')) {
      return res.status(400).json({ error: 'A valid alert email address is required.' });
    }

    const threshold = parseInt(low_stock_threshold, 10);
    if (isNaN(threshold) || threshold < 1) {
      return res.status(400).json({ error: 'Low stock threshold must be a positive number.' });
    }

    const warningDays = parseInt(expiry_warning_days, 10);
    if (isNaN(warningDays) || warningDays < 1) {
      return res.status(400).json({ error: 'Expiry warning window must be at least 1 day.' });
    }

    const repeatDays = parseInt(alert_repeat_days, 10);
    if (isNaN(repeatDays) || repeatDays < 1 || repeatDays > 15) {
      return res.status(400).json({ error: 'Alert repeat interval must be between 1 and 15 days.' });
    }

    db.prepare(`
      INSERT INTO settings (user_id, alert_email, low_stock_threshold, expiry_warning_days, alert_repeat_days)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        alert_email = excluded.alert_email,
        low_stock_threshold = excluded.low_stock_threshold,
        expiry_warning_days = excluded.expiry_warning_days,
        alert_repeat_days = excluded.alert_repeat_days
    `).run(req.user.id, alert_email.trim().toLowerCase(), threshold, warningDays, repeatDays);

    const updated = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
    return res.status(200).json({
      message: 'Settings updated successfully.',
      settings: updated
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
});

module.exports = router;
