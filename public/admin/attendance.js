let editingId = null;
const form = document.getElementById('attendance-form');
const modal = document.getElementById('attendance-modal');

async function loadEmployees() {
  const response = await fetch('/admin/api/employees');
  if (!response.ok) return;
  const employees = await response.json();
  const options = employees.map(employee => `<option value="${Number(employee.id)}">${escapeHtml(employee.employee_id)} - ${escapeHtml(employee.full_name)}</option>`).join('');
  document.getElementById('attendance-employee').innerHTML = '<option value="">All employees</option>' + options;
  document.getElementById('attendance_employee').innerHTML = '<option value="">Select employee</option>' + options;
}

async function loadAttendance() {
  const date = document.getElementById('attendance-date').value;
  const employeeId = document.getElementById('attendance-employee').value;
  const response = await fetch(`/admin/api/attendance?date=${encodeURIComponent(date)}&employee_id=${encodeURIComponent(employeeId)}`);
  if (!response.ok) return showToast('Unable to load attendance.', true);
  const records = await response.json();
  document.getElementById('attendance-table').innerHTML = records.length ? records.map(record => `<tr><td><strong>${escapeHtml(record.full_name)}</strong><small>${escapeHtml(record.employee_code)}</small></td><td>${escapeHtml(record.attendance_date)}</td><td>${escapeHtml(record.time_in || '—')}</td><td>${escapeHtml(record.time_out || '—')}</td><td><span class="status ${record.status === 'present' || record.status === 'late' ? 'completed' : 'voided'}">${escapeHtml(record.status)}</span></td><td>${Number(record.hours_worked).toFixed(2)}</td><td class="action-cell"><button class="button secondary" type="button" onclick="editAttendance(${Number(record.id)})">Edit</button> <button class="button danger" type="button" onclick="deleteAttendance(${Number(record.id)}, '${escapeAttribute(record.full_name)}', '${escapeAttribute(record.attendance_date)}')">Delete</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty">No attendance records found.</td></tr>';
}

async function editAttendance(id) {
  const response = await fetch(`/admin/api/attendance`);
  const records = await response.json();
  const record = records.find(item => item.id === id);
  if (!record) return;
  editingId=id; document.getElementById('attendance-modal-title').textContent='Edit Attendance';
  form.elements.employee_id.value=record.employee_id; form.elements.attendance_date.value=record.attendance_date; form.elements.time_in.value=record.time_in || ''; form.elements.time_out.value=record.time_out || ''; form.elements.status.value=record.status;
  updateHoursPreview(); document.getElementById('attendance-error').textContent=''; modal.classList.remove('hidden');
}

async function deleteAttendance(id, name, date) {
  if (!confirm(`Delete attendance for ${name} on ${date}?`)) return;
  const response = await fetch(`/admin/api/attendance/${id}`, { method:'DELETE' }); const result=await response.json();
  if (!response.ok) return showToast(result.error || 'Unable to delete attendance.', true);
  showToast('Attendance deleted successfully.'); loadAttendance();
}

form.addEventListener('submit', async event => { event.preventDefault(); const data=Object.fromEntries(new FormData(form)); const response=await fetch(editingId?`/admin/api/attendance/${editingId}`:'/admin/api/attendance',{method:editingId?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); const result=await response.json(); if(!response.ok){document.getElementById('attendance-error').textContent=result.error||'Unable to save attendance.';return;} modal.classList.add('hidden');form.reset();editingId=null;showToast('Attendance saved successfully.');loadAttendance(); });

function updateHoursPreview() { const start=form.elements.time_in.value;const end=form.elements.time_out.value;if(!start||!end)return document.getElementById('hours_preview').value='0.00 hours';const [sh,sm]=start.split(':').map(Number);const [eh,em]=end.split(':').map(Number);const minutes=eh*60+em-(sh*60+sm);document.getElementById('hours_preview').value=(minutes>0?minutes/60:0).toFixed(2)+' hours'; }
form.elements.time_in.addEventListener('change',updateHoursPreview); form.elements.time_out.addEventListener('change',updateHoursPreview);
document.getElementById('add-attendance').addEventListener('click',()=>{editingId=null;form.reset();form.elements.attendance_date.value=new Date().toISOString().slice(0,10);document.getElementById('attendance-modal-title').textContent='Add Attendance';document.getElementById('attendance-error').textContent='';updateHoursPreview();modal.classList.remove('hidden');});
document.querySelectorAll('[data-close="attendance-modal"]').forEach(button=>button.addEventListener('click',()=>modal.classList.add('hidden')));
document.getElementById('attendance-date').addEventListener('change',loadAttendance);document.getElementById('attendance-employee').addEventListener('change',loadAttendance);document.getElementById('clear-attendance-filter').addEventListener('click',()=>{document.getElementById('attendance-date').value='';document.getElementById('attendance-employee').value='';loadAttendance();});
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[character]);}function escapeAttribute(value){return String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}function showToast(message,isError=false){const toast=document.getElementById('toast');toast.textContent=message;toast.className=`toast ${isError?'error':''}`;setTimeout(()=>toast.classList.add('hidden'),3500);}Promise.all([loadEmployees(),loadAttendance()]);
