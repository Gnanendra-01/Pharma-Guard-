const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { runAlertCheck } = require('../services/alertEngine');

const router = express.Router();

// All medicine routes require authentication
router.use(authenticateToken);

/**
 * GET /api/medicines
 * Query params:
 *   search: string (matches name or batch_id)
 *   sort: 'expiry' | 'name' | 'quantity' (default 'expiry')
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { search, sort = 'expiry' } = req.query;

    let query = 'SELECT * FROM medicines WHERE user_id = ?';
    const params = [req.user.id];

    if (search && search.trim()) {
      query += ' AND (name LIKE ? OR batch_id LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    if (sort === 'name') {
      query += ' ORDER BY name COLLATE NOCASE ASC';
    } else if (sort === 'quantity') {
      query += ' ORDER BY quantity ASC';
    } else {
      // Default: sort by expiry date earliest first
      query += ' ORDER BY expiry_date ASC';
    }

    const medicines = db.prepare(query).all(...params);
    return res.status(200).json(medicines);
  } catch (err) {
    console.error('Error fetching medicines:', err);
    return res.status(500).json({ error: 'Failed to fetch medicines.' });
  }
});

/**
 * POST /api/medicines
 * Body: { name, batch_id, quantity, expiry_date }
 */
router.post('/', async (req, res) => {
  try {
    const { name, batch_id, quantity, expiry_date } = req.body;
    const db = getDb();

    // Required fields check
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Medicine name is required.' });
    }
    if (!batch_id || typeof batch_id !== 'string' || !batch_id.trim()) {
      return res.status(400).json({ error: 'Batch ID is required.' });
    }
    const cleanBatchId = batch_id.trim();

    // Quantity validation: integer >= 0
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty < 0) {
      return res.status(400).json({ error: 'Quantity must be a positive whole number (0 or greater).' });
    }

    // Expiry date validation (YYYY-MM-DD)
    if (!expiry_date || !/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) {
      return res.status(400).json({ error: 'Expiry date must be in YYYY-MM-DD format.' });
    }

    // Check for duplicate batch_id for this user
    const existing = db.prepare('SELECT id FROM medicines WHERE user_id = ? AND batch_id = ?').get(req.user.id, cleanBatchId);
    if (existing) {
      return res.status(409).json({
        error: `Batch ID "${cleanBatchId}" already exists in your inventory. Please use a unique batch ID.`
      });
    }

    // Transaction: Insert medicine + initial stock history record
    const insertTx = db.transaction(() => {
      const insertMed = db.prepare(`
        INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date, created_at, updated_at, last_expiry_alert_sent, low_stock_alert_sent)
        VALUES (?, 1, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL, 0)
      `);
      const medRes = insertMed.run(req.user.id, name.trim(), cleanBatchId, parsedQty, expiry_date);
      const newMedId = medRes.lastInsertRowid;

      // Initial stock history
      const insertHistory = db.prepare(`
        INSERT INTO stock_history (medicine_id, old_quantity, new_quantity, change_reason, changed_at)
        VALUES (?, 0, ?, 'ADD', datetime('now'))
      `);
      insertHistory.run(newMedId, parsedQty);

      return db.prepare('SELECT * FROM medicines WHERE id = ?').get(newMedId);
    });

    const newMed = insertTx();

    // Re-check low stock immediately if initial quantity is at/below threshold
    const settings = db.prepare('SELECT low_stock_threshold FROM settings WHERE user_id = ?').get(req.user.id);
    const threshold = settings?.low_stock_threshold ?? 100;
    if (parsedQty <= threshold) {
      // Run alert engine asynchronously in background
      runAlertCheck(req.user.id, new Date()).catch(err => {
        console.error('Async alert check error after medicine add:', err);
      });
    }

    return res.status(201).json({
      message: 'Medicine batch added successfully.',
      medicine: newMed
    });
  } catch (err) {
    console.error('Error adding medicine:', err);
    return res.status(500).json({ error: 'Failed to add medicine. Please try again.' });
  }
});

/**
 * PUT /api/medicines/:id
 * Body: { name, expiry_date }
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, expiry_date } = req.body;
    const db = getDb();

    // Check ownership
    const medicine = db.prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!medicine) {
      return res.status(404).json({ error: 'Medicine batch not found.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Medicine name is required.' });
    }

    if (!expiry_date || !/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) {
      return res.status(400).json({ error: 'Expiry date must be in YYYY-MM-DD format.' });
    }

    db.prepare(`
      UPDATE medicines
      SET name = ?, expiry_date = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(name.trim(), expiry_date, id, req.user.id);

    const updated = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
    return res.status(200).json({
      message: 'Medicine details updated successfully.',
      medicine: updated
    });
  } catch (err) {
    console.error('Error updating medicine:', err);
    return res.status(500).json({ error: 'Failed to update medicine details.' });
  }
});

/**
 * PATCH /api/medicines/:id/quantity
 * UPDATE QUANTITY FEATURE
 * Body: { mode: 'sell' | 'restock' | 'set', amount: number }
 * 
 * Rules:
 * - 'sell' subtracts and must reject going below 0 with friendly message
 * - 'restock' adds
 * - 'set' overwrites
 * - Must perform in database transaction
 * - Writes a stock_history row
 * - Re-evaluates low stock flag:
 *     if new_quantity > threshold, reset low_stock_alert_sent to 0.
 *     if it dropped to <= threshold, run the low stock check for that medicine immediately.
 */
router.patch('/:id/quantity', async (req, res) => {
  try {
    const { id } = req.params;
    const { mode, amount } = req.body;
    const db = getDb();

    if (!['sell', 'restock', 'set'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid update mode. Must be "sell", "restock", or "set".' });
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ error: 'Amount must be a non-negative whole number.' });
    }

    if ((mode === 'sell' || mode === 'restock') && parsedAmount === 0) {
      return res.status(400).json({ error: 'Quantity change amount must be greater than 0.' });
    }

    // Check ownership
    const medicine = db.prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!medicine) {
      return res.status(404).json({ error: 'Medicine batch not found.' });
    }

    const oldQuantity = medicine.quantity;
    let newQuantity = oldQuantity;
    let changeReason = 'CORRECTION';

    if (mode === 'sell') {
      if (parsedAmount > oldQuantity) {
        return res.status(400).json({
          error: `Cannot sell ${parsedAmount} units. Only ${oldQuantity} units are currently in stock.`
        });
      }
      newQuantity = oldQuantity - parsedAmount;
      changeReason = 'SOLD';
    } else if (mode === 'restock') {
      newQuantity = oldQuantity + parsedAmount;
      changeReason = 'RESTOCK';
    } else if (mode === 'set') {
      newQuantity = parsedAmount;
      changeReason = 'CORRECTION';
    }

    // Fetch user settings for threshold comparison
    const settings = db.prepare('SELECT low_stock_threshold FROM settings WHERE user_id = ?').get(req.user.id);
    const threshold = settings?.low_stock_threshold ?? 100;

    // Database transaction: update quantity, write history, and adjust flag if > threshold
    const quantityTx = db.transaction(() => {
      let resetFlag = false;
      if (newQuantity > threshold && medicine.low_stock_alert_sent === 1) {
        resetFlag = true;
      }

      db.prepare(`
        UPDATE medicines
        SET quantity = ?,
            low_stock_alert_sent = CASE WHEN ? THEN 0 ELSE low_stock_alert_sent END,
            updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(newQuantity, resetFlag ? 1 : 0, id, req.user.id);

      db.prepare(`
        INSERT INTO stock_history (medicine_id, old_quantity, new_quantity, change_reason, changed_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(id, oldQuantity, newQuantity, changeReason);

      return db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
    });

    const updatedMedicine = quantityTx();

    // If stock dropped to <= threshold and alert has not been sent, run alert check immediately
    let alertSentImmediately = false;
    if (newQuantity <= threshold && updatedMedicine.low_stock_alert_sent === 0) {
      try {
        const checkResult = await runAlertCheck(req.user.id, new Date());
        if (checkResult.lowStockCount > 0) {
          alertSentImmediately = true;
        }
      } catch (alertErr) {
        console.error('Failed to trigger immediate low stock check:', alertErr);
      }
    }

    // Refetch the medicine to reflect updated low_stock_alert_sent flag
    const finalMedicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);

    return res.status(200).json({
      message: `Stock updated successfully (${changeReason}: ${oldQuantity} -> ${newQuantity}).`,
      medicine: finalMedicine,
      alertTriggered: alertSentImmediately
    });
  } catch (err) {
    console.error('Error updating medicine quantity:', err);
    return res.status(500).json({ error: 'Failed to update stock quantity.' });
  }
});

/**
 * DELETE /api/medicines/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const medicine = db.prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!medicine) {
      return res.status(404).json({ error: 'Medicine batch not found.' });
    }

    db.prepare('DELETE FROM medicines WHERE id = ? AND user_id = ?').run(id, req.user.id);

    return res.status(200).json({
      message: `Medicine batch "${medicine.name}" (${medicine.batch_id}) deleted successfully.`
    });
  } catch (err) {
    console.error('Error deleting medicine:', err);
    return res.status(500).json({ error: 'Failed to delete medicine batch.' });
  }
});

/**
 * GET /api/medicines/:id/history
 * Returns stock history for this medicine
 */
router.get('/:id/history', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const medicine = db.prepare('SELECT id, name, batch_id FROM medicines WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!medicine) {
      return res.status(404).json({ error: 'Medicine batch not found.' });
    }

    const history = db.prepare(`
      SELECT * FROM stock_history
      WHERE medicine_id = ?
      ORDER BY changed_at DESC, id DESC
    `).all(id);

    return res.status(200).json({
      medicine,
      history
    });
  } catch (err) {
    console.error('Error fetching stock history:', err);
    return res.status(500).json({ error: 'Failed to fetch stock history.' });
  }
});

module.exports = router;
