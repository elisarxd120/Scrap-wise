async function loadDashboard() {
  const response = await fetch("/kitchen/api/dashboard");
  if (!response.ok) return;
  const data = await response.json();

  document.getElementById("low-stock-count").textContent = data.cards.lowStockCount;
  document.getElementById("waste-today").textContent = `${data.cards.wasteToday} kg`;
  document.getElementById("capacity-value").textContent = `${data.cards.capacity}%`;
  document.getElementById("capacity-bar").style.width = `${data.cards.capacity}%`;
  document.getElementById("processing-status").textContent = data.cards.processingStatus;

  const bar = document.getElementById("capacity-bar");
  if (data.cards.capacity >= data.cards.capacityWarningPercent) bar.style.background = "#e58a23";
  if (data.cards.capacity >= 100) bar.style.background = "#b42318";

  document.getElementById("low-stock-list").innerHTML = data.lowStockItems.length
    ? data.lowStockItems.map(item =>
        `<div class="recent-alert"><strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.quantity)} / ${escapeHtml(item.reorder_level)} ${escapeHtml(item.unit)}</div>`
      ).join("")
    : '<p>No low-stock items.</p>';

  document.getElementById("recent-alerts").innerHTML = data.recentAlerts.length
    ? data.recentAlerts.map(alert =>
        `<div class="recent-alert"><strong>${escapeHtml(alert.message)}</strong><br><small>${escapeHtml(alert.created_at)}</small></div>`
      ).join("")
    : '<p>No recent alerts.</p>';
}

loadDashboard();
