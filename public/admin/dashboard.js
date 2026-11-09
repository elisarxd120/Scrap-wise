let orderTrendChart;
let orderTrendData;

async function loadDashboard() {
  try {
    const response = await fetch("/admin/api/dashboard");
    if (!response.ok) throw new Error("Dashboard request failed");
    const data = await response.json();
    renderCards(data.cards);
    orderTrendData = data.orderTrends;
    renderOrderTrend();
    renderLowStock(data.lowStockItems);
    renderTransactions(data.recentTransactions);
    renderAlerts(data.recentAlerts);
    document.getElementById("dashboard-context").textContent =
      `Updated ${new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`;
  } catch (error) {
    showToast("Unable to load dashboard data.", true);
  }
}

function renderCards(cards) {
  const items = [
    [
      "Total Orders",
      cards.totalOrders,
      "Completed transactions",
      "primary-kpi",
    ],
    ["Total Products", cards.totalProducts, "Inventory items", ""],
    [
      "Low-Stock Items",
      cards.lowStockItems,
      "Needs inventory review",
      "attention",
    ],
    [
      "Stock Movements Today",
      cards.stockMovementsToday,
      "Recorded stock-in and stock-out",
      "",
    ],
  ];
  document.getElementById("summary-grid").innerHTML = items
    .map(
      ([label, value, note, className], index) =>
        `<article class="summary-card summary-${index} ${className}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(note)}</small></article>`,
    )
    .join("");
}

function renderOrderTrend() {
  if (!orderTrendData) return;
  if (orderTrendChart) orderTrendChart.destroy();
  const period = document.getElementById("order-trend-period").value;
  const trend = orderTrendData[period];
  orderTrendChart = new Chart(document.getElementById("order-trend-chart"), {
    type: "bar",
    data: {
      labels: trend.labels,
      datasets: [
        {
          label: "Completed orders",
          data: trend.orders,
          backgroundColor: "#176B45",
          borderRadius: 5,
          maxBarThickness: 36,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#637268", maxRotation: 0 },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: "#637268" },
          grid: { color: "#EDF2EE" },
        },
      },
    },
  });
}

function renderLowStock(items) {
  document.getElementById("low-stock-body").innerHTML = items.length
    ? items
        .map(
          (item) =>
            `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)}</small></td><td>${Number(item.quantity)} ${escapeHtml(item.unit)}</td><td>${Number(item.reorder_level)} ${escapeHtml(item.unit)}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="3" class="empty">All stock levels are healthy.</td></tr>';
}

function renderTransactions(items) {
  document.getElementById("transactions-body").innerHTML = items.length
    ? items
        .map(
          (item) =>
            `<tr><td><strong>${escapeHtml(item.transaction_code)}</strong><small>${escapeHtml(formatDate(item.transaction_date))}</small></td><td>${escapeHtml(item.cashier || "Unknown")}</td><td>${formatMoney(item.total)}</td><td><span class="status ${item.status}">${escapeHtml(item.status)}</span></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="4" class="empty">No transactions yet.</td></tr>';
}

function renderAlerts(alerts) {
  document.getElementById("recent-alerts").innerHTML = alerts.length
    ? alerts
        .map(
          (alert) =>
            `<div class="alert-row ${alert.is_read ? "" : "unread"}"><span class="alert-dot"></span><div><strong>${escapeHtml(alert.alert_type)}</strong><p>${escapeHtml(alert.message)}</p></div><time>${escapeHtml(formatDate(alert.created_at))}</time></div>`,
        )
        .join("")
    : '<p class="notification-empty">No recent alerts.</p>';
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value || 0));
}
function formatDate(value) {
  return value
    ? new Date(value).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
}
function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${isError ? "error" : ""}`;
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

document
  .getElementById("order-trend-period")
  .addEventListener("change", renderOrderTrend);
loadDashboard();
