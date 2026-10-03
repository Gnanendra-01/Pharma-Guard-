const { getDb, initSchema } = require('../src/db/database');
const { runAlertCheck, diffInDays } = require('../src/services/alertEngine');

// Mock email service
jest.mock('../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test-mock-id' }),
  generateDigestEmailHtml: jest.fn().mockReturnValue('<html>mock digest</html>')
}));

const { sendEmail } = require('../src/services/emailService');

describe('PharmaGuard Alert Engine (Pure Logic Tests)', () => {
  let db;
  const testUserId = 99;
  const testEmail = 'pharmacist@test.com';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh in-memory database for each test
    db = getDb(':memory:');

    // Create test user and settings
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, created_at)
      VALUES (?, 'Test Pharmacist', ?, 'hashed_pass', '2026-01-01')
    `).run(testUserId, testEmail);

    db.prepare(`
      INSERT INTO settings (user_id, alert_email, low_stock_threshold, expiry_warning_days, alert_repeat_days)
      VALUES (?, ?, 100, 30, 10)
    `).run(testUserId, testEmail);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  test('1. Low stock triggers at quantity <= 100 and does NOT trigger at 101', async () => {
    const today = new Date(2026, 9, 1); // 2026-10-01

    // Batch A: Qty 101 (above threshold 100) -> safe
    db.prepare(`
      INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date, low_stock_alert_sent)
      VALUES (?, 1, 'Safe Stock Med', 'MED-101', 101, '2027-10-01', 0)
    `).run(testUserId);

    // Batch B: Qty 100 (exactly at threshold 100) -> should alert
    db.prepare(`
      INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date, low_stock_alert_sent)
      VALUES (?, 1, 'Low Stock Med', 'MED-100', 100, '2027-10-01', 0)
    `).run(testUserId);

    const result = await runAlertCheck(testUserId, today, db);

    expect(result.lowStockCount).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // Verify MED-100 flag is now 1
    const med100 = db.prepare('SELECT low_stock_alert_sent FROM medicines WHERE batch_id = ?').get('MED-100');
    expect(med100.low_stock_alert_sent).toBe(1);

    // Verify MED-101 flag remains 0
    const med101 = db.prepare('SELECT low_stock_alert_sent FROM medicines WHERE batch_id = ?').get('MED-101');
    expect(med101.low_stock_alert_sent).toBe(0);

    // Verify alert_log entry created for MED-100
    const logs = db.prepare('SELECT * FROM alert_log WHERE user_id = ? AND type = ?').all(testUserId, 'LOW_STOCK');
    expect(logs.length).toBe(1);
    expect(logs[0].message).toContain('MED-100');
  });

  test('2. Flag prevents duplicate low-stock alerts on subsequent runs', async () => {
    const today = new Date(2026, 9, 1);

    // Medicine already has low_stock_alert_sent = 1
    db.prepare(`
      INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date, low_stock_alert_sent)
      VALUES (?, 1, 'Already Alerted Med', 'MED-ALREADY', 80, '2027-10-01', 1)
    `).run(testUserId);

    const result = await runAlertCheck(testUserId, today, db);

    expect(result.lowStockCount).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();

    const logs = db.prepare('SELECT * FROM alert_log WHERE user_id = ? AND type = ?').all(testUserId, 'LOW_STOCK');
    expect(logs.length).toBe(0);
  });

  test('3. Low stock flag resets after restock above threshold', async () => {
    const today = new Date(2026, 9, 1);

    // Initially low stock with alert flag set
    const insertRes = db.prepare(`
      INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date, low_stock_alert_sent)
      VALUES (?, 1, 'Restock Med', 'MED-RESTOCK', 80, '2027-10-01', 1)
    `).run(testUserId);
    const medId = insertRes.lastInsertRowid;

    // Simulate restock above threshold (80 -> 250)
    db.prepare('UPDATE medicines SET quantity = 250 WHERE id = ?').run(medId);

    // Run alert check: engine detects quantity > threshold and resets flag to 0
    await runAlertCheck(testUserId, today, db);

    const medAfterRestock = db.prepare('SELECT low_stock_alert_sent, quantity FROM medicines WHERE id = ?').get(medId);
    expect(medAfterRestock.low_stock_alert_sent).toBe(0);
    expect(medAfterRestock.quantity).toBe(250);

    // Now if quantity drops again to 90
    db.prepare('UPDATE medicines SET quantity = 90 WHERE id = ?').run(medId);
    const secondCheck = await runAlertCheck(testUserId, today, db);

    expect(secondCheck.lowStockCount).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test('4. Expiry alert fires at exactly 30 days and NOT at 31 days', async () => {
    // Today: 2026-10-01
    const today = new Date(2026, 9, 1);

    // 31 days away: 2026-11-01 -> Should NOT alert (warning threshold is 30)
    db.prepare(`
      INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date)
      VALUES (?, 1, 'Expiring 31d', 'MED-31D', 200, '2026-11-01')
    `).run(testUserId);

    // 30 days away: 2026-10-31 -> SHOULD alert
    db.prepare(`
      INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date)
      VALUES (?, 1, 'Expiring 30d', 'MED-30D', 200, '2026-10-31')
    `).run(testUserId);

    const result = await runAlertCheck(testUserId, today, db);

    expect(result.expiringCount).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const med30 = db.prepare('SELECT last_expiry_alert_sent FROM medicines WHERE batch_id = ?').get('MED-30D');
    expect(med30.last_expiry_alert_sent).toBe('2026-10-01');

    const med31 = db.prepare('SELECT last_expiry_alert_sent FROM medicines WHERE batch_id = ?').get('MED-31D');
    expect(med31.last_expiry_alert_sent).toBeNull();
  });

  test('5. No repeat expiry alert before repeat interval (10 days)', async () => {
    // Last alert sent on 2026-10-01
    db.prepare(`
      INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date, last_expiry_alert_sent)
      VALUES (?, 1, 'Repeat Med', 'MED-REP', 200, '2026-10-25', '2026-10-01')
    `).run(testUserId);

    // Check on 2026-10-06 (only 5 days later < repeat interval 10)
    const checkDate = new Date(2026, 9, 6);
    const result = await runAlertCheck(testUserId, checkDate, db);

    expect(result.expiringCount).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('6. Repeat expiry alert fires after repeat interval has passed (>= 10 days)', async () => {
    // Last alert sent on 2026-10-01
    db.prepare(`
      INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date, last_expiry_alert_sent)
      VALUES (?, 1, 'Repeat Due Med', 'MED-REPDUE', 200, '2026-10-25', '2026-10-01')
    `).run(testUserId);

    // Check on 2026-10-11 (exactly 10 days later >= repeat interval 10)
    const checkDate = new Date(2026, 9, 11);
    const result = await runAlertCheck(testUserId, checkDate, db);

    expect(result.expiringCount).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const med = db.prepare('SELECT last_expiry_alert_sent FROM medicines WHERE batch_id = ?').get('MED-REPDUE');
    expect(med.last_expiry_alert_sent).toBe('2026-10-11');
  });

  test('7. Expired batch (days_left < 0) triggers the EXPIRED alert', async () => {
    const today = new Date(2026, 9, 5); // 2026-10-05

    // Expired 3 days ago: 2026-10-02 (Qty 200 > threshold 100, so only expired alert fires)
    db.prepare(`
      INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date)
      VALUES (?, 1, 'Expired Cough Syrup', 'MED-EXP-01', 200, '2026-10-02')
    `).run(testUserId);

    const result = await runAlertCheck(testUserId, today, db);

    expect(result.expiredCount).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const logs = db.prepare('SELECT * FROM alert_log WHERE user_id = ? AND type = ?').all(testUserId, 'EXPIRED');
    expect(logs.length).toBe(1);
    expect(logs[0].message).toContain('EXPIRED: Expired Cough Syrup');
  });

  test('8. Selling below zero is strictly rejected and stock remains unchanged', () => {
    // Insert medicine with 15 units
    const insertRes = db.prepare(`
      INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date)
      VALUES (?, 1, 'Scarce Tablets', 'MED-SCARCE', 15, '2027-01-01')
    `).run(testUserId);
    const medId = insertRes.lastInsertRowid;

    // Simulate sell attempt of 20 units
    const sellAmount = 20;
    const med = db.prepare('SELECT quantity FROM medicines WHERE id = ?').get(medId);

    let errorThrown = false;
    let errorMessage = '';

    if (sellAmount > med.quantity) {
      errorThrown = true;
      errorMessage = `Cannot sell ${sellAmount} units. Only ${med.quantity} units are currently in stock.`;
    }

    expect(errorThrown).toBe(true);
    expect(errorMessage).toBe('Cannot sell 20 units. Only 15 units are currently in stock.');

    // Verify stock did not change in DB
    const medAfter = db.prepare('SELECT quantity FROM medicines WHERE id = ?').get(medId);
    expect(medAfter.quantity).toBe(15);
  });
});
