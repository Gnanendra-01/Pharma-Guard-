const { getDb } = require('../db/database');
const { sendEmail, generateDigestEmailHtml } = require('./emailService');

/**
 * Normalizes a Date or 'YYYY-MM-DD' string to UTC midnight timestamp for exact day arithmetic.
 * Does NOT call new Date() internally when dateInput is provided.
 */
function toMidnightUtc(dateInput) {
  if (typeof dateInput === 'string') {
    const [y, m, d] = dateInput.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  return Date.UTC(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
}

/**
 * Calculates whole days difference between targetDate and baseDate.
 * Returns (targetDate - baseDate) in whole days.
 */
function diffInDays(targetDate, baseDate) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((toMidnightUtc(targetDate) - toMidnightUtc(baseDate)) / MS_PER_DAY);
}

/**
 * Formats date object to YYYY-MM-DD without timezone shifts.
 */
function formatYmd(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Runs the alert check for a specific user.
 * PURE & TESTABLE: accepts `today` parameter (defaults to new Date()) and optional `db` instance.
 * Notice: Do NOT call `new Date()` anywhere else in this file.
 * 
 * Rules:
 * Low stock:
 * - If quantity <= low_stock_threshold AND low_stock_alert_sent = 0: send email, log it, set flag = 1.
 * - If quantity > threshold: reset flag to 0.
 * Expiry:
 * - days_left = expiry_date minus today (whole days).
 * - If 0 <= days_left <= expiry_warning_days: send alert if last_expiry_alert_sent is NULL OR (today - last_expiry_alert_sent) >= alert_repeat_days.
 * - If days_left < 0: send "EXPIRED, remove from shelf" alert using same repeat rule.
 * Batching:
 * - Multiple medicines batched into ONE digest email per type per run.
 * 
 * @param {number} userId 
 * @param {Date} [today]
 * @param {import('better-sqlite3').Database} [customDb]
 * @returns {Promise<{ success: boolean, lowStockCount: number, expiringCount: number, expiredCount: number, digestsSent: number }>}
 */
async function runAlertCheck(userId, today = new Date(), customDb = null) {
  const db = customDb || getDb();
  const todayStr = formatYmd(today);

  // 1. Fetch user settings
  const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  if (!settings) {
    console.warn(`[AlertEngine] No settings found for user ${userId}. Skipping alert check.`);
    return { success: false, reason: 'Settings not found', lowStockCount: 0, expiringCount: 0, expiredCount: 0, digestsSent: 0 };
  }

  const {
    alert_email,
    low_stock_threshold = 100,
    expiry_warning_days = 30,
    alert_repeat_days = 10
  } = settings;

  // 2. Fetch all medicines for this user
  const medicines = db.prepare('SELECT * FROM medicines WHERE user_id = ?').all(userId);

  // Collections for batch digest emails
  const lowStockToAlert = [];
  const expiringToAlert = [];
  const expiredToAlert = [];

  // Reset low_stock_alert_sent for medicines that were restocked above threshold
  const resetLowStockStmt = db.prepare(`
    UPDATE medicines
    SET low_stock_alert_sent = 0, updated_at = ?
    WHERE id = ?
  `);

  for (const med of medicines) {
    // Low stock evaluation
    if (med.quantity > low_stock_threshold) {
      if (med.low_stock_alert_sent === 1) {
        resetLowStockStmt.run(todayStr, med.id);
        med.low_stock_alert_sent = 0;
      }
    } else {
      // med.quantity <= low_stock_threshold
      if (med.low_stock_alert_sent === 0) {
        lowStockToAlert.push(med);
      }
    }

    // Expiry evaluation
    const daysLeft = diffInDays(med.expiry_date, today);
    med.days_left = daysLeft;

    let isRepeatDue = false;
    if (!med.last_expiry_alert_sent) {
      isRepeatDue = true;
    } else {
      const daysSinceLastAlert = diffInDays(today, med.last_expiry_alert_sent);
      if (daysSinceLastAlert >= alert_repeat_days) {
        isRepeatDue = true;
      }
    }

    if (daysLeft < 0) {
      // Already expired
      if (isRepeatDue) {
        expiredToAlert.push(med);
      }
    } else if (daysLeft <= expiry_warning_days) {
      // Expiring soon (0 <= daysLeft <= expiry_warning_days)
      if (isRepeatDue) {
        expiringToAlert.push(med);
      }
    }
  }

  let digestsSent = 0;

  // Helper statement for logging alerts
  const logAlertStmt = db.prepare(`
    INSERT INTO alert_log (user_id, medicine_id, type, channel, status, message, sent_at)
    VALUES (?, ?, ?, 'EMAIL', ?, ?, ?)
  `);

  const setLowStockFlagStmt = db.prepare(`
    UPDATE medicines
    SET low_stock_alert_sent = 1, updated_at = ?
    WHERE id = ?
  `);

  const setLastExpiryAlertStmt = db.prepare(`
    UPDATE medicines
    SET last_expiry_alert_sent = ?, updated_at = ?
    WHERE id = ?
  `);

  // --- Digest 1: LOW STOCK ALERTS ---
  if (lowStockToAlert.length > 0) {
    const subject = `[PharmaGuard Alert] Low Stock Warning (${lowStockToAlert.length} medicine${lowStockToAlert.length > 1 ? 's' : ''})`;
    const description = `The following medicine batches have reached or fallen below your threshold of ${low_stock_threshold} units. Please reorder promptly.`;
    const html = generateDigestEmailHtml({
      title: 'Low Stock Alert',
      description,
      items: lowStockToAlert,
      type: 'LOW_STOCK'
    });

    let sendSuccess = false;
    try {
      const result = await sendEmail({
        to: alert_email,
        subject,
        html,
        text: `${subject}\n\n${description}\n\n` + lowStockToAlert.map(m => `- ${m.name} (${m.batch_id}): Qty ${m.quantity}`).join('\n')
      });
      sendSuccess = result.success;
      if (sendSuccess) digestsSent++;
    } catch (err) {
      console.error('[AlertEngine] Error sending low stock email:', err.message);
      sendSuccess = false;
    }

    const status = sendSuccess ? 'SENT' : 'FAILED';
    for (const med of lowStockToAlert) {
      const msg = `Low stock: ${med.name} (Batch: ${med.batch_id}) has quantity ${med.quantity} <= threshold ${low_stock_threshold}`;
      logAlertStmt.run(userId, med.id, 'LOW_STOCK', status, msg, todayStr);
      if (sendSuccess) {
        setLowStockFlagStmt.run(todayStr, med.id);
      }
    }
  }

  // --- Digest 2: EXPIRING SOON ALERTS ---
  if (expiringToAlert.length > 0) {
    const subject = `[PharmaGuard Alert] Expiry Warning (${expiringToAlert.length} medicine${expiringToAlert.length > 1 ? 's' : ''})`;
    const description = `The following medicine batches will expire within your warning window of ${expiry_warning_days} days. Review your stock and plan dispensations.`;
    const html = generateDigestEmailHtml({
      title: 'Expiring Soon Warning',
      description,
      items: expiringToAlert,
      type: 'EXPIRY'
    });

    let sendSuccess = false;
    try {
      const result = await sendEmail({
        to: alert_email,
        subject,
        html,
        text: `${subject}\n\n${description}\n\n` + expiringToAlert.map(m => `- ${m.name} (${m.batch_id}): Expires on ${m.expiry_date} (${m.days_left} days left)`).join('\n')
      });
      sendSuccess = result.success;
      if (sendSuccess) digestsSent++;
    } catch (err) {
      console.error('[AlertEngine] Error sending expiry email:', err.message);
      sendSuccess = false;
    }

    const status = sendSuccess ? 'SENT' : 'FAILED';
    for (const med of expiringToAlert) {
      const msg = `Expiring soon: ${med.name} (Batch: ${med.batch_id}) expires in ${med.days_left} days on ${med.expiry_date}`;
      logAlertStmt.run(userId, med.id, 'EXPIRY', status, msg, todayStr);
      if (sendSuccess) {
        setLastExpiryAlertStmt.run(todayStr, todayStr, med.id);
      }
    }
  }

  // --- Digest 3: EXPIRED ALERTS ---
  if (expiredToAlert.length > 0) {
    const subject = `[PharmaGuard CRITICAL] Expired Medicines (${expiredToAlert.length} batch${expiredToAlert.length > 1 ? 'es' : ''})`;
    const description = `URGENT: The following medicine batches have EXPIRED! Remove them from the dispensing shelf immediately to prevent patient harm and compliance violations.`;
    const html = generateDigestEmailHtml({
      title: 'CRITICAL: Expired Medicines on Shelf',
      description,
      items: expiredToAlert,
      type: 'EXPIRED'
    });

    let sendSuccess = false;
    try {
      const result = await sendEmail({
        to: alert_email,
        subject,
        html,
        text: `${subject}\n\n${description}\n\n` + expiredToAlert.map(m => `- ${m.name} (${m.batch_id}): Expired on ${m.expiry_date} (${Math.abs(m.days_left)} days overdue)`).join('\n')
      });
      sendSuccess = result.success;
      if (sendSuccess) digestsSent++;
    } catch (err) {
      console.error('[AlertEngine] Error sending expired email:', err.message);
      sendSuccess = false;
    }

    const status = sendSuccess ? 'SENT' : 'FAILED';
    for (const med of expiredToAlert) {
      const msg = `EXPIRED: ${med.name} (Batch: ${med.batch_id}) expired ${Math.abs(med.days_left)} days ago on ${med.expiry_date}. Remove from shelf!`;
      logAlertStmt.run(userId, med.id, 'EXPIRED', status, msg, todayStr);
      if (sendSuccess) {
        setLastExpiryAlertStmt.run(todayStr, todayStr, med.id);
      }
    }
  }

  return {
    success: true,
    lowStockCount: lowStockToAlert.length,
    expiringCount: expiringToAlert.length,
    expiredCount: expiredToAlert.length,
    digestsSent
  };
}

module.exports = {
  runAlertCheck,
  diffInDays,
  toMidnightUtc,
  formatYmd
};
