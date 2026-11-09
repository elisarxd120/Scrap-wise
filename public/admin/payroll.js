let editingId = null;
const cycleForm = document.getElementById("cycle-form");
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
document.getElementById("cycle-end").value = today();
const start = new Date();
start.setDate(1);
document.getElementById("cycle-start").value =
  `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;

async function loadPayroll() {
  const start = document.getElementById("cycle-start").value;
  const end = document.getElementById("cycle-end").value;
  if (!start || !end) return;
  const response = await fetch(
    `/admin/api/payroll?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
  );
  if (!response.ok) return showToast("Unable to load payroll.", true);
  const records = await response.json();
  renderPayroll(records);
}
function renderPayroll(records) {
  const body = document.getElementById("payroll-table");
  if (!records.length) {
    body.innerHTML =
      '<tr><td colspan="11" class="empty">No payroll records for this cycle. Compute payroll to create drafts.</td></tr>';
    document.getElementById("cycle-status").textContent = "No records";
    document.getElementById("cycle-status").className = "status";
    return;
  }
  const approved = records.every((record) => record.status === "approved");
  document.getElementById("cycle-status").textContent = approved
    ? "Approved / Locked"
    : "Draft";
  document.getElementById("cycle-status").className =
    `status ${approved ? "completed" : "voided"}`;
  body.innerHTML = records
    .map((record) => {
      let deductions = {};
      try {
        deductions = JSON.parse(record.deductions_json || "{}");
      } catch (_) {
        deductions = {};
      }
      const deductionTotal = Object.values(deductions).reduce(
        (sum, amount) => sum + Number(amount || 0),
        0,
      );
      return `<tr><td><strong>${escapeHtml(record.full_name)}</strong><small>${escapeHtml(record.employee_code)} · ${escapeHtml(record.position)}</small></td><td>${Number(record.days_worked).toFixed(1)}</td><td>${Number(record.hours_worked).toFixed(2)}</td><td>${formatMoney(record.regular_pay)}</td><td><strong>${formatMoney(record.overtime_pay)}</strong><small>${Number(record.overtime_hours).toFixed(2)} hrs</small></td><td>${formatMoney(record.gross_pay)}</td><td>${formatMoney(record.adjustments)}</td><td>${formatMoney(deductionTotal)}</td><td><strong>${formatMoney(record.net_pay)}</strong></td><td><span class="status ${record.status === "approved" ? "completed" : "voided"}">${escapeHtml(record.status)}</span></td><td class="action-cell">${record.status === "draft" ? `<button class="button secondary" type="button" onclick="editPayroll(${Number(record.id)})">Edit</button> <button class="button danger" type="button" onclick="deletePayroll(${Number(record.id)},'${escapeAttribute(record.full_name)}')">Delete</button>` : `<a class="button success payslip-link" href="/admin/payroll/payslip/${Number(record.id)}" target="_blank">Payslip</a>`}${record.status === "draft" ? `<button class="button success" type="button" onclick="approvePayroll(${Number(record.id)})">Approve</button>` : ""}</td></tr>`;
    })
    .join("");
}

cycleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = {
    start_date: document.getElementById("cycle-start").value,
    end_date: document.getElementById("cycle-end").value,
    deductions: {
      SSS: Number(document.getElementById("deduction-sss").value || 0),
      PhilHealth: Number(
        document.getElementById("deduction-philhealth").value || 0,
      ),
      "Pag-IBIG": Number(
        document.getElementById("deduction-pagibig").value || 0,
      ),
      "Cash advance": Number(
        document.getElementById("deduction-cash").value || 0,
      ),
      "Late penalties": Number(
        document.getElementById("deduction-late").value || 0,
      ),
    },
  };
  const response = await fetch("/admin/api/payroll/compute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    return showToast(result.error || "Unable to compute payroll.", true);
  showToast(`Payroll computed for ${result.records} employees.`);
  loadPayroll();
});

async function editPayroll(id) {
  const start = document.getElementById("cycle-start").value;
  const end = document.getElementById("cycle-end").value;
  const response = await fetch(
    `/admin/api/payroll?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
  );
  const records = await response.json();
  const record = records.find((item) => item.id === id);
  if (!record) return;
  editingId = id;
  let deductions = {};
  try {
    deductions = JSON.parse(record.deductions_json || "{}");
  } catch (_) {
    deductions = {};
  }
  document.getElementById("deduction-editor").innerHTML = Object.entries(
    deductions,
  )
    .map(
      ([name, amount]) =>
        `<label>${escapeHtml(name)} <input data-deduction-name="${escapeAttribute(name)}" type="number" min="0" step="0.01" value="${Number(amount || 0)}"></label>`,
    )
    .join("");
  document.getElementById("adjustments").value = Number(
    record.adjustments || 0,
  );
  document.getElementById("payroll-error").textContent = "";
  document.getElementById("payroll-modal").classList.remove("hidden");
}
document
  .getElementById("payroll-edit-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const deductions = {};
    document
      .querySelectorAll("[data-deduction-name]")
      .forEach(
        (input) =>
          (deductions[input.dataset.deductionName] = Number(input.value || 0)),
      );
    const adjustments = Number(
      document.getElementById("adjustments").value || 0,
    );
    const response = await fetch(`/admin/api/payroll/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deductions, adjustments }),
    });
    const result = await response.json();
    if (!response.ok) {
      document.getElementById("payroll-error").textContent =
        result.error || "Unable to save payroll.";
      return;
    }
    document.getElementById("payroll-modal").classList.add("hidden");
    showToast("Payroll draft updated.");
    loadPayroll();
  });

async function deletePayroll(id, name) {
  if (!confirm(`Delete the draft payroll record for ${name}?`)) return;
  const response = await fetch(`/admin/api/payroll/${id}`, {
    method: "DELETE",
  });
  const result = await response.json();
  if (!response.ok)
    return showToast(result.error || "Unable to delete payroll.", true);
  showToast("Payroll record deleted.");
  loadPayroll();
}
async function approvePayroll(id) {
  if (!confirm("Approve this payroll record? It will be locked.")) return;
  const response = await fetch(`/admin/api/payroll/${id}/approve`, {
    method: "POST",
  });
  const result = await response.json();
  if (!response.ok)
    return showToast(result.error || "Unable to approve payroll.", true);
  showToast("Payroll record approved.");
  loadPayroll();
}
document.getElementById("approve-cycle").addEventListener("click", async () => {
  if (
    !confirm(
      "Approve every draft record in this cycle? Records will be locked.",
    )
  )
    return;
  const response = await fetch("/admin/api/payroll/approve-cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_date: document.getElementById("cycle-start").value,
      end_date: document.getElementById("cycle-end").value,
    }),
  });
  const result = await response.json();
  if (!response.ok)
    return showToast(result.error || "Unable to approve cycle.", true);
  showToast("Payroll cycle approved.");
  loadPayroll();
});
document.getElementById("unlock-cycle").addEventListener("click", async () => {
  if (!confirm("Unlock this approved cycle for editing and recomputation?"))
    return;
  const response = await fetch("/admin/api/payroll/unlock-cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_date: document.getElementById("cycle-start").value,
      end_date: document.getElementById("cycle-end").value,
    }),
  });
  const result = await response.json();
  if (!response.ok)
    return showToast(result.error || "Unable to unlock cycle.", true);
  showToast("Payroll cycle unlocked.");
  loadPayroll();
});
document
  .querySelectorAll('[data-close="payroll-modal"]')
  .forEach((button) =>
    button.addEventListener("click", () =>
      document.getElementById("payroll-modal").classList.add("hidden"),
    ),
  );
document.getElementById("cycle-start").addEventListener("change", loadPayroll);
document.getElementById("cycle-end").addEventListener("change", loadPayroll);
function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value || 0));
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
loadPayroll();
