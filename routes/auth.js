const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../models/database");

const router = express.Router();

router.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password" });
  }

  if (user.status === "pending") {
    return res
      .status(403)
      .json({ error: "Your account is still pending admin approval" });
  }
  if (user.status === "declined") {
    return res.status(403).json({ error: "Your registration was declined" });
  }
  if (user.is_active === 0) {
    return res
      .status(403)
      .json({ error: "This account has been deactivated." });
  }

  req.session.user = {
    id: user.id,
    full_name: user.full_name,
    role: user.role,
  };
  if (user.must_change_password === 1) {
    return res.json({ redirect: "/change-password" });
  }
  res.json({ redirect: dashboardForRole(user.role) });
});

router.post("/change-password", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Please log in first." });
  const currentPassword = String(req.body.currentPassword || "");
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirmPassword || "");
  if (!password || !confirmPassword)
    return res
      .status(400)
      .json({ error: "New password and confirmation are required." });
  if (password.length < 6)
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters." });
  if (password !== confirmPassword)
    return res.status(400).json({ error: "Passwords do not match." });

  const user = db
    .prepare("SELECT * FROM users WHERE id=?")
    .get(req.session.user.id);
  if (!user) return res.status(401).json({ error: "Account not found." });
  if (
    !user.must_change_password &&
    currentPassword &&
    !bcrypt.compareSync(currentPassword, user.password_hash)
  ) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  db.prepare(
    "UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?",
  ).run(bcrypt.hashSync(password, 10), user.id);
  res.json({ redirect: dashboardForRole(user.role) });
});

router.post("/register", (req, res) => {
  const fullName = String(req.body.fullName || "").trim();
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirmPassword || "");
  const role = String(req.body.role || "");

  if (!fullName || !username || !password || !confirmPassword || !role) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (!["Kitchen Staff", "POS Staff"].includes(role)) {
    return res.status(400).json({ error: "Invalid role selected." });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (existing) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  db.prepare(
    `
    INSERT INTO users (full_name, username, password_hash, role, status)
    VALUES (?, ?, ?, ?, 'pending')
  `,
  ).run(fullName, username, bcrypt.hashSync(password, 10), role);

  res
    .status(201)
    .json({
      message:
        "Registration submitted. Please wait for the admin to approve your account.",
    });
});

router.post("/waste-readings", (req, res) => {
  const apiKey = String(req.get("x-api-key") || "").trim();
  const deviceId = String(req.body.device_id || "").trim();
  const weight = Number(req.body.weight);
  const timestamp =
    String(req.body.timestamp || "").trim() || new Date().toISOString();
  if (!apiKey || !deviceId)
    return res
      .status(401)
      .json({ error: "API key and device ID are required." });
  if (!Number.isFinite(weight) || weight < 0)
    return res.status(400).json({ error: "Weight must be zero or greater." });
  if (Number.isNaN(Date.parse(timestamp)))
    return res.status(400).json({ error: "Timestamp is invalid." });

  const device = db
    .prepare("SELECT * FROM iot_devices WHERE device_id=? AND api_key=?")
    .get(deviceId, apiKey);
  if (!device)
    return res.status(401).json({ error: "Invalid device credentials." });

  const receivedAt = new Date(timestamp).toISOString();
  const transaction = db.transaction(() => {
    db.prepare(
      `INSERT INTO waste_logs (device_id, weight, recorded_at, processing_status, recorded_by) VALUES (?, ?, ?, 'recorded', NULL)`,
    ).run(deviceId, weight, receivedAt);
    db.prepare(
      `UPDATE iot_devices SET status='online', last_reading=?, last_received_at=? WHERE id=?`,
    ).run(weight, receivedAt, device.id);

    const settings = {};
    db.prepare("SELECT key, value FROM settings")
      .all()
      .forEach((row) => {
        settings[row.key] = Number(row.value);
      });
    const capacity = settings.waste_capacity_kg || 50;
    const warningPercent = Math.min(
      100,
      Math.max(1, settings.waste_warning_percent || 80),
    );
    const threshold = (capacity * warningPercent) / 100;
    const start = new Date(receivedAt);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const todayWaste = db
      .prepare(
        "SELECT COALESCE(SUM(weight), 0) AS total FROM waste_logs WHERE recorded_at >= ? AND recorded_at < ?",
      )
      .get(start.toISOString(), end.toISOString()).total;
    if (todayWaste >= threshold) {
      const existing = db
        .prepare(
          "SELECT id FROM alerts WHERE alert_type='waste-capacity' AND is_read=0 AND message LIKE ? ORDER BY id DESC LIMIT 1",
        )
        .get(`%${deviceId}%`);
      if (!existing) {
        db.prepare(
          "INSERT INTO alerts (alert_type, message, is_read) VALUES (?, ?, 0)",
        ).run(
          "waste-capacity",
          `${deviceId} waste reading reached the ${warningPercent}% capacity threshold (${todayWaste.toFixed(2)} kg today).`,
        );
      }
    }

    const lowItems = db
      .prepare(
        "SELECT id, name, quantity FROM inventory_items WHERE quantity <= reorder_level ORDER BY name ASC",
      )
      .all();
    for (const item of lowItems) {
      const existing = db
        .prepare(
          "SELECT id FROM alerts WHERE alert_type='low-stock' AND is_read=0 AND message LIKE ? LIMIT 1",
        )
        .get(`%${item.name}%`);
      if (!existing) {
        db.prepare(
          "INSERT INTO alerts (alert_type, message, is_read) VALUES ('low-stock', ?, 0)",
        ).run(
          `${item.name} is low or out of stock (${Number(item.quantity).toFixed(2)} remaining).`,
        );
      }
    }
  });
  transaction();
  res.status(201).json({ success: true });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("scrapwise.sid");
    res.redirect("/");
  });
});

function dashboardForRole(role) {
  if (role === "Admin") return "/admin/dashboard";
  if (role === "Kitchen Staff") return "/kitchen/dashboard";
  return "/pos/dashboard";
}

module.exports = router;
