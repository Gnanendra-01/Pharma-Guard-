const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DEFAULT_DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../pharmaguard.db');

let dbInstance = null;

/**
 * Initializes and creates the SQLite database tables if they do not exist.
 * Uses strict parameterized types and constraints as defined in the spec.
 * @param {import('better-sqlite3').Database} db 
 */
function initSchema(db) {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 2. Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id INTEGER UNIQUE NOT NULL,
      alert_email TEXT NOT NULL,
      low_stock_threshold INTEGER NOT NULL DEFAULT 100,
      expiry_warning_days INTEGER NOT NULL DEFAULT 30,
      alert_repeat_days INTEGER NOT NULL DEFAULT 10 CHECK(alert_repeat_days >= 1 AND alert_repeat_days <= 15),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. Medicines table
  db.exec(`
    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity >= 0),
      expiry_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_expiry_alert_sent TEXT NULL,
      low_stock_alert_sent INTEGER NOT NULL DEFAULT 0 CHECK(low_stock_alert_sent IN (0, 1)),
      UNIQUE(user_id, batch_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 4. Alert log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      medicine_id INTEGER NULL,
      type TEXT NOT NULL CHECK(type IN ('LOW_STOCK', 'EXPIRY', 'EXPIRED')),
      channel TEXT NOT NULL DEFAULT 'EMAIL',
      status TEXT NOT NULL CHECK(status IN ('SENT', 'FAILED')),
      message TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE SET NULL
    );
  `);

  // 5. Stock history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      old_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      change_reason TEXT NOT NULL CHECK(change_reason IN ('ADD', 'SOLD', 'RESTOCK', 'CORRECTION')),
      changed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    );
  `);

  // Create indexes for efficient querying
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_medicines_user_id ON medicines(user_id);
    CREATE INDEX IF NOT EXISTS idx_medicines_expiry_date ON medicines(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_alert_log_user_id ON alert_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_stock_history_medicine_id ON stock_history(medicine_id);
  `);
}

/**
 * Returns the singleton database instance, creating it if necessary.
 * @param {string} [customPath] - Path to db or ':memory:' for tests
 * @returns {import('better-sqlite3').Database}
 */
function getDb(customPath = null) {
  if (customPath) {
    const db = new Database(customPath);
    initSchema(db);
    return db;
  }

  if (!dbInstance) {
    dbInstance = new Database(DEFAULT_DB_PATH);
    initSchema(dbInstance);
  }
  return dbInstance;
}

/**
 * Closes the active database connection
 */
function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  getDb,
  initSchema,
  closeDb,
  DEFAULT_DB_PATH
};
