let stockItems = [];
let editingMovementId = null;

async function loadStockItems() {
  const response = await fetch("/kitchen/api/inventory/items");
  if (!response.ok) return;
  stockItems = await response.json();
  document.getElementById("item-options").innerHTML = stockItems.map(item =>
    `<option value="${escapeAttribute(item.name)}"></option>`
  ).join("");
  const params = new URLSearchParams(window.location.search);
  const itemId = Number(params.get("item"));
  const item = stockItems.find(entry => entry.id === itemId);
  if (item) {
    document.getElementById("item-input").value = item.name;
    document.getElementById("item-id").value = item.id;
    document.getElementById("item-unit").textContent = `Unit: ${item.unit}`;
  }
  if (params.get("type") === "out") setType("out");
  if (params.get("type") === "in") setType("in");
}

async function loadTodayMovements() {
  const response = await fetch("/kitchen/api/stock/movements/today");
  if (!response.ok) return;
  const rows = await response.json();
  document.getElementById("movement-table").innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td><strong>${escapeHtml(row.item_name)}</strong></td>
      <td>${row.movement_type === "in" ? "Stock In" : "Stock Out"}</td>
      <td>${formatQuantity(row.quantity)} ${escapeHtml(row.unit)}</td>
      <td>${escapeHtml(row.reason || "—")}</td>
      <td>${escapeHtml(row.created_at ? new Date(row.created_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}) : row.movement_date)}</td>
      <td><button class="button secondary" type="button" onclick="startEdit(${Number(row.id)})">Update</button></td>
    </tr>`).join("") : '<tr><td colspan="6" class="empty">No movements today.</td></tr>';
}

async function startEdit(id) {
  const response = await fetch("/kitchen/api/stock/movements/today");
  if (!response.ok) return;
  const rows = await response.json();
  const row = rows.find(item => item.id === id);
  if (!row) return;
  editingMovementId = id;
  document.getElementById("item-input").value = row.item_name;
  document.getElementById("item-id").value = row.item_id;
  document.getElementById("movement-quantity").value = row.quantity;
  document.getElementById("movement-date").value = row.movement_date;
  document.getElementById("movement-reason").value = row.reason || "";
  setType(row.movement_type);
  const item = stockItems.find(entry => entry.id === row.item_id);
  document.getElementById("item-unit").textContent = item ? item.unit : "";
  document.querySelector(".kitchen-card").scrollIntoView({ behavior: "smooth" });
}

function setType(type) {
  document.getElementById("movement-type").value = type;
  document.getElementById("type-in").classList.toggle("active", type === "in");
  document.getElementById("type-out").classList.toggle("active", type === "out");
  document.getElementById("stock-out-reason").classList.toggle("hidden", type !== "out");
  document.getElementById("movement-reason").classList.toggle("hidden", type === "out");
  if (type === "out") document.getElementById("stock-out-reason").value = "";
}

document.querySelectorAll(".movement-toggle button").forEach(button =>
  button.addEventListener("click", () => setType(button.dataset.type))
);

document.getElementById("item-input").addEventListener("input", event => {
  const item = stockItems.find(entry => entry.name.toLowerCase() === event.target.value.trim().toLowerCase());
  document.getElementById("item-id").value = item ? item.id : "";
  document.getElementById("item-unit").textContent = item ? `Unit: ${item.unit}` : "";
});

document.getElementById("stock-out-reason").addEventListener("change", event => {
  document.getElementById("movement-reason").value = event.target.value;
});

document.getElementById("movement-form").addEventListener("submit", async event => {
  event.preventDefault();
  const type = document.getElementById("movement-type").value;
  let reason = document.getElementById("movement-reason").value.trim();
  if (type === "out") reason = document.getElementById("stock-out-reason").value || reason;
  if (!document.getElementById("item-id").value) return showMessage("Select an item from the list.", true);
  const quantity = Number(document.getElementById("movement-quantity").value);
  if (!Number.isFinite(quantity) || quantity <= 0) return showMessage("Enter a quantity greater than zero.", true);

  const body = {
    item_id: Number(document.getElementById("item-id").value),
    movement_type: type,
    quantity,
    movement_date: document.getElementById("movement-date").value,
    reason,
  };
  const response = await fetch(editingMovementId ? `/kitchen/api/stock/movements/${editingMovementId}` : "/kitchen/api/stock/movements", {
    method: editingMovementId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) return showMessage(result.error || "Unable to save movement.", true);
  showMessage(result.message, false);
  editingMovementId = null;
  document.getElementById("movement-form").reset();
  setType("in");
  document.getElementById("item-unit").textContent = "";
  document.getElementById("movement-date").value = localToday();
  await loadTodayMovements();
  await loadStockItems();
});

function showMessage(message, isError) {
  const element = document.getElementById("movement-message");
  element.textContent = message;
  element.className = `message ${isError ? "error" : "success"}`;
  element.classList.remove("hidden");
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function formatQuantity(value) { return Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 }); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[character]); }
function escapeAttribute(value) { return escapeHtml(value); }

document.getElementById("movement-date").value = localToday();
loadStockItems();
loadTodayMovements();
