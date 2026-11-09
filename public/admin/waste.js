const trendCanvas = document.getElementById("waste-trend-chart");
const deviceCanvas = document.getElementById("waste-device-chart");
let trendChart;
let deviceChart;

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}
function dateLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function toast(message, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = `toast${isError ? " error" : ""}`;
  setTimeout(() => el.classList.add("hidden"), 3500);
}
async function api(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function loadDevices() {
  try {
    const devices = await api("/admin/api/iot-devices");
    const select = document.getElementById("waste-device");
    select.insertAdjacentHTML("beforeend", devices.map((device) => `<option value="${esc(device.device_id)}">${esc(device.name)} (${esc(device.device_id)})</option>`).join(""));
  } catch (error) { toast(error.message, true); }
}
async function loadWaste() {
  const start = document.getElementById("waste-start").value;
  const end = document.getElementById("waste-end").value;
  const device = document.getElementById("waste-device").value;
  const error = document.getElementById("waste-error");
  error.textContent = "";
  const params = new URLSearchParams({ start, end });
  if (device) params.set("device", device);
  try {
    const data = await api(`/admin/api/waste-analytics?${params}`);
    const cards = [
      ["Total Waste", `${Number(data.summary.total).toFixed(2)} kg`],
      ["Readings", data.summary.count],
      ["Average Reading", `${Number(data.summary.average).toFixed(2)} kg`],
      ["Peak Reading", `${Number(data.summary.peak).toFixed(2)} kg`],
    ];
    document.getElementById("waste-summary").innerHTML = cards.map(([label, value], index) => `<article class="summary-card summary-${index}"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join("");
    renderTrend(data.daily);
    renderDevices(data.byDevice);
    document.getElementById("waste-table").innerHTML = data.logs.length ? data.logs.map((row) => `<tr><td>${esc(new Date(row.recorded_at).toLocaleString("en-PH"))}</td><td><strong>${esc(row.device_id)}</strong></td><td>${Number(row.weight).toFixed(2)} kg</td><td><span class="status ${esc(row.processing_status)}">${esc(row.processing_status)}</span></td></tr>`).join("") : '<tr><td colspan="4" class="empty">No waste readings found for this range.</td></tr>';
  } catch (err) {
    error.textContent = err.message;
  }
}
function renderTrend(rows) {
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(trendCanvas, {
    type: "bar",
    data: { labels: rows.map((row) => row.date), datasets: [{ label: "Waste (kg)", data: rows.map((row) => row.total), backgroundColor: "#d97706", borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });
}
function renderDevices(rows) {
  if (deviceChart) deviceChart.destroy();
  deviceChart = new Chart(deviceCanvas, {
    type: "doughnut",
    data: { labels: rows.map((row) => row.device_id), datasets: [{ data: rows.map((row) => row.total), backgroundColor: ["#1f7a4d", "#d97706", "#3b82f6", "#8b5cf6", "#ef4444"] }] },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

const end = new Date();
const start = new Date();
start.setDate(start.getDate() - 29);
document.getElementById("waste-end").value = dateLocal(end);
document.getElementById("waste-start").value = dateLocal(start);
document.getElementById("apply-waste-filter").addEventListener("click", loadWaste);
document.getElementById("refresh-waste").addEventListener("click", loadWaste);
loadDevices().then(loadWaste);
