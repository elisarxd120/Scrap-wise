const path = require("path");
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = require("../models/database");

const router = express.Router();

// Every route mounted under /admin requires an authenticated Admin account.
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect("/");
  if (req.session.user.role !== "Admin") return res.redirect("/");
  next();
}
router.use(requireAdmin);

// Shared navigation and dashboard are rendered from reusable public files.
router.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin", "dashboard.html"));
});

router.get("/api/nav", (req, res) => {
  const pendingApprovals = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'pending'")
    .get().count;
  const unreadAlerts = db
    .prepare("SELECT COUNT(*) AS count FROM alerts WHERE is_read = 0")
    .get().count;
  res.json({
    pendingApprovals,
    unreadAlerts,
    adminName: req.session.user.full_name,
  });
});

router.get("/api/dashboard", (req, res) => {
  const today = localDateString(new Date());
  const todayStart = `${today}T00:00:00.000Z`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = `${localDateString(tomorrow)}T00:00:00.000Z`;

  const sales = db
    .prepare(
      `SELECT COALESCE(SUM(total), 0) AS value, COUNT(*) AS count FROM transactions WHERE status = 'completed' AND transaction_date >= ? AND transaction_date < ?`,
    )
    .get(todayStart, tomorrowStart);
  const lowStock = db
    .prepare(
      "SELECT COUNT(*) AS count FROM inventory_items WHERE quantity <= reorder_level",
    )
    .get().count;
  const employeesPresent = db
    .prepare(
      "SELECT COUNT(*) AS count FROM attendance WHERE attendance_date = ? AND status IN ('present', 'late')",
    )
    .get(today).count;
  const wasteToday = db
    .prepare(
      "SELECT COALESCE(SUM(weight), 0) AS value FROM waste_logs WHERE substr(recorded_at, 1, 10) = ?",
    )
    .get(today).value;
  const pendingApprovals = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'pending'")
    .get().count;

  const salesDays = [];
  const wasteDays = [];
  const labels = [];
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const dateText = localDateString(date);
    const dayStart = `${dateText}T00:00:00.000Z`;
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const nextStart = `${localDateString(next)}T00:00:00.000Z`;
    labels.push(
      date.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
    );
    salesDays.push(
      db
        .prepare(
          "SELECT COALESCE(SUM(total), 0) AS value FROM transactions WHERE status = 'completed' AND transaction_date >= ? AND transaction_date < ?",
        )
        .get(dayStart, nextStart).value,
    );
    wasteDays.push(
      db
        .prepare(
          "SELECT COALESCE(SUM(weight), 0) AS value FROM waste_logs WHERE substr(recorded_at, 1, 10) = ?",
        )
        .get(dateText).value,
    );
  }

  const lowStockItems = db
    .prepare(
      "SELECT id, name, category, quantity, unit, reorder_level FROM inventory_items WHERE quantity <= reorder_level ORDER BY quantity ASC LIMIT 8",
    )
    .all();
  const recentTransactions = db
    .prepare(
      `SELECT t.id, t.transaction_code, t.transaction_date, t.total, t.status, u.full_name AS cashier, GROUP_CONCAT(ti.item_name || ' x' || ti.quantity, ', ') AS items FROM transactions t LEFT JOIN users u ON u.id = t.cashier_id LEFT JOIN transaction_items ti ON ti.transaction_id = t.id GROUP BY t.id ORDER BY t.transaction_date DESC LIMIT 5`,
    )
    .all();
  const recentAlerts = db
    .prepare(
      "SELECT id, alert_type, message, is_read, created_at FROM alerts ORDER BY created_at DESC LIMIT 5",
    )
    .all();

  res.json({
    cards: {
      todaysSales: sales.value,
      todaysTransactions: sales.count,
      lowStockItems: lowStock,
      employeesPresent,
      wasteToday,
      pendingApprovals,
    },
    charts: { labels, sales: salesDays, waste: wasteDays },
    lowStockItems,
    recentTransactions,
    recentAlerts,
  });
});

// A-02 Employees: protected list and CRUD API.
router.get("/employees", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin", "employees.html"));
});

router.get("/api/employees", (req, res) => {
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();
  let employees;
  if (search) {
    employees = db
      .prepare(
        `SELECT * FROM employees WHERE lower(employee_id) LIKE ? OR lower(full_name) LIKE ? OR lower(position) LIKE ? ORDER BY full_name ASC`,
      )
      .all(`%${search}%`, `%${search}%`, `%${search}%`);
  } else {
    employees = db
      .prepare("SELECT * FROM employees ORDER BY full_name ASC")
      .all();
  }
  res.json(employees);
});

router.post("/api/employees", (req, res) => {
  const data = validateEmployee(req.body);
  if (data.error) return res.status(400).json({ error: data.error });
  const duplicate = db
    .prepare("SELECT id FROM employees WHERE employee_id = ?")
    .get(data.employee_id);
  if (duplicate)
    return res
      .status(409)
      .json({ error: "Employee ID or name already exists." });
  const result = db
    .prepare(
      `INSERT INTO employees (employee_id, full_name, position, rate, rate_type, contact_number, status, date_hired) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.employee_id,
      data.full_name,
      data.position,
      data.rate,
      data.rate_type,
      data.contact_number,
      data.status,
      data.date_hired,
    );
  logAudit(
    req,
    "CREATE",
    "employee",
    result.lastInsertRowid,
    null,
    JSON.stringify(data),
  );
  res.status(201).json({ success: true, id: result.lastInsertRowid });
});

router.put("/api/employees/:id", (req, res) => {
  const employee = db
    .prepare("SELECT * FROM employees WHERE id = ?")
    .get(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found." });
  const data = validateEmployee(req.body);
  if (data.error) return res.status(400).json({ error: data.error });
  const duplicate = db
    .prepare("SELECT id FROM employees WHERE employee_id = ? AND id != ?")
    .get(data.employee_id, req.params.id);
  if (duplicate)
    return res
      .status(409)
      .json({ error: "Employee ID or name already exists." });
  db.prepare(
    `UPDATE employees SET employee_id=?, full_name=?, position=?, rate=?, rate_type=?, contact_number=?, status=?, date_hired=? WHERE id=?`,
  ).run(
    data.employee_id,
    data.full_name,
    data.position,
    data.rate,
    data.rate_type,
    data.contact_number,
    data.status,
    data.date_hired,
    req.params.id,
  );
  logAudit(
    req,
    "UPDATE",
    "employee",
    req.params.id,
    JSON.stringify(employee),
    JSON.stringify(data),
  );
  res.json({ success: true });
});

router.delete("/api/employees/:id", (req, res) => {
  const employee = db
    .prepare("SELECT * FROM employees WHERE id = ?")
    .get(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found." });
  const linked = db
    .prepare("SELECT COUNT(*) AS count FROM attendance WHERE employee_id = ?")
    .get(req.params.id).count;
  if (linked > 0)
    return res.status(409).json({
      error:
        "Cannot delete an employee with attendance records. Set the employee to inactive instead.",
    });
  db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
  logAudit(
    req,
    "DELETE",
    "employee",
    req.params.id,
    JSON.stringify(employee),
    null,
  );
  res.json({ success: true });
});

// A-02 Attendance: list and CRUD API with automatic hours-worked calculation.
router.get("/attendance", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "public", "admin", "attendance.html"),
  );
});

router.get("/api/attendance", (req, res) => {
  const date = String(req.query.date || "").trim();
  const employeeId = String(req.query.employee_id || "").trim();
  let sql = `SELECT a.*, e.employee_id AS employee_code, e.full_name FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE 1=1`;
  const values = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    sql += " AND a.attendance_date = ?";
    values.push(date);
  }
  if (employeeId && /^\d+$/.test(employeeId)) {
    sql += " AND a.employee_id = ?";
    values.push(Number(employeeId));
  }
  sql += " ORDER BY a.attendance_date DESC, a.time_in ASC, e.full_name ASC";
  res.json(db.prepare(sql).all(...values));
});

router.post("/api/attendance", (req, res) => {
  const data = validateAttendance(req.body);
  if (data.error) return res.status(400).json({ error: data.error });
  const employee = db
    .prepare("SELECT id FROM employees WHERE id = ?")
    .get(data.employee_id);
  if (!employee)
    return res.status(400).json({ error: "Select a valid employee." });
  const duplicate = db
    .prepare(
      "SELECT id FROM attendance WHERE employee_id = ? AND attendance_date = ?",
    )
    .get(data.employee_id, data.attendance_date);
  if (duplicate)
    return res.status(409).json({
      error: "An attendance record already exists for this employee and date.",
    });
  const result = db
    .prepare(
      `INSERT INTO attendance (employee_id, attendance_date, time_in, time_out, status, hours_worked) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.employee_id,
      data.attendance_date,
      data.time_in,
      data.time_out,
      data.status,
      data.hours_worked,
    );
  logAudit(
    req,
    "CREATE",
    "attendance",
    result.lastInsertRowid,
    null,
    JSON.stringify(data),
  );
  res.status(201).json({ success: true, id: result.lastInsertRowid });
});

router.put("/api/attendance/:id", (req, res) => {
  const oldRecord = db
    .prepare("SELECT * FROM attendance WHERE id = ?")
    .get(req.params.id);
  if (!oldRecord)
    return res.status(404).json({ error: "Attendance record not found." });
  const data = validateAttendance(req.body);
  if (data.error) return res.status(400).json({ error: data.error });
  const employee = db
    .prepare("SELECT id FROM employees WHERE id = ?")
    .get(data.employee_id);
  if (!employee)
    return res.status(400).json({ error: "Select a valid employee." });
  const duplicate = db
    .prepare(
      "SELECT id FROM attendance WHERE employee_id = ? AND attendance_date = ? AND id != ?",
    )
    .get(data.employee_id, data.attendance_date, req.params.id);
  if (duplicate)
    return res.status(409).json({
      error: "An attendance record already exists for this employee and date.",
    });
  db.prepare(
    `UPDATE attendance SET employee_id=?, attendance_date=?, time_in=?, time_out=?, status=?, hours_worked=? WHERE id=?`,
  ).run(
    data.employee_id,
    data.attendance_date,
    data.time_in,
    data.time_out,
    data.status,
    data.hours_worked,
    req.params.id,
  );
  logAudit(
    req,
    "UPDATE",
    "attendance",
    req.params.id,
    JSON.stringify(oldRecord),
    JSON.stringify(data),
  );
  res.json({ success: true });
});

router.delete("/api/attendance/:id", (req, res) => {
  const oldRecord = db
    .prepare("SELECT * FROM attendance WHERE id = ?")
    .get(req.params.id);
  if (!oldRecord)
    return res.status(404).json({ error: "Attendance record not found." });
  db.prepare("DELETE FROM attendance WHERE id = ?").run(req.params.id);
  logAudit(
    req,
    "DELETE",
    "attendance",
    req.params.id,
    JSON.stringify(oldRecord),
    null,
  );
  res.json({ success: true });
});

// A-03 Payroll page and APIs.
router.get("/payroll", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin", "payroll.html"));
});

router.get("/payroll/payslip/:id", (req, res) => {
  const record = db
    .prepare(
      `SELECT p.*, e.employee_id AS employee_code, e.full_name, e.position FROM payroll_records p JOIN employees e ON e.id = p.employee_id WHERE p.id = ?`,
    )
    .get(req.params.id);
  if (!record) return res.status(404).send("Payslip not found.");
  let deductions = {};
  try {
    deductions = JSON.parse(record.deductions_json || "{}");
  } catch (_) {
    deductions = {};
  }
  const deductionRows = Object.entries(deductions)
    .map(
      ([name, amount]) =>
        `<tr><td>${escapeHtml(name)}</td><td>${formatMoney(amount)}</td></tr>`,
    )
    .join("");
  res.send(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payslip - ${escapeHtml(record.full_name)}</title><link rel="stylesheet" href="/admin/admin.css"><style>@media print{.no-print{display:none}.payslip{box-shadow:none;border:0;width:100%}}</style></head><body><main class="print-page"><button class="button primary no-print" onclick="window.print()">Print / Save PDF</button><article class="payslip"><header><div class="brand-mini">♻</div><div><h1>LAHOK Restaurant</h1><p>Employee Payslip</p></div></header><section class="payslip-info"><div><strong>${escapeHtml(record.full_name)}</strong><p>${escapeHtml(record.employee_code)} · ${escapeHtml(record.position)}</p></div><div><strong>Pay Cycle</strong><p>${escapeHtml(record.cycle_start)} to ${escapeHtml(record.cycle_end)}</p></div></section><table><thead><tr><th>Earnings</th><th>Amount</th></tr></thead><tbody><tr><td>Regular pay (${Number(record.days_worked).toFixed(1)} days / ${Number(record.hours_worked).toFixed(2)} hours)</td><td>${formatMoney(record.regular_pay)}</td></tr><tr><td>Overtime (${Number(record.overtime_hours).toFixed(2)} hours)</td><td>${formatMoney(record.overtime_pay)}</td></tr><tr><td>Adjustments</td><td>${formatMoney(record.adjustments)}</td></tr></tbody></table><table><thead><tr><th>Deductions</th><th>Amount</th></tr></thead><tbody>${deductionRows || '<tr><td colspan="2">No deductions</td></tr>'}</tbody><tfoot><tr><td><strong>Net Pay</strong></td><td><strong>${formatMoney(record.net_pay)}</strong></td></tr></tfoot></table><p class="payslip-status">Status: ${escapeHtml(record.status)}</p></article></main></body></html>`,
  );
});

router.get("/api/payroll", (req, res) => {
  const start = String(req.query.start || "").trim();
  const end = String(req.query.end || "").trim();
  let sql = `SELECT p.*, e.employee_id AS employee_code, e.full_name, e.position FROM payroll_records p JOIN employees e ON e.id = p.employee_id`;
  const values = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    sql += " WHERE p.cycle_start = ? AND p.cycle_end = ?";
    values.push(start, end);
  }
  sql += " ORDER BY e.full_name ASC";
  res.json(db.prepare(sql).all(...values));
});

router.post("/api/payroll/compute", (req, res) => {
  const start = String(req.body.start_date || "").trim();
  const end = String(req.body.end_date || "").trim();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    start > end
  )
    return res.status(400).json({ error: "Select a valid payroll cycle." });
  const locked = db
    .prepare(
      "SELECT id FROM payroll_records WHERE cycle_start = ? AND cycle_end = ? AND status = 'approved' LIMIT 1",
    )
    .get(start, end);
  if (locked)
    return res.status(409).json({
      error:
        "This payroll cycle is approved and locked. Unlock it before recomputing.",
    });

  const requestedDeductions =
    req.body.deductions && typeof req.body.deductions === "object"
      ? req.body.deductions
      : {};
  const defaultDeductions = {
    SSS: 0,
    PhilHealth: 0,
    "Pag-IBIG": 0,
    "Cash advance": 0,
    "Late penalties": 0,
  };
  const deductions = {};
  for (const name of Object.keys(defaultDeductions))
    deductions[name] = nonNegativeAmount(requestedDeductions[name]);
  for (const [name, amount] of Object.entries(requestedDeductions))
    if (!defaultDeductions[name])
      deductions[String(name).slice(0, 50)] = nonNegativeAmount(amount);

  const employees = db
    .prepare(
      "SELECT * FROM employees WHERE status = 'active' ORDER BY full_name ASC",
    )
    .all();
  const insert = db.prepare(
    `INSERT INTO payroll_records (employee_id, cycle_start, cycle_end, days_worked, hours_worked, regular_pay, gross_pay, overtime_hours, overtime_pay, deductions_json, adjustments, net_pay, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
  );
  const update = db.prepare(
    `UPDATE payroll_records SET days_worked=?, hours_worked=?, regular_pay=?, gross_pay=?, overtime_hours=?, overtime_pay=?, deductions_json=?, adjustments=?, net_pay=?, status='draft' WHERE id=?`,
  );

  const transaction = db.transaction(() => {
    employees.forEach((employee) => {
      const attendance = db
        .prepare(
          `SELECT * FROM attendance WHERE employee_id = ? AND attendance_date >= ? AND attendance_date <= ? AND status IN ('present', 'late') ORDER BY attendance_date ASC`,
        )
        .all(employee.id, start, end);
      let daysWorked = new Set(attendance.map((row) => row.attendance_date))
        .size;
      let totalHours = attendance.reduce(
        (sum, row) => sum + Number(row.hours_worked || 0),
        0,
      );
      let regularHours = 0;
      let overtimeHours = 0;
      attendance.forEach((row) => {
        const hours = Number(row.hours_worked || 0);
        regularHours += Math.min(hours, 8);
        overtimeHours += Math.max(0, hours - 8);
      });
      let regularPay;
      let overtimePay;
      if (employee.rate_type === "hourly") {
        regularPay = regularHours * Number(employee.rate);
        overtimePay = overtimeHours * Number(employee.rate) * 1.25;
      } else {
        regularPay = daysWorked * Number(employee.rate);
        overtimePay = overtimeHours * (Number(employee.rate) / 8) * 1.25;
      }
      const grossPay = regularPay + overtimePay;
      const deductionTotal = Object.values(deductions).reduce(
        (sum, amount) => sum + Number(amount),
        0,
      );
      const adjustments = 0;
      const netPay = Math.max(0, grossPay - deductionTotal + adjustments);
      const deductionsJson = JSON.stringify(deductions);
      const existing = db
        .prepare(
          "SELECT id FROM payroll_records WHERE employee_id = ? AND cycle_start = ? AND cycle_end = ?",
        )
        .get(employee.id, start, end);
      if (existing)
        update.run(
          daysWorked,
          totalHours,
          regularPay,
          grossPay,
          overtimeHours,
          overtimePay,
          deductionsJson,
          adjustments,
          netPay,
          existing.id,
        );
      else
        insert.run(
          employee.id,
          start,
          end,
          daysWorked,
          totalHours,
          regularPay,
          grossPay,
          overtimeHours,
          overtimePay,
          deductionsJson,
          adjustments,
          netPay,
        );
    });
  });
  transaction();
  logAudit(
    req,
    "COMPUTE",
    "payroll",
    `${start}:${end}`,
    null,
    `${employees.length} active employees`,
  );
  res.json({ success: true, records: employees.length });
});

router.put("/api/payroll/:id", (req, res) => {
  const record = db
    .prepare("SELECT * FROM payroll_records WHERE id = ?")
    .get(req.params.id);
  if (!record)
    return res.status(404).json({ error: "Payroll record not found." });
  if (record.status === "approved")
    return res
      .status(409)
      .json({ error: "Approved payroll records cannot be edited." });
  let deductions = {};
  try {
    deductions =
      typeof req.body.deductions === "object"
        ? req.body.deductions
        : JSON.parse(record.deductions_json || "{}");
  } catch (_) {
    deductions = {};
  }
  const cleanDeductions = {};
  Object.entries(deductions).forEach(
    ([name, amount]) =>
      (cleanDeductions[String(name).slice(0, 50)] = nonNegativeAmount(amount)),
  );
  const adjustments = Number(req.body.adjustments);
  if (!Number.isFinite(adjustments))
    return res.status(400).json({ error: "Enter a valid adjustment amount." });
  const deductionTotal = Object.values(cleanDeductions).reduce(
    (sum, amount) => sum + Number(amount),
    0,
  );
  const netPay = Math.max(
    0,
    Number(record.gross_pay) - deductionTotal + adjustments,
  );
  db.prepare(
    "UPDATE payroll_records SET deductions_json=?, adjustments=?, net_pay=? WHERE id=? AND status='draft'",
  ).run(JSON.stringify(cleanDeductions), adjustments, netPay, req.params.id);
  logAudit(
    req,
    "UPDATE",
    "payroll",
    req.params.id,
    record.deductions_json,
    JSON.stringify(cleanDeductions),
  );
  res.json({ success: true });
});

router.post("/api/payroll/:id/approve", (req, res) => {
  const record = db
    .prepare("SELECT * FROM payroll_records WHERE id = ?")
    .get(req.params.id);
  if (!record)
    return res.status(404).json({ error: "Payroll record not found." });
  db.prepare(
    "UPDATE payroll_records SET status='approved', approved_by=?, approved_at=? WHERE id=? AND status='draft'",
  ).run(req.session.user.id, new Date().toISOString(), req.params.id);
  logAudit(req, "APPROVE", "payroll", req.params.id, "draft", "approved");
  res.json({ success: true });
});

router.post("/api/payroll/approve-cycle", (req, res) => {
  const start = String(req.body.start_date || "");
  const end = String(req.body.end_date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
    return res.status(400).json({ error: "Select a valid payroll cycle." });
  const result = db
    .prepare(
      "UPDATE payroll_records SET status='approved', approved_by=?, approved_at=? WHERE cycle_start=? AND cycle_end=? AND status='draft'",
    )
    .run(req.session.user.id, new Date().toISOString(), start, end);
  if (!result.changes)
    return res
      .status(409)
      .json({ error: "No draft records found for this cycle." });
  logAudit(
    req,
    "APPROVE_CYCLE",
    "payroll",
    `${start}:${end}`,
    "draft",
    "approved",
  );
  res.json({ success: true });
});

router.post("/api/payroll/unlock-cycle", (req, res) => {
  const start = String(req.body.start_date || "");
  const end = String(req.body.end_date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
    return res.status(400).json({ error: "Select a valid payroll cycle." });
  const result = db
    .prepare(
      "UPDATE payroll_records SET status='draft', approved_by=NULL, approved_at=NULL WHERE cycle_start=? AND cycle_end=? AND status='approved'",
    )
    .run(start, end);
  logAudit(
    req,
    "UNLOCK_CYCLE",
    "payroll",
    `${start}:${end}`,
    "approved",
    "draft",
  );
  res.json({ success: true, unlocked: result.changes });
});

router.delete("/api/payroll/:id", (req, res) => {
  const record = db
    .prepare("SELECT * FROM payroll_records WHERE id = ?")
    .get(req.params.id);
  if (!record)
    return res.status(404).json({ error: "Payroll record not found." });
  if (record.status === "approved")
    return res
      .status(409)
      .json({ error: "Approved payroll records cannot be deleted." });
  db.prepare("DELETE FROM payroll_records WHERE id=? AND status='draft'").run(
    req.params.id,
  );
  logAudit(
    req,
    "DELETE",
    "payroll",
    req.params.id,
    JSON.stringify(record),
    null,
  );
  res.json({ success: true });
});

// A-04 Inventory page and APIs.
router.get("/inventory", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin", "inventory.html"));
});

router.get("/api/inventory", (req, res) => {
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();
  let sql = "SELECT * FROM inventory_items";
  const values = [];
  if (search) {
    sql +=
      " WHERE lower(name) LIKE ? OR lower(category) LIKE ? OR lower(unit) LIKE ?";
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += " ORDER BY name ASC";
  const items = db
    .prepare(sql)
    .all(...values)
    .map((item) => ({
      ...item,
      status:
        item.quantity <= 0
          ? "out"
          : item.quantity <= item.reorder_level
            ? "low"
            : "in stock",
    }));
  res.json(items);
});

router.post("/api/inventory", (req, res) => {
  const item = validateInventoryItem(req.body);
  if (item.error) return res.status(400).json({ error: item.error });
  const duplicate = db
    .prepare("SELECT id FROM inventory_items WHERE lower(name) = lower(?)")
    .get(item.name);
  if (duplicate)
    return res
      .status(409)
      .json({ error: "An inventory item with this name already exists." });
  const result = db
    .prepare(
      "INSERT INTO inventory_items (name, category, unit, quantity, reorder_level) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      item.name,
      item.category,
      item.unit,
      item.quantity,
      item.reorder_level,
    );
  logAudit(
    req,
    "CREATE",
    "inventory_item",
    result.lastInsertRowid,
    null,
    JSON.stringify(item),
  );
  res.status(201).json({ success: true, id: result.lastInsertRowid });
});

router.put("/api/inventory/:id", (req, res) => {
  const oldItem = db
    .prepare("SELECT * FROM inventory_items WHERE id = ?")
    .get(req.params.id);
  if (!oldItem)
    return res.status(404).json({ error: "Inventory item not found." });
  const item = validateInventoryItem(req.body);
  if (item.error) return res.status(400).json({ error: item.error });
  const duplicate = db
    .prepare(
      "SELECT id FROM inventory_items WHERE lower(name) = lower(?) AND id != ?",
    )
    .get(item.name, req.params.id);
  if (duplicate)
    return res
      .status(409)
      .json({ error: "An inventory item with this name already exists." });
  db.prepare(
    "UPDATE inventory_items SET name=?, category=?, unit=?, quantity=?, reorder_level=? WHERE id=?",
  ).run(
    item.name,
    item.category,
    item.unit,
    item.quantity,
    item.reorder_level,
    req.params.id,
  );
  logAudit(
    req,
    "UPDATE",
    "inventory_item",
    req.params.id,
    JSON.stringify(oldItem),
    JSON.stringify(item),
  );
  res.json({ success: true });
});

router.delete("/api/inventory/:id", (req, res) => {
  const item = db
    .prepare("SELECT * FROM inventory_items WHERE id = ?")
    .get(req.params.id);
  if (!item)
    return res.status(404).json({ error: "Inventory item not found." });
  const movements = db
    .prepare("SELECT COUNT(*) AS count FROM stock_movements WHERE item_id = ?")
    .get(req.params.id).count;
  if (movements)
    return res.status(409).json({
      error:
        "Cannot delete an item with stock movements. Keep the item for stock history.",
    });
  db.prepare("DELETE FROM inventory_items WHERE id = ? AND quantity = 0").run(
    req.params.id,
  );
  if (
    !db
      .prepare("SELECT id FROM inventory_items WHERE id = ?")
      .get(req.params.id)
  ) {
    logAudit(
      req,
      "DELETE",
      "inventory_item",
      req.params.id,
      JSON.stringify(item),
      null,
    );
    return res.json({ success: true });
  }
  res.status(409).json({
    error:
      "Cannot delete an item with quantity on hand. Reduce it through Stock-Out movements first.",
  });
});

router.get("/api/inventory/movements", (req, res) => {
  const itemId = String(req.query.item_id || "").trim();
  let sql = `SELECT m.*, i.name AS item_name, i.unit, u.full_name AS recorder FROM stock_movements m JOIN inventory_items i ON i.id = m.item_id LEFT JOIN users u ON u.id = m.recorded_by WHERE 1=1`;
  const values = [];
  if (/^\d+$/.test(itemId)) {
    sql += " AND m.item_id = ?";
    values.push(Number(itemId));
  }
  sql += " ORDER BY m.movement_date DESC, m.id DESC";
  res.json(db.prepare(sql).all(...values));
});

router.post("/api/inventory/movements", (req, res) => {
  const movement = validateMovement(req.body);
  if (movement.error) return res.status(400).json({ error: movement.error });
  const item = db
    .prepare("SELECT * FROM inventory_items WHERE id = ?")
    .get(movement.item_id);
  if (!item)
    return res.status(400).json({ error: "Select a valid inventory item." });
  const newQuantity =
    item.quantity +
    (movement.movement_type === "in" ? movement.quantity : -movement.quantity);
  if (newQuantity < 0)
    return res
      .status(400)
      .json({ error: "Stock-Out quantity cannot exceed quantity on hand." });
  const transaction = db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO stock_movements (item_id, movement_type, quantity, movement_date, reason, recorded_by) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        movement.item_id,
        movement.movement_type,
        movement.quantity,
        movement.movement_date,
        movement.reason,
        req.session.user.id,
      );
    db.prepare("UPDATE inventory_items SET quantity = ? WHERE id = ?").run(
      newQuantity,
      movement.item_id,
    );
    logAudit(
      req,
      "CREATE",
      "stock_movement",
      result.lastInsertRowid,
      JSON.stringify({ quantity: item.quantity }),
      JSON.stringify({ quantity: newQuantity }),
    );
    return result.lastInsertRowid;
  });
  res.status(201).json({ success: true, id: transaction() });
});

router.put("/api/inventory/movements/:id", (req, res) => {
  const oldMovement = db
    .prepare("SELECT * FROM stock_movements WHERE id = ?")
    .get(req.params.id);
  if (!oldMovement)
    return res.status(404).json({ error: "Stock movement not found." });
  const movement = validateMovement(req.body);
  if (movement.error) return res.status(400).json({ error: movement.error });
  const oldItem = db
    .prepare("SELECT * FROM inventory_items WHERE id = ?")
    .get(oldMovement.item_id);
  const targetItem = db
    .prepare("SELECT * FROM inventory_items WHERE id = ?")
    .get(movement.item_id);
  if (!oldItem || !targetItem)
    return res.status(400).json({ error: "Select a valid inventory item." });

  const transaction = db.transaction(() => {
    let oldItemQuantity =
      oldItem.quantity -
      (oldMovement.movement_type === "in"
        ? Number(oldMovement.quantity)
        : -Number(oldMovement.quantity));
    // Roll back the old movement, then apply the corrected movement.
    if (oldMovement.item_id === movement.item_id) {
      const rolledBack =
        oldItem.quantity -
        (oldMovement.movement_type === "in"
          ? Number(oldMovement.quantity)
          : -Number(oldMovement.quantity));
      const newQuantity =
        rolledBack +
        (movement.movement_type === "in"
          ? movement.quantity
          : -movement.quantity);
      if (newQuantity < 0)
        throw new Error("Stock-Out quantity cannot exceed quantity on hand.");
      db.prepare("UPDATE inventory_items SET quantity = ? WHERE id = ?").run(
        newQuantity,
        movement.item_id,
      );
      db.prepare(
        "UPDATE stock_movements SET item_id=?, movement_type=?, quantity=?, movement_date=?, reason=? WHERE id=?",
      ).run(
        movement.item_id,
        movement.movement_type,
        movement.quantity,
        movement.movement_date,
        movement.reason,
        req.params.id,
      );
      logAudit(
        req,
        "UPDATE",
        "stock_movement",
        req.params.id,
        JSON.stringify(oldMovement),
        JSON.stringify(movement),
      );
      return;
    }

    db.prepare("UPDATE inventory_items SET quantity = ? WHERE id = ?").run(
      oldItemQuantity,
      oldMovement.item_id,
    );
    const targetQuantity =
      targetItem.quantity +
      (movement.movement_type === "in"
        ? movement.quantity
        : -movement.quantity);
    if (targetQuantity < 0)
      throw new Error("Stock-Out quantity cannot exceed quantity on hand.");
    db.prepare("UPDATE inventory_items SET quantity = ? WHERE id = ?").run(
      targetQuantity,
      movement.item_id,
    );
    db.prepare(
      "UPDATE stock_movements SET item_id=?, movement_type=?, quantity=?, movement_date=?, reason=? WHERE id=?",
    ).run(
      movement.item_id,
      movement.movement_type,
      movement.quantity,
      movement.movement_date,
      movement.reason,
      req.params.id,
    );
    logAudit(
      req,
      "UPDATE",
      "stock_movement",
      req.params.id,
      JSON.stringify(oldMovement),
      JSON.stringify(movement),
    );
  });
  try {
    transaction();
  } catch (error) {
    return res
      .status(400)
      .json({ error: error.message || "Unable to update stock movement." });
  }
  res.json({ success: true });
});

router.delete("/api/inventory/movements/:id", (req, res) => {
  const movement = db
    .prepare("SELECT * FROM stock_movements WHERE id = ?")
    .get(req.params.id);
  if (!movement)
    return res.status(404).json({ error: "Stock movement not found." });
  const item = db
    .prepare("SELECT * FROM inventory_items WHERE id = ?")
    .get(movement.item_id);
  if (!item)
    return res.status(404).json({ error: "Related inventory item not found." });
  const quantity =
    item.quantity -
    (movement.movement_type === "in"
      ? Number(movement.quantity)
      : -Number(movement.quantity));
  if (quantity < 0)
    return res.status(400).json({
      error: "Deleting this movement would make item quantity negative.",
    });
  const transaction = db.transaction(() => {
    db.prepare("UPDATE inventory_items SET quantity = ? WHERE id = ?").run(
      quantity,
      movement.item_id,
    );
    db.prepare("DELETE FROM stock_movements WHERE id = ?").run(req.params.id);
    logAudit(
      req,
      "DELETE",
      "stock_movement",
      req.params.id,
      JSON.stringify(movement),
      null,
    );
  });
  transaction();
  res.json({ success: true });
});

router.get("/api/alerts", (req, res) => {
  res.json(
    db
      .prepare(
        "SELECT id, alert_type, message, is_read, created_at FROM alerts ORDER BY created_at DESC LIMIT 20",
      )
      .all(),
  );
});

router.post("/api/alerts/:id/read", (req, res) => {
  const result = db
    .prepare("UPDATE alerts SET is_read = 1 WHERE id = ?")
    .run(req.params.id);
  if (!result.changes)
    return res.status(404).json({ error: "Alert not found." });
  res.json({ success: true });
});

router.post("/api/alerts/read-all", (req, res) => {
  db.prepare("UPDATE alerts SET is_read = 1 WHERE is_read = 0").run();
  res.json({ success: true });
});

// A-05 Transactions page and APIs.
router.get("/transactions", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "public", "admin", "transactions.html"),
  );
});

router.get("/api/transactions", (req, res) => {
  const start = String(req.query.start || "").trim();
  const end = String(req.query.end || "").trim();
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();
  let sql = `SELECT t.*, u.full_name AS cashier,
    GROUP_CONCAT(ti.item_name || ' x' || ti.quantity, ', ') AS items
    FROM transactions t LEFT JOIN users u ON u.id=t.cashier_id
    LEFT JOIN transaction_items ti ON ti.transaction_id=t.id WHERE 1=1`;
  const values = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    sql += " AND date(t.transaction_date) >= ?";
    values.push(start);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    sql += " AND date(t.transaction_date) <= ?";
    values.push(end);
  }
  if (search) {
    sql +=
      " AND (lower(t.transaction_code) LIKE ? OR lower(t.payment_method) LIKE ? OR lower(u.full_name) LIKE ? OR lower(ti.item_name) LIKE ?)";
    values.push(...[1, 2, 3, 4].map(() => `%${search}%`));
  }
  sql += " GROUP BY t.id ORDER BY t.transaction_date DESC, t.id DESC";
  res.json(db.prepare(sql).all(...values));
});

router.get("/api/transactions/:id", (req, res) => {
  const transaction = db
    .prepare(
      `SELECT t.*, u.full_name AS cashier, v.full_name AS voided_by_name
    FROM transactions t LEFT JOIN users u ON u.id=t.cashier_id LEFT JOIN users v ON v.id=t.voided_by WHERE t.id=?`,
    )
    .get(req.params.id);
  if (!transaction)
    return res.status(404).json({ error: "Transaction not found." });
  const items = db
    .prepare(
      "SELECT id, item_id, item_name, quantity, unit_price, subtotal FROM transaction_items WHERE transaction_id=? ORDER BY id ASC",
    )
    .all(req.params.id);
  res.json({ ...transaction, items });
});

router.put("/api/transactions/:id", (req, res) => {
  const oldTransaction = db
    .prepare("SELECT * FROM transactions WHERE id=?")
    .get(req.params.id);
  if (!oldTransaction)
    return res.status(404).json({ error: "Transaction not found." });
  if (oldTransaction.status === "voided")
    return res
      .status(409)
      .json({ error: "Voided transactions cannot be corrected." });
  const paymentMethod = String(req.body.payment_method || "").trim();
  if (!paymentMethod)
    return res.status(400).json({ error: "Payment method is required." });
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length)
    return res
      .status(400)
      .json({ error: "At least one line item is required." });

  const normalized = [];
  for (const item of items) {
    const name = String(item.item_name || "").trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    if (
      !name ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      return res.status(400).json({
        error:
          "Each line item needs a name, positive whole quantity, and valid price.",
      });
    }
    normalized.push({
      id: Number(item.id) || null,
      item_name: name,
      quantity,
      unit_price: Math.round(unitPrice * 100) / 100,
      subtotal: Math.round(quantity * unitPrice * 100) / 100,
    });
  }

  const transactionWrite = db.transaction(() => {
    const oldItems = db
      .prepare(
        "SELECT * FROM transaction_items WHERE transaction_id=? ORDER BY id ASC",
      )
      .all(req.params.id);
    db.prepare("UPDATE transactions SET payment_method=? WHERE id=?").run(
      paymentMethod,
      req.params.id,
    );
    db.prepare("DELETE FROM transaction_items WHERE transaction_id=?").run(
      req.params.id,
    );
    const insert = db.prepare(
      "INSERT INTO transaction_items (transaction_id, item_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)",
    );
    for (const item of normalized)
      insert.run(
        req.params.id,
        item.item_name,
        item.quantity,
        item.unit_price,
        item.subtotal,
      );
    const total =
      Math.round(
        normalized.reduce((sum, item) => sum + item.subtotal, 0) * 100,
      ) / 100;
    db.prepare("UPDATE transactions SET total=? WHERE id=?").run(
      total,
      req.params.id,
    );
    logAudit(
      req,
      "CORRECT",
      "transaction",
      req.params.id,
      JSON.stringify({ transaction: oldTransaction, items: oldItems }),
      JSON.stringify({
        payment_method: paymentMethod,
        items: normalized,
        total,
      }),
    );
  });
  transactionWrite();
  res.json({ success: true });
});

router.post("/api/transactions/:id/void", (req, res) => {
  const transaction = db
    .prepare("SELECT * FROM transactions WHERE id=?")
    .get(req.params.id);
  if (!transaction)
    return res.status(404).json({ error: "Transaction not found." });
  if (transaction.status === "voided")
    return res.status(409).json({ error: "Transaction is already voided." });
  const reason = String(req.body.reason || "").trim();
  if (!reason)
    return res.status(400).json({ error: "A void reason is required." });
  const voidedAt = new Date().toISOString();
  db.prepare(
    "UPDATE transactions SET status='voided', void_reason=?, voided_by=?, voided_at=? WHERE id=?",
  ).run(reason, req.session.user.id, voidedAt, req.params.id);
  logAudit(
    req,
    "VOID",
    "transaction",
    req.params.id,
    JSON.stringify(transaction),
    JSON.stringify({
      status: "voided",
      reason,
      voided_by: req.session.user.full_name,
      voided_at: voidedAt,
    }),
  );
  res.json({ success: true });
});

// A-06 User Management page and APIs.
router.get("/users", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin", "users.html"));
});

router.get("/api/users", (req, res) => {
  const status = String(req.query.status || "all");
  const approvedStatuses = new Set(["pending", "approved", "declined"]);
  let sql =
    "SELECT id, full_name, username, role, status, is_active, must_change_password, created_at FROM users";
  const values = [];
  if (approvedStatuses.has(status)) {
    sql += " WHERE status=?";
    values.push(status);
  }
  sql += " ORDER BY created_at DESC, id DESC";
  res.json(db.prepare(sql).all(...values));
});

router.post("/api/users/:id/approve", (req, res) => {
  const user = db
    .prepare("SELECT * FROM users WHERE id=? AND status='pending'")
    .get(req.params.id);
  if (!user)
    return res.status(404).json({ error: "Pending registration not found." });
  db.prepare("UPDATE users SET status='approved', is_active=1 WHERE id=?").run(
    user.id,
  );
  logAudit(
    req,
    "APPROVE",
    "user",
    user.id,
    JSON.stringify(user),
    JSON.stringify({ status: "approved" }),
  );
  res.json({ success: true });
});

router.post("/api/users/:id/decline", (req, res) => {
  const user = db
    .prepare("SELECT * FROM users WHERE id=? AND status='pending'")
    .get(req.params.id);
  if (!user)
    return res.status(404).json({ error: "Pending registration not found." });
  db.prepare("UPDATE users SET status='declined' WHERE id=?").run(user.id);
  logAudit(
    req,
    "DECLINE",
    "user",
    user.id,
    JSON.stringify(user),
    JSON.stringify({ status: "declined" }),
  );
  res.json({ success: true });
});

router.put("/api/users/:id/role", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  const role = String(req.body.role || "");
  if (!["Admin", "Kitchen Staff", "POS Staff"].includes(role))
    return res.status(400).json({ error: "Select a valid role." });
  db.prepare("UPDATE users SET role=? WHERE id=?").run(role, user.id);
  logAudit(
    req,
    "UPDATE_ROLE",
    "user",
    user.id,
    JSON.stringify({ role: user.role }),
    JSON.stringify({ role }),
  );
  res.json({ success: true });
});

router.put("/api/users/:id/status", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (user.id === req.session.user.id)
    return res
      .status(409)
      .json({ error: "You cannot deactivate your own account." });
  const active =
    req.body.is_active === true ||
    req.body.is_active === 1 ||
    req.body.is_active === "1";
  db.prepare("UPDATE users SET is_active=? WHERE id=?").run(
    active ? 1 : 0,
    user.id,
  );
  logAudit(
    req,
    active ? "ACTIVATE_USER" : "DEACTIVATE_USER",
    "user",
    user.id,
    JSON.stringify({ is_active: user.is_active }),
    JSON.stringify({ is_active: active ? 1 : 0 }),
  );
  res.json({ success: true });
});

router.post("/api/users/:id/reset-password", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  const temporaryPassword = String(req.body.temporaryPassword || "").trim();
  if (temporaryPassword.length < 6)
    return res
      .status(400)
      .json({ error: "Temporary password must be at least 6 characters." });
  db.prepare(
    "UPDATE users SET password_hash=?, must_change_password=1 WHERE id=?",
  ).run(bcrypt.hashSync(temporaryPassword, 10), user.id);
  logAudit(
    req,
    "RESET_PASSWORD",
    "user",
    user.id,
    null,
    JSON.stringify({ must_change_password: 1 }),
  );
  res.json({ success: true });
});

// A-07 Settings, threshold alerts, and IoT devices.
router.get("/settings", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin", "settings.html"));
});

router.get("/api/settings", (req, res) => {
  const settings = {};
  db.prepare("SELECT key, value FROM settings")
    .all()
    .forEach((row) => {
      settings[row.key] = row.value;
    });
  res.json({
    waste_capacity_kg: settings.waste_capacity_kg || "50",
    waste_warning_percent: settings.waste_warning_percent || "80",
    default_low_stock: settings.default_low_stock || "10",
  });
});

router.put("/api/settings", (req, res) => {
  const capacity = Number(req.body.waste_capacity_kg);
  const warning = Number(req.body.waste_warning_percent);
  const lowStock = Number(req.body.default_low_stock);
  if (!Number.isFinite(capacity) || capacity <= 0)
    return res
      .status(400)
      .json({ error: "Waste capacity must be greater than zero." });
  if (!Number.isFinite(warning) || warning <= 0 || warning > 100)
    return res
      .status(400)
      .json({ error: "Warning percentage must be between 1 and 100." });
  if (!Number.isFinite(lowStock) || lowStock < 0)
    return res
      .status(400)
      .json({ error: "Default low-stock level cannot be negative." });

  const save = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  );
  const update = db.transaction(() => {
    save.run("waste_capacity_kg", String(Math.round(capacity * 100) / 100));
    save.run("waste_warning_percent", String(Math.round(warning * 100) / 100));
    save.run("default_low_stock", String(Math.round(lowStock * 100) / 100));
  });
  update();
  logAudit(
    req,
    "UPDATE",
    "settings",
    "thresholds",
    null,
    JSON.stringify({
      waste_capacity_kg: capacity,
      waste_warning_percent: warning,
      default_low_stock: lowStock,
    }),
  );
  res.json({ success: true });
});

router.get("/api/iot-devices", (req, res) => {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const devices = db
    .prepare("SELECT * FROM iot_devices ORDER BY name ASC")
    .all()
    .map((device) => ({
      ...device,
      status:
        device.last_received_at && device.last_received_at >= cutoff
          ? "online"
          : "offline",
    }));
  res.json(devices);
});

router.post("/api/iot-devices", (req, res) => {
  const deviceId = String(req.body.device_id || "").trim();
  const name = String(req.body.name || "").trim();
  const calibrationDate =
    String(req.body.calibration_date || "").trim() || null;
  if (!deviceId || !name)
    return res
      .status(400)
      .json({ error: "Device ID and name/location are required." });
  if (calibrationDate && !/^\d{4}-\d{2}-\d{2}$/.test(calibrationDate))
    return res.status(400).json({ error: "Calibration date is invalid." });
  const duplicate = db
    .prepare("SELECT id FROM iot_devices WHERE lower(device_id)=lower(?)")
    .get(deviceId);
  if (duplicate)
    return res
      .status(409)
      .json({ error: "A device with this ID already exists." });
  const apiKey = crypto.randomBytes(24).toString("hex");
  const result = db
    .prepare(
      "INSERT INTO iot_devices (device_id, name, api_key, status, calibration_date) VALUES (?, ?, ?, 'offline', ?)",
    )
    .run(deviceId, name, apiKey, calibrationDate);
  logAudit(
    req,
    "CREATE",
    "iot_device",
    result.lastInsertRowid,
    null,
    JSON.stringify({
      device_id: deviceId,
      name,
      calibration_date: calibrationDate,
    }),
  );
  res.status(201).json({ success: true, api_key: apiKey });
});

router.put("/api/iot-devices/:id", (req, res) => {
  const device = db
    .prepare("SELECT * FROM iot_devices WHERE id=?")
    .get(req.params.id);
  if (!device) return res.status(404).json({ error: "IoT device not found." });
  const deviceId = String(req.body.device_id || "").trim();
  const name = String(req.body.name || "").trim();
  const calibrationDate =
    String(req.body.calibration_date || "").trim() || null;
  if (!deviceId || !name)
    return res
      .status(400)
      .json({ error: "Device ID and name/location are required." });
  if (calibrationDate && !/^\d{4}-\d{2}-\d{2}$/.test(calibrationDate))
    return res.status(400).json({ error: "Calibration date is invalid." });
  const duplicate = db
    .prepare(
      "SELECT id FROM iot_devices WHERE lower(device_id)=lower(?) AND id!=?",
    )
    .get(deviceId, req.params.id);
  if (duplicate)
    return res
      .status(409)
      .json({ error: "A device with this ID already exists." });
  db.prepare(
    "UPDATE iot_devices SET device_id=?, name=?, calibration_date=? WHERE id=?",
  ).run(deviceId, name, calibrationDate, req.params.id);
  logAudit(
    req,
    "UPDATE",
    "iot_device",
    device.id,
    JSON.stringify(device),
    JSON.stringify({
      device_id: deviceId,
      name,
      calibration_date: calibrationDate,
    }),
  );
  res.json({ success: true });
});

router.delete("/api/iot-devices/:id", (req, res) => {
  const device = db
    .prepare("SELECT * FROM iot_devices WHERE id=?")
    .get(req.params.id);
  if (!device) return res.status(404).json({ error: "IoT device not found." });
  db.prepare("DELETE FROM iot_devices WHERE id=?").run(req.params.id);
  logAudit(
    req,
    "DELETE",
    "iot_device",
    device.id,
    JSON.stringify(device),
    null,
  );
  res.json({ success: true });
});

router.post("/api/iot-devices/:id/api-key", (req, res) => {
  const device = db
    .prepare("SELECT id FROM iot_devices WHERE id=?")
    .get(req.params.id);
  if (!device) return res.status(404).json({ error: "IoT device not found." });
  const apiKey = crypto.randomBytes(24).toString("hex");
  db.prepare("UPDATE iot_devices SET api_key=? WHERE id=?").run(
    apiKey,
    device.id,
  );
  logAudit(
    req,
    "GENERATE_API_KEY",
    "iot_device",
    device.id,
    null,
    "API key regenerated",
  );
  res.json({ success: true, api_key: apiKey });
});

// A-08 Waste Analytics.
router.get("/waste", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin", "waste.html"));
});

router.get("/api/waste-analytics", (req, res) => {
  const range = validateDateRange(req.query.start, req.query.end);
  if (range.error) return res.status(400).json({ error: range.error });
  const device = String(req.query.device || "").trim();

  let where =
    "substr(recorded_at, 1, 10) >= ? AND substr(recorded_at, 1, 10) <= ?";
  const values = [range.start, range.end];
  if (device) {
    where += " AND device_id = ?";
    values.push(device);
  }

  const summary = db
    .prepare(
      `SELECT COALESCE(SUM(weight), 0) AS total,
      COUNT(*) AS count,
      COALESCE(AVG(weight), 0) AS average,
      COALESCE(MAX(weight), 0) AS peak
     FROM waste_logs WHERE ${where}`,
    )
    .get(...values);

  const daily = db
    .prepare(
      `SELECT substr(recorded_at, 1, 10) AS date,
      COALESCE(SUM(weight), 0) AS total,
      COUNT(*) AS count
     FROM waste_logs WHERE ${where}
     GROUP BY substr(recorded_at, 1, 10)
     ORDER BY date ASC`,
    )
    .all(...values);

  const byDevice = db
    .prepare(
      `SELECT device_id,
      COALESCE(SUM(weight), 0) AS total,
      COUNT(*) AS count,
      COALESCE(AVG(weight), 0) AS average
     FROM waste_logs
     WHERE substr(recorded_at, 1, 10) >= ? AND substr(recorded_at, 1, 10) <= ?
     GROUP BY device_id ORDER BY total DESC`,
    )
    .all(range.start, range.end);

  const logs = db
    .prepare(
      `SELECT id, device_id, weight, recorded_at, processing_status
     FROM waste_logs WHERE ${where}
     ORDER BY recorded_at DESC, id DESC LIMIT 500`,
    )
    .all(...values);

  res.json({
    range: { start: range.start, end: range.end },
    summary: {
      ...summary,
      total: Number(summary.total),
      average: Number(summary.average),
      peak: Number(summary.peak),
    },
    daily: daily.map((row) => ({ ...row, total: Number(row.total) })),
    byDevice: byDevice.map((row) => ({
      ...row,
      total: Number(row.total),
      average: Number(row.average),
    })),
    logs: logs.map((row) => ({ ...row, weight: Number(row.weight) })),
  });
});

// A-08 Reports with server-side range and report-type validation.
router.get("/reports", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin", "reports.html"));
});

router.get("/api/reports/:type", (req, res) => {
  const reportType = String(req.params.type || "");
  const allowed = ["sales", "transactions", "inventory", "waste", "payroll"];
  if (!allowed.includes(reportType))
    return res.status(400).json({ error: "Invalid report type." });

  const range = validateDateRange(req.query.start, req.query.end);
  if (range.error) return res.status(400).json({ error: range.error });
  const report = buildReport(reportType, range.start, range.end);

  if (req.query.export === "csv") {
    const csv = toCsv(report.columns, report.rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportType}-${range.start}-to-${range.end}.csv"`,
    );
    logAudit(
      req,
      "EXPORT_REPORT",
      "report",
      reportType,
      null,
      JSON.stringify({
        start: range.start,
        end: range.end,
        rows: report.rows.length,
      }),
    );
    return res.send(csv);
  }

  logAudit(
    req,
    "GENERATE_REPORT",
    "report",
    reportType,
    null,
    JSON.stringify({
      start: range.start,
      end: range.end,
      rows: report.rows.length,
    }),
  );
  res.json({
    type: reportType,
    range: { start: range.start, end: range.end },
    columns: report.columns,
    rows: report.rows,
    generatedAt: new Date().toISOString(),
  });
});

// Compatibility routes retained for older approve/decline form links.
router.post("/users/:id/approve", (req, res) => {
  db.prepare(
    "UPDATE users SET status='approved', is_active=1 WHERE id=? AND status='pending'",
  ).run(req.params.id);
  res.redirect("/admin/users");
});
router.post("/users/:id/decline", (req, res) => {
  db.prepare(
    "UPDATE users SET status='declined' WHERE id=? AND status='pending'",
  ).run(req.params.id);
  res.redirect("/admin/users");
});

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validateDateRange(startValue, endValue) {
  const start = String(startValue || "").trim();
  const end = String(endValue || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
    return { error: "Start and end dates must use YYYY-MM-DD format." };
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return { error: "Start or end date is invalid." };
  if (
    startDate.toISOString().slice(0, 10) !== start ||
    endDate.toISOString().slice(0, 10) !== end
  )
    return { error: "Start or end date is invalid." };
  if (endDate < startDate)
    return { error: "End date cannot be before start date." };
  const days = (endDate - startDate) / 86400000;
  if (days > 366) return { error: "Date range cannot exceed 366 days." };
  return { start, end };
}

function buildReport(type, start, end) {
  if (type === "sales") {
    const rows = db
      .prepare(
        `SELECT substr(transaction_date, 1, 10) AS date,
        COUNT(*) AS transaction_count,
        COALESCE(SUM(total), 0) AS sales_total
       FROM transactions
       WHERE status='completed' AND substr(transaction_date, 1, 10) >= ? AND substr(transaction_date, 1, 10) <= ?
       GROUP BY substr(transaction_date, 1, 10) ORDER BY date ASC`,
      )
      .all(start, end)
      .map((row) => ({ ...row, sales_total: Number(row.sales_total) }));
    return { columns: ["Date", "Transaction Count", "Sales Total"], rows };
  }
  if (type === "transactions") {
    const rows = db
      .prepare(
        `SELECT transaction_code, transaction_date, payment_method, status, total
       FROM transactions
       WHERE substr(transaction_date, 1, 10) >= ? AND substr(transaction_date, 1, 10) <= ?
       ORDER BY transaction_date DESC`,
      )
      .all(start, end)
      .map((row) => ({ ...row, total: Number(row.total) }));
    return {
      columns: [
        "Transaction Code",
        "Transaction Date",
        "Payment Method",
        "Status",
        "Total",
      ],
      rows,
    };
  }
  if (type === "inventory") {
    const rows = db
      .prepare(
        "SELECT name, category, unit, quantity, reorder_level FROM inventory_items ORDER BY name ASC",
      )
      .all()
      .map((row) => ({
        ...row,
        quantity: Number(row.quantity),
        reorder_level: Number(row.reorder_level),
      }));
    return {
      columns: ["Name", "Category", "Unit", "Quantity", "Reorder Level"],
      rows,
    };
  }
  if (type === "waste") {
    const rows = db
      .prepare(
        `SELECT substr(recorded_at, 1, 10) AS date, device_id,
        COUNT(*) AS reading_count, COALESCE(SUM(weight), 0) AS total_weight
       FROM waste_logs
       WHERE substr(recorded_at, 1, 10) >= ? AND substr(recorded_at, 1, 10) <= ?
       GROUP BY substr(recorded_at, 1, 10), device_id ORDER BY date ASC, device_id ASC`,
      )
      .all(start, end)
      .map((row) => ({ ...row, total_weight: Number(row.total_weight) }));
    return {
      columns: ["Date", "Device ID", "Reading Count", "Total Weight"],
      rows,
    };
  }
  const rows = db
    .prepare(
      `SELECT p.cycle_start, p.cycle_end, e.employee_id, e.full_name, p.days_worked,
      p.hours_worked, p.gross_pay, p.adjustments, p.deductions_json, p.net_pay, p.status
     FROM payroll_records p JOIN employees e ON e.id=p.employee_id
     WHERE p.cycle_end >= ? AND p.cycle_start <= ? ORDER BY p.cycle_end DESC`,
    )
    .all(start, end)
    .map((row) => ({
      ...row,
      gross_pay: Number(row.gross_pay),
      adjustments: Number(row.adjustments),
      net_pay: Number(row.net_pay),
    }));
  return {
    columns: [
      "Cycle Start",
      "Cycle End",
      "Employee ID",
      "Employee",
      "Days Worked",
      "Hours Worked",
      "Gross Pay",
      "Adjustments",
      "Deductions",
      "Net Pay",
      "Status",
    ],
    rows,
  };
}

function toCsv(columns, rows) {
  const escape = (value) => {
    let text = value == null ? "" : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const keys = Object.keys(rows[0] || {});
  const lines = [
    columns.map(escape).join(","),
    ...rows.map((row) => keys.map((key) => escape(row[key])).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n");
}

function validateEmployee(body) {
  const employee_id = String(body.employee_id || "").trim();
  const full_name = String(body.full_name || "").trim();
  const position = String(body.position || "").trim();
  const contact_number = String(body.contact_number || "").trim();
  const rate = Number(body.rate);
  const rate_type = String(body.rate_type || "");
  const status = String(body.status || "");
  const date_hired = String(body.date_hired || "");
  if (!employee_id || !full_name || !position || !date_hired)
    return {
      error: "Employee ID, name, position, and date hired are required.",
    };
  if (!Number.isFinite(rate) || rate < 0)
    return { error: "Enter a valid non-negative rate." };
  if (!["daily", "hourly"].includes(rate_type))
    return { error: "Select a valid rate type." };
  if (!["active", "inactive"].includes(status))
    return { error: "Select a valid employee status." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date_hired))
    return { error: "Enter a valid date hired." };
  return {
    employee_id,
    full_name,
    position,
    rate,
    rate_type,
    contact_number,
    status,
    date_hired,
  };
}

function validateAttendance(body) {
  const employee_id = Number(body.employee_id);
  const attendance_date = String(body.attendance_date || "").trim();
  const time_in = String(body.time_in || "").trim() || null;
  const time_out = String(body.time_out || "").trim() || null;
  const status = String(body.status || "");
  if (!Number.isInteger(employee_id) || employee_id <= 0)
    return { error: "Select an employee." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(attendance_date))
    return { error: "Select a valid attendance date." };
  if (!["present", "late", "absent", "leave"].includes(status))
    return { error: "Select a valid attendance status." };
  let hours_worked = 0;
  if (time_in && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time_in))
    return { error: "Enter a valid time-in." };
  if (time_out && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time_out))
    return { error: "Enter a valid time-out." };
  if (time_in && time_out) {
    const minutes = minutesFromTime(time_out) - minutesFromTime(time_in);
    if (minutes <= 0) return { error: "Time-out must be later than time-in." };
    hours_worked = Math.round((minutes / 60) * 100) / 100;
  }
  return {
    employee_id,
    attendance_date,
    time_in,
    time_out,
    status,
    hours_worked,
  };
}

function minutesFromTime(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new Error("Invalid time");
  return Number(match[1]) * 60 + Number(match[2]);
}

function logAudit(req, action, recordType, recordId, oldValue, newValue) {
  db.prepare(
    `INSERT INTO audit_log (user_id, action, record_type, record_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    req.session.user?.id || null,
    action,
    recordType,
    String(recordId),
    oldValue,
    newValue,
  );
}

function nonNegativeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100) / 100
    : 0;
}

function formatMoney(value) {
  return `PHP ${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function validateInventoryItem(body) {
  const name = String(body.name || "").trim();
  const category = String(body.category || "").trim();
  const unit = String(body.unit || "").trim();
  const quantity = Number(body.quantity);
  const reorder_level = Number(body.reorder_level);
  if (!name || !category || !unit)
    return { error: "Name, category, and unit are required." };
  if (!Number.isFinite(quantity) || quantity < 0)
    return { error: "Quantity on hand must be zero or greater." };
  if (!Number.isFinite(reorder_level) || reorder_level < 0)
    return { error: "Reorder level must be zero or greater." };
  return {
    name,
    category,
    unit,
    quantity: Math.round(quantity * 100) / 100,
    reorder_level: Math.round(reorder_level * 100) / 100,
  };
}

function validateMovement(body) {
  const item_id = Number(body.item_id);
  const movement_type = String(body.movement_type || "");
  const quantity = Number(body.quantity);
  const movement_date = String(body.movement_date || "").trim();
  const reason = String(body.reason || "").trim();
  if (!Number.isInteger(item_id) || item_id <= 0)
    return { error: "Select a valid inventory item." };
  if (!["in", "out"].includes(movement_type))
    return { error: "Select Stock-In or Stock-Out." };
  if (!Number.isFinite(quantity) || quantity <= 0)
    return { error: "Movement quantity must be greater than zero." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(movement_date))
    return { error: "Select a valid movement date." };
  return {
    item_id,
    movement_type,
    quantity: Math.round(quantity * 100) / 100,
    movement_date,
    reason,
  };
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
}

module.exports = router;
module.exports.requireAdmin = requireAdmin;
