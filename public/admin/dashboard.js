let salesChart;
let wasteChart;

async function loadDashboard() {
  try {
    const response = await fetch("/admin/api/dashboard");
    if (!response.ok) throw new Error("Dashboard request failed");
    const data = await response.json();
    renderCards(data.cards);
    renderCharts(data.charts);
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
    ["Today's Sales", formatMoney(cards.todaysSales), "Completed sales", "primary-kpi"],
    ["Transactions Today", cards.todaysTransactions, "Orders completed today", ""],
    ["Low-Stock Items", cards.lowStockItems, "Needs inventory review", "attention"],
    ["Employees Present", cards.employeesPresent, "Present or late today", ""],
    ["Waste Today", `${Number(cards.wasteToday).toFixed(2)} kg`, "Recorded waste weight", "attention"],
    ["Pending Approvals", cards.pendingApprovals, "Accounts awaiting review", "attention"],
  ];
  document.getElementById("summary-grid").innerHTML = items
    .map(
      ([label, value, note, className], index) =>
        `<article class="summary-card summary-${index} ${className}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(note)}</small></article>`,
    )
    .join("");
}

function renderCharts(charts) {
  if (salesChart) salesChart.destroy();
  if (wasteChart) wasteChart.destroy();
  salesChart = new Chart(document.getElementById("sales-chart"), {
    type: "line",
    data: {
      labels: charts.labels,
      datasets: [
        {
          label: "Sales (PHP)",
          data: charts.sales,
          borderColor: "#176B45",
          backgroundColor: "rgba(23,107,69,.10)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#637268" } },
        y: { beginAtZero: true, grid: { color: "#EDF2EE" }, ticks: { color: "#637268" } },
      },
    },
  });
  wasteChart = new Chart(document.getElementById("waste-chart"), {
    type: "bar",
    data: {
      labels: charts.labels,
      datasets: [
        {
          label: "Waste (kg)",
          data: charts.waste,
          backgroundColor: "#E58A23",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#637268" } },
        y: { beginAtZero: true, grid: { color: "#EDF2EE" }, ticks: { color: "#637268" } },
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

loadDashboard();
