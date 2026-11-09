async function loadInventory() {
  const params = new URLSearchParams({
    search: document.getElementById("inventory-search").value.trim(),
    category: document.getElementById("category-filter").value,
    low_only: document.getElementById("low-only").checked ? "1" : "0",
  });
  const response = await fetch(`/kitchen/api/inventory?${params}`);
  if (!response.ok) return;
  const items = await response.json();
  document.getElementById("inventory-table").innerHTML = items.length ? items.map(item => {
    const statusClass = item.status === "In Stock" ? "in-stock" : item.status === "Low" ? "low" : "out";
    const highlighted = item.quantity <= item.reorder_level ? "low-highlight" : "";
    return `<tr class="${highlighted}">
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.unit)}</td>
      <td>${formatQuantity(item.quantity)}</td>
      <td>${formatQuantity(item.reorder_level)}</td>
      <td><span class="status ${statusClass}">${escapeHtml(item.status)}</span></td>
      <td><a class="button primary" href="/kitchen/stock?type=in&item=${Number(item.id)}">Stock In</a></td>
    </tr>`;
  }).join("") : '<tr><td colspan="7" class="empty">No inventory items found.</td></tr>';
}

async function loadCategories() {
  const response = await fetch("/kitchen/api/inventory/items");
  if (!response.ok) return;
  const items = await response.json();
  const categories = [...new Set(items.map(item => item.category))].sort();
  document.getElementById("category-filter").insertAdjacentHTML("beforeend",
    categories.map(category => `<option value="${escapeAttribute(category)}">${escapeHtml(category)}</option>`).join("")
  );
}

document.getElementById("inventory-search").addEventListener("input", loadInventory);
document.getElementById("category-filter").addEventListener("change", loadInventory);
document.getElementById("low-only").addEventListener("change", loadInventory);
function formatQuantity(value) { return Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 }); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[character]); }
function escapeAttribute(value) { return String(value ?? "").replace(/"/g, "&quot;"); }
loadCategories();
loadInventory();
