// Uses Node.js built-in SQLite (available since Node 22.5, stable in Node 24+)
// Run node with --experimental-sqlite if on Node 22/23
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'meal-tracker.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    instructions TEXT NOT NULL,
    prep_time_minutes INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
    quantity TEXT,
    unit TEXT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_id INTEGER REFERENCES weeks(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    meal_type TEXT NOT NULL CHECK(meal_type IN ('lunch','dinner')),
    recipe_id INTEGER REFERENCES recipes(id),
    going_out INTEGER DEFAULT 0,
    prep_time_minutes INTEGER,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    notes TEXT,
    UNIQUE(week_id, day_of_week, meal_type)
  );

  CREATE TABLE IF NOT EXISTS meal_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
    ingredient_id INTEGER REFERENCES ingredients(id),
    custom_quantity TEXT,
    purchased INTEGER DEFAULT 0
  );
`);

// Helper wrappers to match better-sqlite3's synchronous API shape
// node:sqlite uses a slightly different API — we wrap it here so server.js is unchanged.
const prepare = (sql) => {
  const stmt = db.prepare(sql);
  return {
    run: (...params) => {
      const result = stmt.run(...params);
      return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
    },
    get: (...params) => stmt.get(...params) ?? null,
    all: (...params) => stmt.all(...params),
  };
};

// Minimal transaction helper
const transaction = (fn) => {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
};

module.exports = { prepare, transaction, exec: (sql) => db.exec(sql) };
