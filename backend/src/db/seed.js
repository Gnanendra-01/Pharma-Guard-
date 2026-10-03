const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getDb, closeDb, DEFAULT_DB_PATH } = require('./database');

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(baseDate, days) {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + days);
  return result;
}

async function seed(options = {}) {
  const isReset = options.reset || process.argv.includes('--reset');

  if (isReset) {
    console.log('[Seed] Reset requested. Removing existing database file...');
    closeDb();
    if (fs.existsSync(DEFAULT_DB_PATH)) {
      try {
        fs.unlinkSync(DEFAULT_DB_PATH);
        console.log(`[Seed] Deleted database file: ${DEFAULT_DB_PATH}`);
      } catch (err) {
        console.warn(`[Seed] Could not unlink ${DEFAULT_DB_PATH}: ${err.message}. Clearing tables instead.`);
      }
    }
  }

  const db = getDb();

  console.log('[Seed] Seeding database with demo data...');

  // 1. Create demo user
  const demoEmail = 'demo@pharmaguard.com';
  const demoPassword = 'Demo@1234';
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  // Check if demo user already exists
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(demoEmail);

  if (!user) {
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    const info = insertUser.run('Demo Pharmacist', demoEmail, passwordHash);
    user = { id: info.lastInsertRowid, email: demoEmail, name: 'Demo Pharmacist' };
    console.log(`[Seed] Created demo user: ${demoEmail} (Password: ${demoPassword}) [ID: ${user.id}]`);
  } else {
    console.log(`[Seed] Demo user already exists: ${demoEmail} [ID: ${user.id}]`);
  }

  // 2. Default settings
  const existingSettings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(user.id);
  if (!existingSettings) {
    db.prepare(`
      INSERT INTO settings (user_id, alert_email, low_stock_threshold, expiry_warning_days, alert_repeat_days)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, demoEmail, 100, 30, 10);
    console.log(`[Seed] Initialized settings for user ID ${user.id}`);
  }

  // 3. Clear existing medicines for demo user if reset or re-seeding
  db.prepare('DELETE FROM medicines WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM alert_log WHERE user_id = ?').run(user.id);

  // 4. Sample medicines calculated relative to TODAY'S REAL DATE
  const today = new Date();
  console.log(`[Seed] Reference date for relative offsets: ${formatDate(today)}`);

  const sampleMedicines = [
    {
      name: 'Amoxicillin 500mg',
      batch_id: 'AMX-500-01',
      quantity: 500,
      expiry_date: formatDate(addDays(today, 300)),
      desc: 'Safe batch (expires in 300 days, high stock)'
    },
    {
      name: 'Cetirizine 10mg',
      batch_id: 'CTZ-010-25',
      quantity: 160,
      expiry_date: formatDate(addDays(today, 25)),
      desc: 'Expiring soon in 25 days (within 30-day warning)'
    },
    {
      name: 'Azithromycin 500mg',
      batch_id: 'AZM-500-05',
      quantity: 120,
      expiry_date: formatDate(addDays(today, 5)),
      desc: 'Expiring very soon in 5 days'
    },
    {
      name: 'Cough Relief Syrup 100ml',
      batch_id: 'CRS-100-EX',
      quantity: 45,
      expiry_date: formatDate(addDays(today, -3)),
      desc: 'Expired 3 days ago (must remove from shelf)'
    },
    {
      name: 'Metformin 500mg',
      batch_id: 'MET-500-90',
      quantity: 90,
      expiry_date: formatDate(addDays(today, 180)),
      desc: 'Low stock batch (90 units <= 100 threshold)'
    }
  ];

  const insertMed = db.prepare(`
    INSERT INTO medicines (user_id, store_id, name, batch_id, quantity, expiry_date, created_at, updated_at, last_expiry_alert_sent, low_stock_alert_sent)
    VALUES (?, 1, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL, 0)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO stock_history (medicine_id, old_quantity, new_quantity, change_reason, changed_at)
    VALUES (?, 0, ?, 'ADD', datetime('now'))
  `);

  const seedTransaction = db.transaction(() => {
    for (const med of sampleMedicines) {
      const res = insertMed.run(user.id, med.name, med.batch_id, med.quantity, med.expiry_date);
      insertHistory.run(res.lastInsertRowid, med.quantity);
      console.log(`  + Seeded [${med.batch_id}] ${med.name}: Qty ${med.quantity}, Exp: ${med.expiry_date} (${med.desc})`);
    }
  });

  seedTransaction();
  console.log('[Seed] Completed successfully! Ready for demo.');
}

if (require.main === module) {
  seed().catch(err => {
    console.error('[Seed] Error during seeding:', err);
    process.exit(1);
  });
}

module.exports = { seed };
