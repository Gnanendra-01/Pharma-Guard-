const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { diffInDays, formatYmd } = require('../services/alertEngine');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/dashboard/summary
 * Returns counts: total, expiring soon, expired, low stock, plus items needing urgent attention
 */
router.get('/summary', (req, res) => {
  try {
    const db = getDb();
    const today = new Date();
    const todayStr = formatYmd(today);

    // Fetch user settings
    const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
    const lowStockThreshold = settings?.low_stock_threshold ?? 100;
    const expiryWarningDays = settings?.expiry_warning_days ?? 30;

    // Fetch all user medicines
    const medicines = db.prepare('SELECT * FROM medicines WHERE user_id = ? ORDER BY expiry_date ASC').all(req.user.id);

    let total = medicines.length;
    let expiredCount = 0;
    let expiringCount = 0;
    let lowStockCount = 0;

    const attentionItems = [];

    for (const med of medicines) {
      const daysLeft = diffInDays(med.expiry_date, today);
      const isExpired = daysLeft < 0;
      const isExpiring = !isExpired && daysLeft <= expiryWarningDays;
      const isLowStock = med.quantity <= lowStockThreshold;

      if (isExpired) expiredCount++;
      if (isExpiring) expiringCount++;
      if (isLowStock) lowStockCount++;

      if (isExpired || isExpiring || isLowStock) {
        let statusBadge = 'Safe';
        let severity = 'low';

        if (isExpired) {
          statusBadge = 'Expired';
          severity = 'danger';
        } else if (isExpiring) {
          statusBadge = `Expiring in ${daysLeft}d`;
          severity = 'warning';
        } else if (isLowStock) {
          statusBadge = 'Low Stock';
          severity = 'orange';
        }

        attentionItems.push({
          ...med,
          days_left: daysLeft,
          is_expired: isExpired,
          is_expiring: isExpiring,
          is_low_stock: isLowStock,
          statusBadge,
          severity
        });
      }
    }

    // Sort attention items: expired first, then lowest days left, then lowest quantity
    attentionItems.sort((a, b) => {
      if (a.is_expired && !b.is_expired) return -1;
      if (!a.is_expired && b.is_expired) return 1;
      return a.days_left - b.days_left;
    });

    return res.status(200).json({
      summary: {
        total,
        expiringSoon: expiringCount,
        expired: expiredCount,
        lowStock: lowStockCount,
        thresholds: {
          lowStockThreshold,
          expiryWarningDays
        }
      },
      attentionItems: attentionItems.slice(0, 8)
    });
  } catch (err) {
    console.error('Error fetching dashboard summary:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard summary.' });
  }
});

module.exports = router;
