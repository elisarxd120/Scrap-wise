let editingId = null;
const settingsForm = document.getElementById("settings-form");
const deviceForm = document.getElementById("device-form");
const deviceModal = document.getElementById("device-modal");
const table = document.getElementById("device-table");
function esc(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}
function toast(message, error = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = "toast" + (error ? " error" : "");
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3500);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function loadSettings() {
  try {
    const settings = await api("/admin/api/settings");
    document.getElementById("waste_capacity_kg").value =
      settings.waste_capacity_kg;
    document.getElementById("waste_warning_percent").value =
      settings.waste_warning_percent;
  } catch (error) {
    toast(error.message, true);
  }
}
settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("settings-error");
  error.textContent = "";
  try {
    await api("/admin/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        waste_capacity_kg: Number(
          document.getElementById("waste_capacity_kg").value,
        ),
        waste_warning_percent: Number(
          document.getElementById("waste_warning_percent").value,
        ),
      }),
    });
    toast("Alert thresholds saved.");
  } catch (err) {
    error.textContent = err.message;
  }
});
async function loadDevices() {
  try {
    const devices = await api("/admin/api/iot-devices");
    table.innerHTML = devices.length
      ? devices
          .map(
            (device) =>
              `<tr><td><strong>${esc(device.device_id)}</strong></td><td>${esc(device.name)}</td><td><span class="status ${device.status === "online" ? "completed" : "voided"}">${esc(device.status)}</span></td><td>${device.last_reading == null ? "—" : esc(Number(device.last_reading).toFixed(2) + " kg")}</td><td>${esc(device.last_received_at || "Never")}</td><td>${esc(device.calibration_date || "—")}</td><td class="action-cell"><button class="button secondary edit-device" data-id="${Number(device.id)}" type="button">Edit</button> <button class="button success key-device" data-id="${Number(device.id)}" type="button">Generate API Key</button> <button class="button danger delete-device" data-id="${Number(device.id)}" data-name="${esc(device.name)}" type="button">Delete</button></td></tr>`,
          )
          .join("")
      : '<tr><td colspan="7" class="empty">No IoT devices found.</td></tr>';
  } catch (error) {
    table.innerHTML = `<tr><td colspan="7" class="empty">${esc(error.message)}</td></tr>`;
  }
}
window.editDevice = async function (id) {
  editingId = Number(id);
  try {
    const devices = await api("/admin/api/iot-devices");
    const device = devices.find((item) => item.id === Number(id));
    if (!device) return;
    document.getElementById("device-modal-title").textContent = "Edit Device";
    deviceForm.elements.device_id.value = device.device_id;
    deviceForm.elements.name.value = device.name;
    deviceForm.elements.calibration_date.value = device.calibration_date || "";
    document.getElementById("device-error").textContent = "";
    deviceModal.classList.remove("hidden");
  } catch (error) {
    toast(error.message, true);
  }
};
window.deleteDevice = async function (id, name) {
  if (!confirm(`Delete device ${name}?`)) return;
  try {
    await api("/admin/api/iot-devices/" + id, { method: "DELETE" });
    toast("Device deleted.");
    loadDevices();
  } catch (error) {
    toast(error.message, true);
  }
};
window.generateKey = async function (id) {
  try {
    const result = await api("/admin/api/iot-devices/" + id + "/api-key", {
      method: "POST",
    });
    document.getElementById("generated-key").value = result.api_key;
    document.getElementById("key-modal").classList.remove("hidden");
  } catch (error) {
    toast(error.message, true);
  }
};
document.getElementById("add-device").addEventListener("click", () => {
  editingId = null;
  deviceForm.reset();
  document.getElementById("device-modal-title").textContent = "Add Device";
  document.getElementById("device-error").textContent = "";
  deviceModal.classList.remove("hidden");
});
deviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("device-error");
  error.textContent = "";
  try {
    const wasEditing = editingId !== null;
    const body = {
      device_id: deviceForm.elements.device_id.value,
      name: deviceForm.elements.name.value,
      calibration_date: deviceForm.elements.calibration_date.value,
    };
    const result = await api(
      wasEditing
        ? "/admin/api/iot-devices/" + editingId
        : "/admin/api/iot-devices",
      { method: wasEditing ? "PUT" : "POST", body: JSON.stringify(body) },
    );
    deviceModal.classList.add("hidden");
    editingId = null;
    loadDevices();
    if (wasEditing) {
      toast("Device updated.");
    } else {
      document.getElementById("generated-key").value = result.api_key;
      document.getElementById("key-modal").classList.remove("hidden");
      toast("Device created. Copy the generated API key.");
    }
  } catch (err) {
    error.textContent = err.message;
  }
});
table.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.classList.contains("edit-device"))
    window.editDevice(button.dataset.id);
  if (button.classList.contains("key-device"))
    window.generateKey(button.dataset.id);
  if (button.classList.contains("delete-device"))
    window.deleteDevice(button.dataset.id, button.dataset.name);
});
document.getElementById("copy-key").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(
      document.getElementById("generated-key").value,
    );
    toast("API key copied.");
  } catch (_) {
    document.getElementById("generated-key").select();
    toast("Select and copy the API key manually.", true);
  }
});
document
  .querySelectorAll("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      document.getElementById(button.dataset.close).classList.add("hidden"),
    ),
  );
loadSettings();
loadDevices();
