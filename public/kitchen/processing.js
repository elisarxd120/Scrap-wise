let processingRows = [];

async function loadProcessing() {
  const date = document.getElementById("processing-date").value;
  const response = await fetch(`/kitchen/api/processing?date=${encodeURIComponent(date)}`);
  if (!response.ok) return;
  const data = await response.json();
  processingRows = data.logs;
  document.getElementById("processing-table").innerHTML = processingRows.length
    ? processingRows.map(row => `
      <tr>
        <td>${escapeHtml(new Date(row.recorded_at).toLocaleTimeString("en-PH", { hour:"2-digit", minute:"2-digit" }))}</td>
        <td><strong>${escapeHtml(row.device_id)}</strong></td>
        <td>${formatQuantity(row.weight)} kg</td>
        <td><select aria-label="Status for reading ${row.id}" id="status-${row.id}">
          <option value="recorded" ${row.processing_status === "recorded" ? "selected" : ""}>Recorded</option>
          <option value="processing" ${row.processing_status === "processing" ? "selected" : ""}>Processing</option>
          <option value="processed" ${row.processing_status === "processed" ? "selected" : ""}>Processed</option>
        </select></td>
        <td><input aria-label="Before weight" id="before-${row.id}" type="number" min="0" step="0.01" value="${row.before_weight ?? ""}" placeholder="kg"></td>
        <td><input aria-label="After weight" id="after-${row.id}" type="number" min="0" step="0.01" value="${row.after_weight ?? ""}" placeholder="kg"></td>
        <td><button class="button secondary" type="button" onclick="saveProcessing(${Number(row.id)})">Update</button></td>
      </tr>`).join("")
    : '<tr><td colspan="7" class="empty">No waste readings found for this date.</td></tr>';
}

async function saveProcessing(id) {
  const status = document.getElementById(`status-${id}`).value;
  const before = document.getElementById(`before-${id}`).value;
  const after = document.getElementById(`after-${id}`).value;
  const response = await fetch(`/kitchen/api/processing/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      processing_status: status,
      before_weight: before === "" ? null : Number(before),
      after_weight: after === "" ? null : Number(after),
    }),
  });
  const result = await response.json();
  if (!response.ok) return showMessage(result.error || "Unable to update processing status.", true);
  showMessage(result.message, false);
  showToastMessage(result.message);
  await loadProcessing();
}

function showMessage(message, isError) {
  const element = document.getElementById("processing-message");
  element.textContent = message;
  element.className = `message ${isError ? "error" : "success"}`;
  element.classList.remove("hidden");
}
function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function formatQuantity(value) { return Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 }); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[c]); }

document.getElementById("processing-date").value = localToday();
document.getElementById("processing-date").addEventListener("change", loadProcessing);
loadProcessing();
