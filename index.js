const path = require("path");
const express = require("express");
const session = require("express-session");

// Initializing the database also creates the table and sample admin account.
require("./models/database");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const posRoutes = require("./routes/pos");
const kitchenRoutes = require("./routes/kitchen");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    name: "scrapwise.sid",
    secret:
      process.env.SESSION_SECRET || "change-this-session-secret-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 },
  }),
);

// Protected static assets and HTML for the Admin module.
app.use("/admin", (req, res, next) => {
  if (!req.session.user) return res.redirect("/");
  if (req.session.user.role !== "Admin") return res.redirect("/");
  next();
});
app.use("/admin", express.static(path.join(__dirname, "public", "admin")));

// Mount authentication API routes after session middleware is installed.
app.use("/api", authRoutes);
app.use("/pos", posRoutes);
app.use("/kitchen", kitchenRoutes);
app.use(express.static(path.join(__dirname, "public")));

// Login is the landing page. Logged-in users go straight to their dashboard.
app.get("/", (req, res) => {
  if (req.session.user)
    return res.redirect(dashboardForRole(req.session.user.role));
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/register", (req, res) => {
  if (req.session.user)
    return res.redirect(dashboardForRole(req.session.user.role));
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/change-password", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "change-password.html"));
});

// Logout is available to all logged-in users.
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("scrapwise.sid");
    res.redirect("/");
  });
});

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect("/");
    if (req.session.user.role !== role)
      return res.status(403).send("Forbidden");
    next();
  };
}

function dashboardForRole(role) {
  if (role === "Admin") return "/admin/dashboard";
  if (role === "Kitchen Staff") return "/kitchen/dashboard";
  return "/pos/dashboard";
}

function renderDashboard(req, extraContent = "") {
  const user = req.session.user;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Dashboard - Scrap-Wise</title><link rel="stylesheet" href="/styles.css"></head><body><main class="dashboard-page"><section class="dashboard-card"><div class="brand-mark" aria-hidden="true">♻</div><h1>Scrap-Wise</h1><p>Welcome, ${escapeHtml(user.full_name)} (${escapeHtml(user.role)})</p>${extraContent}<form method="POST" action="/logout"><button class="button primary" type="submit">Logout</button></form></section></main></body></html>`;
}

app.get("/pos/dashboard", requireRole("POS Staff"), (req, res) =>
  res.sendFile(path.join(__dirname, "public", "pos", "dashboard.html")),
);

// Admin-only route must come after the role-protecting middleware in index.js.
app.use("/admin", adminRoutes);

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
}

app.listen(PORT, () =>
  console.log(`Scrap-Wise server running at http://localhost:${PORT}`),
);
