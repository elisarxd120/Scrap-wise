const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");

// Store SQLite data inside the project so it works across server restarts.
const db = new Database(path.join(__dirname, "..", "data.sqlite"));

db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Admin', 'Kitchen Staff', 'POS Staff')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'declined')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// User-management compatibility columns. Existing databases gain these safely.
const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((column) => column.name === "is_active")) {
  db.prepare(
    "ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
  ).run();
}
if (!userColumns.some((column) => column.name === "must_change_password")) {
  db.prepare(
    "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0",
  ).run();
}

// Compatibility fix if an earlier schema used a misspelled or missing constraint.
const seededAdmin = db
  .prepare("SELECT id FROM users WHERE username = ?")
  .get("admin001");
if (!seededAdmin) {
  db.prepare(
    `
    INSERT INTO users (full_name, username, password_hash, role, status)
    VALUES (?, ?, ?, ?, ?)
  `,
  ).run(
    "Administrator",
    "admin001",
    bcrypt.hashSync("admin", 10),
    "Admin",
    "approved",
  );
}

// SAMPLE DATA - remove this Kitchen account when live users are configured.
const seededKitchen = db
  .prepare("SELECT id FROM users WHERE username = ?")
  .get("kitchen001");
if (!seededKitchen) {
  db.prepare(
    `INSERT INTO users (full_name, username, password_hash, role, status, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    "Kitchen Staff",
    "kitchen001",
    bcrypt.hashSync("kitchen", 10),
    "Kitchen Staff",
    "approved",
    1,
  );
}

// Admin module tables. These are created automatically on server startup.
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    position TEXT NOT NULL,
    rate REAL NOT NULL CHECK(rate >= 0),
    rate_type TEXT NOT NULL CHECK(rate_type IN ('daily', 'hourly')),
    contact_number TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
    date_hired TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    attendance_date TEXT NOT NULL,
    time_in TEXT,
    time_out TEXT,
    status TEXT NOT NULL CHECK(status IN ('present', 'late', 'absent', 'leave')),
    hours_worked REAL NOT NULL DEFAULT 0,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    price REAL NOT NULL CHECK(price >= 0)
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    reorder_level REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('in', 'out')),
    quantity REAL NOT NULL CHECK(quantity > 0),
    movement_date TEXT NOT NULL,
    reason TEXT,
    recorded_by INTEGER,
    FOREIGN KEY(item_id) REFERENCES inventory_items(id),
    FOREIGN KEY(recorded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_code TEXT NOT NULL UNIQUE,
    transaction_date TEXT NOT NULL,
    cashier_id INTEGER,
    total REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('completed', 'voided')) DEFAULT 'completed',
    void_reason TEXT,
    voided_by INTEGER,
    voided_at TEXT,
    FOREIGN KEY(cashier_id) REFERENCES users(id),
    FOREIGN KEY(voided_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transaction_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    item_id INTEGER,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    subtotal REAL NOT NULL CHECK(subtotal >= 0),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES menu_items(id)
  );

  CREATE TABLE IF NOT EXISTS waste_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    weight REAL NOT NULL CHECK(weight >= 0),
    recorded_at TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'recorded',
    before_weight REAL,
    after_weight REAL,
    recorded_by INTEGER,
    FOREIGN KEY(recorded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS iot_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'offline',
    last_reading REAL,
    last_received_at TEXT,
    calibration_date TEXT
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    record_type TEXT NOT NULL,
    record_id TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payroll_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    cycle_start TEXT NOT NULL,
    cycle_end TEXT NOT NULL,
    days_worked REAL NOT NULL DEFAULT 0,
    hours_worked REAL NOT NULL DEFAULT 0,
    regular_pay REAL NOT NULL DEFAULT 0,
    gross_pay REAL NOT NULL DEFAULT 0,
    overtime_hours REAL NOT NULL DEFAULT 0,
    overtime_pay REAL NOT NULL DEFAULT 0,
    deductions_json TEXT NOT NULL DEFAULT '{}',
    adjustments REAL NOT NULL DEFAULT 0,
    net_pay REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('draft', 'approved')) DEFAULT 'draft',
    approved_by INTEGER,
    approved_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, cycle_start, cycle_end),
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(approved_by) REFERENCES users(id)
  );
`);

// Compatibility column for Kitchen movement timestamps.
const movementColumns = db.prepare("PRAGMA table_info(stock_movements)").all();
if (!movementColumns.some((column) => column.name === "created_at")) {
  // SQLite cannot add CURRENT_TIMESTAMP as a column default with ALTER TABLE.
  // Add the column first, then populate existing movements with a usable timestamp.
  db.prepare("ALTER TABLE stock_movements ADD COLUMN created_at TEXT").run();
  db.prepare(
    `UPDATE stock_movements
     SET created_at = CASE
       WHEN movement_date IS NOT NULL AND movement_date != ''
         THEN movement_date || 'T00:00:00.000Z'
       ELSE strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     END
     WHERE created_at IS NULL`,
  ).run();
}

// POS compatibility and held-order tables.
const menuColumns = db.prepare("PRAGMA table_info(menu_items)").all();
if (!menuColumns.some((column) => column.name === "is_available")) {
  db.prepare(
    "ALTER TABLE menu_items ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1",
  ).run();
}
db.exec(`
  CREATE TABLE IF NOT EXISTS pos_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code TEXT NOT NULL UNIQUE,
    order_date TEXT NOT NULL,
    cashier_id INTEGER NOT NULL,
    order_type TEXT NOT NULL CHECK(order_type IN ('dine-in', 'take-out')),
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('held', 'paid', 'cancelled')) DEFAULT 'held',
    paid_transaction_id INTEGER,
    FOREIGN KEY(cashier_id) REFERENCES users(id),
    FOREIGN KEY(paid_transaction_id) REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS pos_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    menu_item_id INTEGER,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    subtotal REAL NOT NULL CHECK(subtotal >= 0),
    FOREIGN KEY(order_id) REFERENCES pos_orders(id) ON DELETE CASCADE,
    FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
  );
`);

const posOrderColumns = db.prepare("PRAGMA table_info(pos_orders)").all();
if (!posOrderColumns.some((column) => column.name === "table_number")) {
  db.prepare("ALTER TABLE pos_orders ADD COLUMN table_number TEXT").run();
}

// Seed sample dashboard data only when each table is empty.
// SAMPLE DATA - remove or replace with live restaurant data when deployment begins.
if (db.prepare("SELECT COUNT(*) AS count FROM employees").get().count === 0) {
  const insertEmployee = db.prepare(
    `INSERT INTO employees (employee_id, full_name, position, rate, rate_type, contact_number, status, date_hired) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertEmployee.run(
    "EMP-001",
    "Maria Santos",
    "Kitchen Lead",
    650,
    "daily",
    "09171234567",
    "active",
    "2025-01-15",
  );
  insertEmployee.run(
    "EMP-002",
    "Juan Cruz",
    "Cashier",
    500,
    "daily",
    "09179876543",
    "active",
    "2025-03-01",
  );
  insertEmployee.run(
    "EMP-003",
    "Ana Reyes",
    "Service Crew",
    95,
    "hourly",
    "09175550123",
    "active",
    "2025-06-10",
  );
}

if (
  db.prepare("SELECT COUNT(*) AS count FROM inventory_items").get().count === 0
) {
  const insertItem = db.prepare(
    `INSERT INTO inventory_items (name, category, unit, quantity, reorder_level) VALUES (?, ?, ?, ?, ?)`,
  );
  insertItem.run("Rice", "Dry Goods", "kg", 18, 10);
  insertItem.run("Cooking Oil", "Ingredients", "liters", 4, 8);
  insertItem.run("Chicken", "Meat", "kg", 12, 5);
  insertItem.run("Tomatoes", "Vegetables", "kg", 3, 6);
}

if (db.prepare("SELECT COUNT(*) AS count FROM menu_items").get().count === 0) {
  const insertMenu = db.prepare(
    `INSERT INTO menu_items (name, price) VALUES (?, ?)`,
  );
  insertMenu.run("Chicken Meal", 185);
  insertMenu.run("Pork Adobo", 195);
  insertMenu.run("Vegetable Bowl", 145);
}

if (db.prepare("SELECT COUNT(*) AS count FROM iot_devices").get().count === 0) {
  db.prepare(
    `INSERT INTO iot_devices (device_id, name, api_key, status, calibration_date) VALUES (?, ?, ?, ?, ?)`,
  ).run(
    "KITCHEN-SCALE-1",
    "Kitchen Scale 1",
    "sample-" + require("crypto").randomBytes(18).toString("hex"),
    "online",
    new Date().toISOString().slice(0, 10),
  );
}

if (
  db.prepare("SELECT COUNT(*) AS count FROM transactions").get().count === 0
) {
  const admin = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("admin001");
  const insertTransaction = db.prepare(
    `INSERT INTO transactions (transaction_code, transaction_date, cashier_id, total, payment_method, status) VALUES (?, ?, ?, ?, ?, 'completed')`,
  );
  const insertLine = db.prepare(
    `INSERT INTO transaction_items (transaction_id, item_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)`,
  );
  for (let day = 6; day >= 0; day--) {
    for (let order = 1; order <= (day === 0 ? 3 : 2); order++) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      date.setHours(10 + order, 15, 0, 0);
      const total = 185 + order * 145;
      const result = insertTransaction.run(
        `TX-${date.toISOString().slice(0, 10).replace(/-/g, "")}-${order}`,
        date.toISOString(),
        admin?.id || null,
        total,
        order % 2 ? "Cash" : "Cashless",
      );
      insertLine.run(result.lastInsertRowid, "Chicken Meal", 1, 185, 185);
      insertLine.run(result.lastInsertRowid, "Vegetable Bowl", 1, 145, 145);
    }
  }
}

if (db.prepare("SELECT COUNT(*) AS count FROM waste_logs").get().count === 0) {
  const insertWaste = db.prepare(
    `INSERT INTO waste_logs (device_id, weight, recorded_at, processing_status, before_weight, after_weight) VALUES (?, ?, ?, 'processed', ?, ?)`,
  );
  for (let day = 6; day >= 0; day--) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    date.setHours(18, 0, 0, 0);
    insertWaste.run(
      "KITCHEN-SCALE-1",
      3 + (day % 3) * 1.4,
      date.toISOString(),
      5 + (day % 3) * 2,
      3 + (day % 3) * 1.4,
    );
  }
}

if (db.prepare("SELECT COUNT(*) AS count FROM attendance").get().count === 0) {
  const employees = db
    .prepare("SELECT id FROM employees WHERE status = ? ORDER BY id LIMIT 3")
    .all("active");
  const insertAttendance = db.prepare(
    `INSERT INTO attendance (employee_id, attendance_date, time_in, time_out, status, hours_worked) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const today = new Date().toISOString().slice(0, 10);
  employees.forEach((employee, index) =>
    insertAttendance.run(
      employee.id,
      today,
      index === 2 ? "09:20" : "09:00",
      "17:00",
      index === 2 ? "late" : "present",
      7.7,
    ),
  );
}

if (db.prepare("SELECT COUNT(*) AS count FROM alerts").get().count === 0) {
  // SAMPLE DATA - sample inventory and waste alerts for visual testing only.
  db.prepare(
    `INSERT INTO alerts (alert_type, message, is_read) VALUES ('low-stock', 'Cooking Oil is below its reorder level.', 0)`,
  ).run();
  db.prepare(
    `INSERT INTO alerts (alert_type, message, is_read) VALUES ('low-stock', 'Tomatoes are below their reorder level.', 0)`,
  ).run();
}

if (db.prepare("SELECT COUNT(*) AS count FROM settings").get().count === 0) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
    "waste_capacity_kg",
    "50",
  );
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
    "waste_warning_percent",
    "80",
  );
}

module.exports = db;
