let lastUnreadIds = new Set();

async function initializeKitchenNav() {
  const mount = document.getElementById("kitchen-nav");
  if (!mount) return;

  const response = await fetch("/kitchen/nav.html");
  mount.innerHTML = await response.text();

  document.getElementById("mobile-menu").addEventListener("click", () => document.body.classList.add("menu-open"));
  document.getElementById("sidebar-close").addEventListener("click", () => document.body.classList.remove("menu-open"));
  document.getElementById("sidebar-overlay").addEventListener("click", () => document.body.classList.remove("menu-open"));

  const path = window.location.pathname;
  document.querySelectorAll(".kitchen-nav a[data-page]").forEach(link => {
    if (path.startsWith(`/kitchen/${link.dataset.page}`)) link.classList.add("active");
  });

  await loadNav();
  document.getElementById("notification-bell").addEventListener("click", toggleNotifications);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      document.body.classList.remove("menu-open");
      document.getElementById("notification-dropdown").classList.add("hidden");
    }
  });
  setInterval(loadUnreadAlerts, 10000);
}

async function loadNav() {
  const navResponse = await fetch("/kitchen/api/nav");
  if (!navResponse.ok) return;
  const nav = await navResponse.json();
  document.getElementById("kitchen-staff-name").textContent = nav.staffName;
  setBadge(document.getElementById("unread-badge"), nav.unreadAlerts);
  setBadge(document.getElementById("alert-nav-badge"), nav.unreadAlerts);
  showLowStockBanner(nav.lowStockBanner);
  await loadUnreadAlerts(false);
}

async function loadUnreadAlerts(showToast = true) {
  const response = await fetch("/kitchen/api/alerts/unread");
  if (!response.ok) return;
  const data = await response.json();
  setBadge(document.getElementById("unread-badge"), data.count);
  setBadge(document.getElementById("alert-nav-badge"), data.count);

  if (showToast) {
    data.alerts.forEach(alert => {
      if (!lastUnreadIds.has(Number(alert.id))) showToastMessage(alert.message, false);
    });
  }
  lastUnreadIds = new Set(data.alerts.map(alert => Number(alert.id)));
}

async function toggleNotifications() {
  const dropdown = document.getElementById("notification-dropdown");
  dropdown.classList.toggle("hidden");
  if (!dropdown.classList.contains("hidden")) {
    const response = await fetch("/kitchen/api/alerts/unread");
    if (!response.ok) return;
    const data = await response.json();
    const list = document.getElementById("notification-list");
    if (!data.alerts.length) {
      list.innerHTML = '<p style="padding:12px">No new alerts.</p>';
      return;
    }
    list.innerHTML = data.alerts.map(alert =>
      `<button type="button" class="notification-item unread"><span>${escapeHtml(alert.message)}</span><small>${escapeHtml(alert.created_at)}</small></button>`
    ).join("");
  }
}

function showLowStockBanner(visible) {
  const banners = document.queryAllSafe ? [] : document.querySelectorAll("[data-low-stock-banner]");
  banners.forEach(banner => banner.classList.toggle("hidden", !visible));
}

function setBadge(element, count) {
  if (!element) return;
  element.textContent = count;
  element.classList.toggle("hidden", Number(count) === 0);
}

function showToastMessage(message, asStatus = true) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toast.hideTimer);
  toast.hideTimer = setTimeout(() => toast.classList.add("hidden"), 5000);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

initializeKitchenNav();
