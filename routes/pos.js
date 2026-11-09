const path = require("path");
const express = require("express");
const db = require("../models/database");

const router = express.Router();

function requirePos(req, res, next) {
  if (!req.session.user) return res.redirect("/");
  if (req.session.user.role !== "POS Staff") {
    return res.status(403).send("Forbidden");
  }
  next();
}

router.use(requirePos);

router.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "pos", "dashboard.html"));
});

router.get("/api/menu", (req, res) => {
  res.json(
    db
      .prepare(
        "SELECT id, name, price, is_available FROM menu_items ORDER BY name ASC",
      )
      .all()
      .map((item) => ({ ...item, price: Number(item.price) })),
  );
});

router.get("/api/session", (req, res) => {
  res.json({
    full_name: req.session.user.full_name,
    role: req.session.user.role,
  });
});

router.put("/api/menu/:id", (req, res) => {
  const menuItem = db
    .prepare("SELECT * FROM menu_items WHERE id=?")
    .get(req.params.id);
  if (!menuItem) return res.status(404).json({ error: "Menu item not found." });

  const name = String(req.body.name || "").trim();
  const price = Number(req.body.price);
  const isAvailable = req.body.is_available === true ? 1 : 0;
  if (!name) return res.status(400).json({ error: "Menu item name is required." });
  if (!Number.isFinite(price) || price < 0)
    return res.status(400).json({ error: "Price must be zero or greater." });
  const duplicate = db
    .prepare("SELECT id FROM menu_items WHERE lower(name)=lower(?) AND id<>?")
    .get(name, req.params.id);
  if (duplicate)
    return res.status(409).json({ error: "That menu item name already exists." });

  db.prepare(
    "UPDATE menu_items SET name=?, price=?, is_available=? WHERE id=?",
  ).run(name, price, isAvailable, req.params.id);
  res.json({ success: true });
});

router.get("/api/orders", (req, res) => {
  const orders = db
    .prepare(
      `SELECT * FROM pos_orders WHERE cashier_id=? AND status='held'
       ORDER BY order_date DESC, id DESC`,
    )
    .all(req.session.user.id);
  res.json(
    orders.map((order) => ({
      ...order,
      items: db
        .prepare(
          "SELECT id, menu_item_id, item_name, quantity, unit_price, subtotal FROM pos_order_items WHERE order_id=? ORDER BY id ASC",
        )
        .all(order.id),
    })),
  );
});

router.get("/api/summary", (req, res) => {
  const today = new Date();
  const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}T00:00:00.000`;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const end = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}T00:00:00.000`;
  const rows = db
    .prepare(
      `SELECT id, transaction_code, transaction_date, total, payment_method, status
       FROM transactions WHERE cashier_id=? AND transaction_date>=? AND transaction_date<? AND status='completed'
       ORDER BY transaction_date DESC, id DESC`,
    )
    .all(req.session.user.id, start, end);
  const sales = rows.reduce((sum, row) => sum + Number(row.total), 0);
  res.json({ sales, count: rows.length, transactions: rows });
});

function validateDiscount(value) {
  const percentage = Number(value ?? 0);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)
    return NaN;
  return Math.round(percentage * 100) / 100;
}

function applyDiscount(subtotal, percentage) {
  return Math.round(subtotal * (1 - percentage / 100) * 100) / 100;
}

function validateItems(body) {
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: "Add at least one menu item." };
  }
  const normalized = [];
  for (const entry of body.items) {
    const menuItem = db
      .prepare(
        "SELECT id, name, price, is_available FROM menu_items WHERE id=?",
      )
      .get(Number(entry.menu_item_id));
    if (!menuItem) return { error: "One of the menu items no longer exists." };
    if (menuItem.is_available !== 1)
      return { error: `${menuItem.name} is unavailable.` };
    const quantity = Number(entry.quantity);
    if (!Number.isInteger(quantity) || quantity < 1)
      return { error: "Quantities must be whole numbers of at least 1." };
    normalized.push({
      menu_item_id: menuItem.id,
      item_name: menuItem.name,
      quantity,
      unit_price: Number(menuItem.price),
      subtotal: Math.round(Number(menuItem.price) * quantity * 100) / 100,
    });
  }
  return { items: normalized };
}

router.post("/api/orders", (req, res) => {
  const orderType = String(req.body.order_type || "");
  if (!["dine-in", "take-out"].includes(orderType))
    return res.status(400).json({ error: "Select Dine-in or Take-out." });
  const tableNumber = String(req.body.table_number || "").trim();
  if (orderType === "dine-in" && !tableNumber)
    return res.status(400).json({ error: "Enter a table number for Dine-in." });
  const validated = validateItems(req.body);
  if (validated.error)
    return res.status(400).json({ error: validated.error });
  const total =
    Math.round(
      validated.items.reduce((sum, item) => sum + item.subtotal, 0) * 100,
    ) / 100;
  const code = `HLD-${Date.now().toString().slice(-8)}`;
  const createdAt = new Date().toISOString();
  const write = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO pos_orders
         (order_code, order_date, cashier_id, order_type, table_number, total, status)
         VALUES (?, ?, ?, ?, ?, ?, 'held')`,
      )
      .run(code, createdAt, req.session.user.id, orderType, tableNumber, total);
    const insertItem = db.prepare(
      `INSERT INTO pos_order_items
       (order_id, menu_item_id, item_name, quantity, unit_price, subtotal)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    validated.items.forEach((item) =>
      insertItem.run(
        result.lastInsertRowid,
        item.menu_item_id,
        item.item_name,
        item.quantity,
        item.unit_price,
        item.subtotal,
      ),
    );
    return result.lastInsertRowid;
  });
  res.status(201).json({ id: write(), code });
});

router.post("/api/orders/:id/cancel", (req, res) => {
  const order = db
    .prepare("SELECT * FROM pos_orders WHERE id=? AND cashier_id=?")
    .get(req.params.id, req.session.user.id);
  if (!order) return res.status(404).json({ error: "Held order not found." });
  if (order.status !== "held")
    return res.status(409).json({ error: "Only held orders can be cancelled." });
  db.prepare("UPDATE pos_orders SET status='cancelled' WHERE id=?").run(order.id);
  res.json({ success: true });
});

router.post("/api/orders/:id/checkout", (req, res) => {
  const paymentMethod = String(req.body.payment_method || "").trim();
  const discountPercentage = validateDiscount(req.body.discount_percentage);
  if (!Number.isFinite(discountPercentage))
    return res.status(400).json({ error: "Discount must be between 0 and 100." });
  const allowed = ["Cash", "Card", "GCash", "PayMaya"];
  if (!allowed.includes(paymentMethod))
    return res.status(400).json({ error: "Select a valid payment method." });
  const order = db
    .prepare("SELECT * FROM pos_orders WHERE id=? AND cashier_id=?")
    .get(req.params.id, req.session.user.id);
  if (!order) return res.status(404).json({ error: "Held order not found." });
  if (order.status !== "held")
    return res.status(409).json({ error: "This order is no longer held." });
  const result = checkout(req, order, paymentMethod, discountPercentage);
  res.status(201).json(result);
});

router.post("/api/checkout", (req, res) => {
  const paymentMethod = String(req.body.payment_method || "").trim();
  const discountPercentage = validateDiscount(req.body.discount_percentage);
  if (!Number.isFinite(discountPercentage))
    return res.status(400).json({ error: "Discount must be between 0 and 100." });
  const allowed = ["Cash", "Card", "GCash", "PayMaya"];
  if (!allowed.includes(paymentMethod))
    return res.status(400).json({ error: "Select a valid payment method." });
  const orderType = String(req.body.order_type || "");
  if (!["dine-in", "take-out"].includes(orderType))
    return res.status(400).json({ error: "Select Dine-in or Take-out." });
  const tableNumber = String(req.body.table_number || "").trim();
  if (orderType === "dine-in" && !tableNumber)
    return res.status(400).json({ error: "Enter a table number for Dine-in." });
  const validated = validateItems(req.body);
  if (validated.error)
    return res.status(400).json({ error: validated.error });
  const total =
    Math.round(
      validated.items.reduce((sum, item) => sum + item.subtotal, 0) * 100,
    ) / 100;
  const order = {
    id: null,
    order_code: `ORD-${Date.now().toString().slice(-8)}`,
    order_type: orderType,
    table_number: orderType === "dine-in" ? String(req.body.table_number || "").trim() : "",
    subtotal: total,
    total: applyDiscount(total, discountPercentage),
    discount_percentage: discountPercentage,
  };
  const result = db.transaction(() => {
    const transaction = insertTransaction(req, order, paymentMethod, validated.items);
    return transaction;
  })();
  res.status(201).json(result);
});

function insertTransaction(req, order, paymentMethod, items) {
  const now = new Date().toISOString();
  const code = order.order_code;
  const result = db
    .prepare(
      `INSERT INTO transactions
       (transaction_code, transaction_date, cashier_id, total, payment_method, status)
       VALUES (?, ?, ?, ?, ?, 'completed')`,
    )
    .run(code, now, req.session.user.id, order.total, paymentMethod);
  const insertItem = db.prepare(
    `INSERT INTO transaction_items
     (transaction_id, item_id, item_name, quantity, unit_price, subtotal)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  items.forEach((item) =>
    insertItem.run(
      result.lastInsertRowid,
      item.menu_item_id,
      item.item_name,
      item.quantity,
      item.unit_price,
      item.subtotal,
    ),
  );
  return {
    id: result.lastInsertRowid,
    transaction_code: code,
    transaction_date: now,
    subtotal: order.subtotal ?? order.total,
    total: order.total,
    discount_percentage: order.discount_percentage ?? 0,
    payment_method: paymentMethod,
    order_type: order.order_type,
    table_number: order.table_number || "",
    items,
  };
}

function checkout(req, order, paymentMethod, discountPercentage) {
  const items = db
    .prepare(
      `SELECT menu_item_id, item_name, quantity, unit_price, subtotal
       FROM pos_order_items WHERE order_id=? ORDER BY id ASC`,
    )
    .all(order.id);
  return db.transaction(() => {
    const transaction = insertTransaction(
      req,
      {
        ...order,
        order_code: `ORD-${order.order_code.slice(-8)}`,
        subtotal: Number(order.total),
        total: applyDiscount(Number(order.total), discountPercentage),
        discount_percentage: discountPercentage,
      },
      paymentMethod,
      items,
    );
    db.prepare(
      "UPDATE pos_orders SET status='paid', paid_transaction_id=? WHERE id=?",
    ).run(transaction.id, order.id);
    return transaction;
  })();
}

module.exports = router;
