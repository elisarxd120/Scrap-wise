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
function reportParams(exportCsv = false) {
  const params = new URLSearchParams({
    start: document.getElementById("report-start").value,
    end: document.getElementById("report-end").value,
  });
  if (exportCsv) params.set("export", "csv");
  return params;
}
async function generateReport() {
  const type = document.getElementById("report-type").value;
  const error = document.getElementById("report-error");
  error.textContent = "";
  try {
    const response = await fetch(`/admin/api/reports/${encodeURIComponent(type)}?${reportParams()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to generate report");
    document.getElementById("report-head").innerHTML = `<tr>${data.columns.map((column) => `<th>${esc(column)}</th>`).join("")}</tr>`;
    document.getElementById("report-body").innerHTML = data.rows.length ? data.rows.map((row) => `<tr>${Object.values(row).map((value) => `<td>${esc(value)}</td>`).join("")}</tr>`).join("") : '<tr><td colspan="' + data.columns.length + '" class="empty">No matching records found.</td></tr>';
    document.getElementById("report-title").textContent = `${document.getElementById("report-type").selectedOptions[0].text} Preview`;
    document.getElementById("report-meta").textContent = `${data.rows.length} records | ${data.range.start} to ${data.range.end}`;
  } catch (err) { error.textContent = err.message; }
}
async function exportReport() {
  const type = document.getElementById("report-type").value;
  const error = document.getElementById("report-error");
  error.textContent = "";
  try {
    const response = await fetch(`/admin/api/reports/${encodeURIComponent(type)}?${reportParams(true)}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Unable to export report");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}-${document.getElementById("report-start").value}-to-${document.getElementById("report-end").value}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("Report exported.");
  } catch (err) { error.textContent = err.message; }
}

const end = new Date();
const start = new Date();
start.setDate(start.getDate() - 29);
document.getElementById("report-end").value = dateLocal(end);
document.getElementById("report-start").value = dateLocal(start);
document.getElementById("generate-report").addEventListener("click", generateReport);
document.getElementById("export-report").addEventListener("click", exportReport);
