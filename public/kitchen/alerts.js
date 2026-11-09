let allAlerts = [];

async function loadAlerts() {
  const response = await fetch("/kitchen/api/alerts");
  if (!response.ok) return;
  const data = await response.json();
  allAlerts = data.alerts;
  renderAlerts();
  if (typeof loadUnreadAlerts === "function") await loadUnreadAlerts(false);
}

function renderAlerts() {
  const unreadOnly = document.getElementById("unread-only").checked;
  const rows = unreadOnly ? allAlerts.filter(alert => Number(alert.is_read) === 0) : allAlerts;
  document.getElementById("alerts-list").innerHTML = rows.length
    ? rows.map(alert => `
      <article class="alert-page-item ${Number(alert.is_read) === 0 ? "unread" : ""}">
        <div>
          <span class="status low">${escapeHtml(formatAlertType(alert.alert_type))}</span>
          <p><strong>${escapeHtml(alert.message)}</strong></p>
          <small>${escapeHtml(new Date(alert.created_at).toLocaleString("en-PH"))}</small>
        </div>
        ${Number(alert.is_read) === 0
          ? `<button class="button secondary" type="button" onclick="markRead(${Number(alert.id)})">Mark as Read</button>`
          : '<span class="read-label">Read</span>'}
      </article>`).join("")
    : '<p class="empty">No alerts found.</p>';
}

async function markRead(id) {
  const response = await fetch(`/kitchen/api/alerts/${id}/read`, { method: "POST" });
  if (!response.ok) return;
  await loadAlerts();
}

document.getElementById("read-all").addEventListener("click", async () => {
  const response = await fetch("/kitchen/api/alerts/read-all", { method: "POST" });
  if (!response.ok) return;
  showToastMessage("All alerts marked as read.");
  await loadAlerts();
});
document.getElementById("unread-only").addEventListener("change", renderAlerts);

function formatAlertType(type) { return String(type || "Alert").replace(/[-_]/g, " "); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[c]); }

loadAlerts();
