let editingItemId = null,
  editingMovementId = null,
  items = [];
const itemModal = document.getElementById("item-modal"),
  movementModal = document.getElementById("movement-modal");
async function loadInventory() {
  const search = document.getElementById("item-search").value.trim();
  const response = await fetch(
    `/admin/api/inventory?search=${encodeURIComponent(search)}`,
  );
  if (!response.ok) return showToast("Unable to load inventory.", true);
  items = await response.json();
  document.getElementById("inventory-table").innerHTML = items.length
    ? items
        .map((item) => {
          const className =
            item.status === "out"
              ? "stock-out"
              : item.status === "low"
                ? "stock-low"
                : "";
          return `<tr class="${className}"><td><strong>${escapeHtml(item.name)}</strong></td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.unit)}</td><td>${formatQuantity(item.quantity)}</td><td>${formatQuantity(item.reorder_level)}</td><td><span class="status ${item.status === "in stock" ? "completed" : item.status === "low" ? "warning" : "voided"}">${escapeHtml(item.status)}</span></td><td class="action-cell"><button class="button secondary" type="button" onclick="editItem(${Number(item.id)})">Edit</button> <button class="button danger" type="button" onclick="deleteItem(${Number(item.id)},'${escapeAttribute(item.name)}')">Delete</button></td></tr>`;
        })
        .join("")
    : '<tr><td colspan="7" class="empty">No inventory items found.</td></tr>';
  updateItemOptions();
}
function updateItemOptions() {
  const options = items
    .map(
      (item) =>
        `<option value="${Number(item.id)}">${escapeHtml(item.name)} (${formatQuantity(item.quantity)} ${escapeHtml(item.unit)})</option>`,
    )
    .join("");
  document.getElementById("movement_item").innerHTML =
    '<option value="">Select item</option>' + options;
  document.getElementById("movement-item-filter").innerHTML =
    '<option value="">All items</option>' + options.replace(/ \([^)]*\)/g, "");
}
async function editItem(id) {
  const item = items.find((row) => row.id === id);
  if (!item) return;
  editingItemId = id;
  document.getElementById("item-modal-title").textContent = "Edit Item";
  const form = document.getElementById("item-form");
  form.elements.name.value = item.name;
  form.elements.category.value = item.category;
  form.elements.unit.value = item.unit;
  form.elements.quantity.value = item.quantity;
  form.elements.reorder_level.value = item.reorder_level;
  document.getElementById("item-error").textContent = "";
  itemModal.classList.remove("hidden");
}
async function deleteItem(id, name) {
  if (!confirm(`Delete inventory item "${name}"?`)) return;
  const response = await fetch(`/admin/api/inventory/${id}`, {
    method: "DELETE",
  });
  const result = await response.json();
  if (!response.ok)
    return showToast(result.error || "Unable to delete item.", true);
  showToast("Inventory item deleted.");
  loadInventory();
  loadMovements();
}
document
  .getElementById("item-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(
      editingItemId
        ? `/admin/api/inventory/${editingItemId}`
        : "/admin/api/inventory",
      {
        method: editingItemId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      document.getElementById("item-error").textContent =
        result.error || "Unable to save item.";
      return;
    }
    itemModal.classList.add("hidden");
    event.currentTarget.reset();
    editingItemId = null;
    showToast("Inventory item saved.");
    loadInventory();
  });
async function loadMovements() {
  const filter = document.getElementById("movement-item-filter").value;
  const response = await fetch(
    `/admin/api/inventory/movements?item_id=${encodeURIComponent(filter)}`,
  );
  if (!response.ok) return showToast("Unable to load stock movements.", true);
  const movements = await response.json();
  document.getElementById("movement-table").innerHTML = movements.length
    ? movements
        .map(
          (row) =>
            `<tr><td><strong>${escapeHtml(row.item_name)}</strong></td><td><span class="status ${row.movement_type === "in" ? "completed" : "voided"}">Stock-${row.movement_type === "in" ? "In" : "Out"}</span></td><td>${formatQuantity(row.quantity)} ${escapeHtml(row.unit || "")}</td><td>${escapeHtml(row.movement_date)}</td><td>${escapeHtml(row.reason || "—")}</td><td>${escapeHtml(row.recorder || "System")}</td><td class="action-cell"><button class="button secondary" type="button" onclick="editMovement(${Number(row.id)})">Edit</button> <button class="button danger" type="button" onclick="deleteMovement(${Number(row.id)},'${escapeAttribute(row.item_name)}')">Delete</button></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="7" class="empty">No stock movements found.</td></tr>';
}
async function editMovement(id) {
  const filter = document.getElementById("movement-item-filter").value;
  const response = await fetch(
    `/admin/api/inventory/movements?item_id=${encodeURIComponent(filter)}`,
  );
  const rows = await response.json();
  const row = rows.find((item) => item.id === id);
  if (!row) return;
  editingMovementId = id;
  document.getElementById("movement-modal-title").textContent =
    "Edit Stock Movement";
  const form = document.getElementById("movement-form");
  form.elements.item_id.value = row.item_id;
  form.elements.movement_type.value = row.movement_type;
  form.elements.quantity.value = row.quantity;
  form.elements.movement_date.value = row.movement_date;
  form.elements.reason.value = row.reason || "";
  document.getElementById("movement-error").textContent = "";
  movementModal.classList.remove("hidden");
}
async function deleteMovement(id, name) {
  if (
    !confirm(
      `Delete this stock movement for "${name}"? The item's quantity will be corrected.`,
    )
  )
    return;
  const response = await fetch(`/admin/api/inventory/movements/${id}`, {
    method: "DELETE",
  });
  const result = await response.json();
  if (!response.ok)
    return showToast(result.error || "Unable to delete movement.", true);
  showToast("Stock movement deleted and quantity corrected.");
  loadInventory();
  loadMovements();
}
document
  .getElementById("movement-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(
      editingMovementId
        ? `/admin/api/inventory/movements/${editingMovementId}`
        : "/admin/api/inventory/movements",
      {
        method: editingMovementId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      document.getElementById("movement-error").textContent =
        result.error || "Unable to save movement.";
      return;
    }
    movementModal.classList.add("hidden");
    event.currentTarget.reset();
    editingMovementId = null;
    showToast("Stock movement saved and quantity updated.");
    loadInventory();
    loadMovements();
  });
document.getElementById("add-item").addEventListener("click", () => {
  editingItemId = null;
  const form = document.getElementById("item-form");
  form.reset();
  document.getElementById("item-modal-title").textContent = "Add Item";
  document.getElementById("item-error").textContent = "";
  itemModal.classList.remove("hidden");
});
document.getElementById("add-movement").addEventListener("click", () => {
  editingMovementId = null;
  const form = document.getElementById("movement-form");
  form.reset();
  form.elements.movement_date.value = new Date().toISOString().slice(0, 10);
  document.getElementById("movement-modal-title").textContent =
    "Record Stock Movement";
  document.getElementById("movement-error").textContent = "";
  movementModal.classList.remove("hidden");
});
document
  .querySelectorAll('[data-close="item-modal"]')
  .forEach((button) =>
    button.addEventListener("click", () => itemModal.classList.add("hidden")),
  );
document
  .querySelectorAll('[data-close="movement-modal"]')
  .forEach((button) =>
    button.addEventListener("click", () =>
      movementModal.classList.add("hidden"),
    ),
  );
document.getElementById("item-search").addEventListener("input", loadInventory);
document
  .getElementById("movement-item-filter")
  .addEventListener("change", loadMovements);
function formatQuantity(value) {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(
    Number(value || 0),
  );
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
function escapeAttribute(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${isError ? "error" : ""}`;
  setTimeout(() => toast.classList.add("hidden"), 3500);
}
Promise.all([loadInventory(), loadMovements()]);
