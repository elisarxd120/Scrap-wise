const path = require("path");
const express = require("express");
const db = require("../models/database");

const router = express.Router();

// All Kitchen pages and APIs allow logged-in Kitchen Staff and Admin users.
function requireKitchenAccess(req, res, next) {
  if (!req.session.user) return res.redirect("/");
  if (!["Kitchen Staff", "Admin"].includes(req.session.user.role)) {
    return res.redirect("/");
  }
  next();
}

router.use(requireKitchenAccess);

router.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "kitchen", "dashboard.html"));
});

router.get("/stock", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "kitchen", "stock.html"));
});

router.get("/inventory", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "kitchen", "inventory.html"));
});

router.get("/waste", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "kitchen", "waste.html"));
});

router.get("/processing", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "kitchen", "processing.html"));
});

router.get("/alerts", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "kitchen", "alerts.html"));
});

router.get("/guide", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "kitchen", "guide.html"));
});

router.get("/nav.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "kitchen", "nav.html"));
});

router.use(express.static(path.join(__dirname, "..", "public", "kitchen")));

router.get("/api/nav", (req, res) => {
  const unreadAlerts = db
    .prepare("SELECT COUNT(*) AS count FROM alerts WHERE is_read = 0")
    .get().count;
  res.json({
    staffName: req.session.user.full_name,
    unreadAlerts,
    lowStockBanner: lowStockItems().length > 0,
  });
});

router.get("/api/dashboard", (req, res) => {
  const today = localDateString(new Date());
  const lowStock = lowStockItems();
  const wasteToday =
    db
      .prepare(
        "SELECT COALESCE(SUM(weight), 0) AS value FROM waste_logs WHERE substr(recorded_at, 1, 10) = ?",
      )
      .get(today).value || 0;

  const limit = getSettingNumber("waste_capacity_kg", 50);
  const warningPercent = getSettingNumber("waste_warning_percent", 80);
  const capacity = limit > 0 ? Math.min(100, Math.round((wasteToday / limit) * 100)) : 0;
  const latest = db
    .prepare(
      "SELECT processing_status FROM waste_logs ORDER BY recorded_at DESC, id DESC LIMIT 1",
    )
    .get();

  const capacityAlerts = db
    .prepare(
      "SELECT id, alert_type, message, is_read, created_at FROM alerts WHERE lower(alert_type) IN ('capacity','capacity-warning','capacity-limit','capacity warning','capacity limit reached') OR lower(message) LIKE '%capacity%' ORDER BY created_at DESC LIMIT 3",
    )
    .all();
  const lowAlerts = db
    .prepare(
      "SELECT id, alert_type, message, is_read, created_at FROM alerts WHERE lower(alert_type) = 'low-stock' OR lower(message) LIKE '%low stock%' OR lower(message) LIKE '%reorder level%' ORDER BY created_at DESC LIMIT 3",
    )
    .all();
  const recentAlerts = [...capacityAlerts, ...lowAlerts]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .filter((alert, index, list) => list.findIndex((item) => item.id === alert.id) === index)
    .slice(0, 5);

  res.json({
    cards: {
      lowStockCount: lowStock.length,
      wasteToday: Number(Number(wasteToday).toFixed(2)),
      capacity,
      capacityWarningPercent: warningPercent,
      processingStatus: formatProcessingStatus(latest?.processing_status),
    },
    lowStockItems: lowStock,
    recentAlerts,
  });
});

router.get("/api/alerts/unread", (req, res) => {
  const alerts = db
    .prepare(
      "SELECT id, alert_type, message, is_read, created_at FROM alerts WHERE is_read = 0 ORDER BY created_at DESC LIMIT 20",
    )
    .all();
  res.json({ count: alerts.length, alerts });
});

router.get("/api/alerts", (req, res) => {
  const alerts = db
    .prepare(
      "SELECT id, alert_type, message, is_read, created_at FROM alerts ORDER BY created_at DESC LIMIT 100",
    )
    .all();
  res.json({ alerts, unreadCount: alerts.filter((alert) => Number(alert.is_read) === 0).length });
});

router.post("/api/alerts/:id/read", (req, res) => {
  const result = db.prepare("UPDATE alerts SET is_read = 1 WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Alert not found." });
  res.json({ success: true });
});

router.post("/api/alerts/read-all", (req, res) => {
  db.prepare("UPDATE alerts SET is_read = 1 WHERE is_read = 0").run();
  res.json({ success: true });
});

router.get("/api/waste", (req, res) => {
  const logs = db
    .prepare(
      `SELECT id, device_id, weight, recorded_at, processing_status,
              before_weight, after_weight, recorded_by
       FROM waste_logs ORDER BY recorded_at DESC, id DESC LIMIT 100`,
    )
    .all();
  const devices = db
    .prepare(
      "SELECT id, device_id, name, status, last_reading, last_received_at FROM iot_devices ORDER BY name ASC",
    )
    .all();
  res.json({ logs, devices });
});

router.post("/api/waste/loading", (req, res) => {
  const deviceId = String(req.body.device_id || "").trim();
  const weight = Number(req.body.weight);
  const recordedAt = String(req.body.recorded_at || "").trim();
  if (!deviceId) return res.status(400).json({ error: "Select a waste device." });
  if (!Number.isFinite(weight) || weight < 0) {
    return res.status(400).json({ error: "Weight must be zero or greater." });
  }
  if (!recordedAt || Number.isNaN(Date.parse(recordedAt))) {
    return res.status(400).json({ error: "Select a valid loading date and time." });
  }
  const device = db.prepare("SELECT * FROM iot_devices WHERE device_id = ?").get(deviceId);
  if (!device) return res.status(400).json({ error: "Select a valid waste device." });
  const receivedAt = new Date(recordedAt).toISOString();
  const transaction = db.transaction(() => {
    const result = db.prepare(
      `INSERT INTO waste_logs
       (device_id, weight, recorded_at, processing_status, recorded_by)
       VALUES (?, ?, ?, 'recorded', ?)`,
    ).run(deviceId, weight, receivedAt, req.session.user.id);
    db.prepare(
      "UPDATE iot_devices SET status='online', last_reading=?, last_received_at=? WHERE id=?",
    ).run(weight, receivedAt, device.id);

    const capacity = getSettingNumber("waste_capacity_kg", 50);
    const warningPercent = Math.min(100, Math.max(1, getSettingNumber("waste_warning_percent", 80)));
    if (capacity > 0) {
      const date = localDateString(new Date(receivedAt));
      const todayWaste = db
        .prepare("SELECT COALESCE(SUM(weight), 0) AS total FROM waste_logs WHERE substr(recorded_at, 1, 10) = ?")
        .get(date).total || 0;
      const threshold = capacity * warningPercent / 100;
      if (todayWaste >= threshold) {
        const existing = db
          .prepare("SELECT id FROM alerts WHERE alert_type='waste-capacity' AND is_read=0 AND message LIKE ? LIMIT 1")
          .get(`%${deviceId}%`);
        if (!existing) {
          db.prepare("INSERT INTO alerts (alert_type, message, is_read) VALUES (?, ?, 0)")
            .run(
              "waste-capacity",
              `${deviceId} waste loading reached the ${warningPercent}% capacity threshold (${formatQuantity(todayWaste)} kg today).`,
            );
        }
      }
    }
    logAudit(req, "CREATE", "waste_log", result.lastInsertRowid,
      null, JSON.stringify({ device_id: deviceId, weight, recorded_at: receivedAt }));
  });
  transaction();
  res.status(201).json({ success: true, message: `${formatQuantity(weight)} kg waste loading saved.` });
});

router.get("/api/processing", (req, res) => {
  const date = String(req.query.date || "").trim() || localDateString(new Date());
  const logs = db
    .prepare(
      `SELECT id, device_id, weight, recorded_at, processing_status,
              before_weight, after_weight, recorded_by
       FROM waste_logs
       WHERE substr(recorded_at, 1, 10) = ?
       ORDER BY recorded_at DESC, id DESC`,
    )
    .all(date);
  res.json({ logs, date });
});

router.put("/api/processing/:id", (req, res) => {
  const status = String(req.body.processing_status || "").trim().toLowerCase();
  const beforeWeight = Number(req.body.before_weight);
  const afterWeight = Number(req.body.after_weight);
  if (!["recorded", "processing", "processed"].includes(status)) {
    return res.status(400).json({ error: "Select a valid processing status." });
  }
  const before = Number.isFinite(beforeWeight) && beforeWeight >= 0 ? beforeWeight : null;
  const after = Number.isFinite(afterWeight) && afterWeight >= 0 ? afterWeight : null;
  const oldLog = db.prepare("SELECT * FROM waste_logs WHERE id = ?").get(req.params.id);
  if (!oldLog) return res.status(404).json({ error: "Waste log not found." });
  db.prepare(
    `UPDATE waste_logs
     SET processing_status=?, before_weight=?, after_weight=?, recorded_by=COALESCE(recorded_by, ?)
     WHERE id=?`,
  ).run(status, before, after, req.session.user.id, req.params.id);
  logAudit(req, "UPDATE", "waste_log", req.params.id,
    JSON.stringify(oldLog),
    JSON.stringify({ processing_status: status, before_weight: before, after_weight: after }));
  res.json({ success: true, message: "Processing status updated." });
});

router.get("/api/inventory", (req, res) => {
  const search = String(req.query.search || "").trim().toLowerCase();
  const category = String(req.query.category || "").trim().toLowerCase();
  const lowOnly = String(req.query.low_only || "") === "1";
  let sql = "SELECT * FROM inventory_items WHERE 1=1";
  const values = [];
  if (search) {
    sql += " AND (lower(name) LIKE ? OR lower(category) LIKE ? OR lower(unit) LIKE ?)";
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) {
    sql += " AND lower(category) = ?";
    values.push(category);
  }
  sql += " ORDER BY CASE WHEN quantity <= reorder_level THEN 0 ELSE 1 END, quantity ASC, name ASC";
  const items = db.prepare(sql).all(...values).map(item => ({
    ...item,
    status: item.quantity <= 0 ? "Out of Stock" : item.quantity <= item.reorder_level ? "Low" : "In Stock",
  })).filter(item => !lowOnly || item.quantity <= item.reorder_level);
  res.json(items);
});

router.get("/api/inventory/items", (req, res) => {
  const items = db
    .prepare("SELECT id, name, category, unit, quantity, reorder_level FROM inventory_items ORDER BY name ASC")
    .all();
  res.json(items);
});

router.get("/api/stock/movements/today", (req, res) => {
  const today = localDateString(new Date());
  const movements = db.prepare(
    `SELECT m.id, m.item_id, m.movement_type, m.quantity, m.movement_date,
            m.reason, m.created_at, i.name AS item_name, i.unit
     FROM stock_movements m JOIN inventory_items i ON i.id = m.item_id
     WHERE m.recorded_by = ? AND m.movement_date = ?
     ORDER BY m.created_at DESC, m.id DESC`,
  ).all(req.session.user.id, today);
  res.json(movements);
});

router.post("/api/stock/movements", (req, res) => {
  const movement = validateKitchenMovement(req.body);
  if (movement.error) return res.status(400).json({ error: movement.error });
  const today = localDateString(new Date());
  if (movement.movement_date !== today) {
    return res.status(400).json({ error: "Stock movements can only be saved for today." });
  }
  const item = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(movement.item_id);
  if (!item) return res.status(400).json({ error: "Select a valid inventory item." });
  const newQuantity = Number(item.quantity) + (movement.movement_type === "in" ? movement.quantity : -movement.quantity);
  if (newQuantity < 0) {
    return res.status(400).json({ error: `Stock Out is too large. Only ${formatQuantity(item.quantity)} ${item.unit} is available.` });
  }
  const transaction = db.transaction(() => {
    const result = db.prepare(
      "INSERT INTO stock_movements (item_id, movement_type, quantity, movement_date, reason, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(movement.item_id, movement.movement_type, movement.quantity, movement.movement_date, movement.reason, req.session.user.id, new Date().toISOString());
    db.prepare("UPDATE inventory_items SET quantity = ? WHERE id = ?").run(newQuantity, movement.item_id);
    logAudit(req, "CREATE", "stock_movement", result.lastInsertRowid,
      JSON.stringify({ quantity: item.quantity }),
      JSON.stringify({ quantity: newQuantity, movement_type: movement.movement_type }));
  });
  transaction();
  const label = movement.movement_type === "in" ? "Stock-in" : "Stock-out";
  res.status(201).json({ success: true, message: `${label} saved: ${formatQuantity(movement.quantity)} ${item.unit} ${item.name}` });
});

router.put("/api/stock/movements/:id", (req, res) => {
  const oldMovement = db.prepare("SELECT * FROM stock_movements WHERE id = ?").get(req.params.id);
  if (!oldMovement) return res.status(404).json({ error: "Stock movement not found." });
  if (Number(oldMovement.recorded_by) !== Number(req.session.user.id)) {
    return res.status(403).json({ error: "You can update only your own stock movements." });
  }
  const today = localDateString(new Date());
  if (oldMovement.movement_date !== today) {
    return res.status(403).json({ error: "You can update a movement only from today." });
  }
  const movement = validateKitchenMovement(req.body);
  if (movement.error) return res.status(400).json({ error: movement.error });
  if (movement.movement_date !== today) return res.status(400).json({ error: "Movement date must be today." });

  const oldItem = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(oldMovement.item_id);
  const targetItem = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(movement.item_id);
  if (!oldItem || !targetItem) return res.status(400).json({ error: "Select a valid inventory item." });

  try {
    const transaction = db.transaction(() => {
      const rolledBack = Number(oldItem.quantity) - (oldMovement.movement_type === "in" ? Number(oldMovement.quantity) : -Number(oldMovement.quantity));
      let oldItemQuantity = rolledBack;
      if (oldMovement.item_id !== movement.item_id) {
        db.prepare("UPDATE inventory_items SET quantity = ? WHERE id = ?").run(oldItemQuantity, oldMovement.item_id);
        const targetQuantity = Number(targetItem.quantity) + (movement.movement_type === "in" ? movement.quantity : -movement.quantity);
        if (targetQuantity < 0) throw new Error("not enough stock");
        db.prepare("UPDATE inventory_items SET quantity = ? WHERE id = ?").run(targetQuantity, movement.item_id);
      } else {
        const newQuantity = rolledBack + (movement.movement_type === "in" ? movement.quantity : -movement.quantity);
        if (newQuantity < 0) throw new Error("not enough stock");
        db.prepare("UPDATE inventory_items SET quantity = ? WHERE id = ?").run(newQuantity, movement.item_id);
      }
      db.prepare(
        "UPDATE stock_movements SET item_id=?, movement_type=?, quantity=?, movement_date=?, reason=? WHERE id=?",
      ).run(movement.item_id, movement.movement_type, movement.quantity, movement.movement_date, movement.reason, req.params.id);
      logAudit(req, "UPDATE", "stock_movement", req.params.id,
        JSON.stringify(oldMovement), JSON.stringify(movement));
    });
    transaction();
  } catch (error) {
    return res.status(400).json({ error: "Stock Out is too large for the available quantity. The movement was not changed." });
  }
  res.json({ success: true, message: "Stock movement updated and inventory corrected." });
});

function lowStockItems() {
  return db
    .prepare(
      "SELECT id, name, category, unit, quantity, reorder_level FROM inventory_items WHERE quantity <= reorder_level ORDER BY quantity ASC, name ASC",
    )
    .all();
}

function getSettingNumber(key, fallback) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  const value = Number(row?.value);
  return Number.isFinite(value) ? value : fallback;
}

function formatProcessingStatus(status) {
  if (!status) return "Loaded";
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "completed" || normalized === "complete") return "Completed";
  if (normalized === "processing" || normalized === "processed") return "Processing";
  return "Loaded";
}

function validateKitchenMovement(body) {
  const item_id = Number(body.item_id);
  const movement_type = String(body.movement_type || "").trim();
  const quantity = Number(body.quantity);
  const movement_date = String(body.movement_date || "").trim();
  const reason = String(body.reason || "").trim().slice(0, 300);
  if (!Number.isInteger(item_id) || item_id <= 0) {
    return { error: "Select a valid inventory item." };
  }
  if (!["in", "out"].includes(movement_type)) {
    return { error: "Select Stock In or Stock Out." };
  }
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) {
    return { error: "Quantity must be greater than zero." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(movement_date)) {
    return { error: "Select a valid date." };
  }
  return {
    item_id,
    movement_type,
    quantity: Math.round(quantity * 100) / 100,
    movement_date,
    reason,
  };
}

function formatQuantity(value) {
  return Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

function logAudit(req, action, recordType, recordId, oldValue, newValue) {
  db.prepare(
    "INSERT INTO audit_log (user_id, action, record_type, record_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    req.session.user?.id || null,
    action,
    recordType,
    String(recordId),
    oldValue,
    newValue,
  );
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

module.exports = router;
