let editingId = null;
const form = document.getElementById("employee-form");
const modal = document.getElementById("employee-modal");

async function loadEmployees() {
  const search = document.getElementById("employee-search").value.trim();
  const response = await fetch(
    `/admin/api/employees?search=${encodeURIComponent(search)}`,
  );
  if (!response.ok) return showToast("Unable to load employees.", true);
  const employees = await response.json();
  document.getElementById("employee-table").innerHTML = employees.length
    ? employees
        .map(
          (employee) =>
            `<tr><td><strong>${escapeHtml(employee.full_name)}</strong><small>${escapeHtml(employee.employee_id)}</small></td><td>${escapeHtml(employee.position)}</td><td>${escapeHtml(Number(employee.rate).toFixed(2))} / ${escapeHtml(employee.rate_type)}</td><td>${escapeHtml(employee.contact_number || "—")}</td><td><span class="status ${employee.status === "active" ? "completed" : "voided"}">${escapeHtml(employee.status)}</span></td><td>${escapeHtml(employee.date_hired)}</td><td class="action-cell"><button class="button secondary" type="button" onclick="editEmployee(${Number(employee.id)})">Edit</button> <button class="button danger" type="button" onclick="deleteEmployee(${Number(employee.id)}, '${escapeAttribute(employee.full_name)}')">Delete</button></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="7" class="empty">No employees found.</td></tr>';
}

async function editEmployee(id) {
  const response = await fetch("/admin/api/employees");
  const employees = await response.json();
  const employee = employees.find((item) => item.id === id);
  if (!employee) return;
  editingId = id;
  document.getElementById("employee-modal-title").textContent = "Edit Employee";
  Object.keys(employee).forEach((key) => {
    if (form.elements[key]) form.elements[key].value = employee[key];
  });
  document.getElementById("employee-error").textContent = "";
  modal.classList.remove("hidden");
}

async function deleteEmployee(id, name) {
  if (!confirm(`Delete employee ${name}? This cannot be undone.`)) return;
  const response = await fetch(`/admin/api/employees/${id}`, {
    method: "DELETE",
  });
  const result = await response.json();
  if (!response.ok)
    return showToast(result.error || "Unable to delete employee.", true);
  showToast("Employee deleted successfully.");
  loadEmployees();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const response = await fetch(
    editingId ? `/admin/api/employees/${editingId}` : "/admin/api/employees",
    {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  const result = await response.json();
  if (!response.ok) {
    document.getElementById("employee-error").textContent =
      result.error || "Unable to save employee.";
    return;
  }
  modal.classList.add("hidden");
  form.reset();
  editingId = null;
  showToast("Employee saved successfully.");
  loadEmployees();
});

document.getElementById("add-employee").addEventListener("click", () => {
  editingId = null;
  form.reset();
  document.getElementById("employee-modal-title").textContent = "Add Employee";
  document.getElementById("employee-error").textContent = "";
  modal.classList.remove("hidden");
});
document
  .querySelectorAll('[data-close="employee-modal"]')
  .forEach((button) =>
    button.addEventListener("click", () => modal.classList.add("hidden")),
  );
document
  .getElementById("employee-search")
  .addEventListener("input", loadEmployees);
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
loadEmployees();
