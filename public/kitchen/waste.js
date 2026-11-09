async function loadWaste() {
  const response = await fetch("/kitchen/api/waste");
  if (!response.ok) return;
  const data = await response.json();
  document.getElementById("device-select").innerHTML =
    '<option value="">Select Staff Member</option>' +
    data.devices
      .map(
        (device) =>
          `<option value="${escapeAttribute(device.device_id)}">${escapeHtml(device.name)} (${escapeHtml(device.device_id)})</option>`,
      )
      .join("");
  document.getElementById("waste-table").innerHTML = data.logs.length
    ? data.logs
        .map(
          (row) => `<tr>
        <td>${escapeHtml(new Date(row.recorded_at).toLocaleString("en-PH"))}</td>
        <td><strong>${escapeHtml(row.device_id)}</strong></td>
        <td>${formatQuantity(row.weight)} kg</td>
        <td><span class="status ${escapeAttribute(row.processing_status)}">${escapeHtml(formatStatus(row.processing_status))}</span></td>
      </tr>`,
        )
        .join("")
    : '<tr><td colspan="4" class="empty">No waste readings found.</td></tr>';
}

document
  .getElementById("waste-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const weight = Number(document.getElementById("waste-weight").value);
    const deviceId = document.getElementById("device-select").value;
    const loadingTime = document.getElementById("loading-time").value;
    if (!deviceId) return showMessage("Select a waste device.", true);
    if (!Number.isFinite(weight) || weight < 0)
      return showMessage("Enter a valid weight.", true);
    const response = await fetch("/kitchen/api/waste/loading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: deviceId,
        weight,
        recorded_at: loadingTime,
      }),
    });
    const result = await response.json();
    if (!response.ok)
      return showMessage(result.error || "Unable to save waste loading.", true);
    showMessage(result.message, false);
    showToastMessage(result.message);
    event.target.reset();
    document.getElementById("loading-time").value = localDateTime();
    await loadWaste();
  });

function showMessage(message, isError) {
  const element = document.getElementById("waste-message");
  element.textContent = message;
  element.className = `message ${isError ? "error" : "success"}`;
  element.classList.remove("hidden");
}
function localDateTime() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function formatQuantity(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  });
}
function formatStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "processed") return "Processed";
  if (normalized === "processing") return "Processing";
  return "Recorded";
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
}
function escapeAttribute(value) {
  return escapeHtml(value);
}

document.getElementById("loading-time").value = localDateTime();
loadWaste();
