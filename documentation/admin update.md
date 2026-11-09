# Scrap-Wise Admin Update

## Phase completed: Shared Admin Navigation and Dashboard (A-01)

### Files added

- `c:\Users\Elisar\Documents\ScrapWise\public\admin\nav.html`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\nav.js`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\dashboard.html`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\dashboard.js`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\admin.css`

### Files changed

- `c:\Users\Elisar\Documents\ScrapWise\routes\admin.js`
- `c:\Users\Elisar\Documents\ScrapWise\models\database.js`
- `c:\Users\Elisar\Documents\ScrapWise\index.js`

No new npm package is required for this phase. Chart.js is loaded in the dashboard from its CDN.

## Main server changes

No package installation change is required for this phase. The existing `index.js` must continue mounting the admin router as:

```js
app.use("/admin", adminRoutes);
```

The old inline `/admin/dashboard` route in `index.js` has been removed because it used a non-admin dashboard renderer and prevented the new router from handling the page. Keep the session middleware before mounting `adminRoutes`.

## Admin router changes

`routes/admin.js` now:

- Protects every `/admin` page and API with `requireAdmin`.
- Redirects unauthenticated users and non-admin users to `/`.
- Serves the dashboard from `/admin/dashboard`.
- Provides navigation metadata from `GET /admin/api/nav`.
- Provides summary cards and chart data from `GET /admin/api/dashboard`.
- Provides unread notifications from `GET /admin/api/alerts`.
- Supports marking one alert or all alerts as read.
- Keeps the existing user approval actions at `/admin/users/:id/approve` and `/admin/users/:id/decline`.

## Database changes

The database module now creates the tables needed for the first Admin modules:

- employees
- attendance
- menu_items
- inventory_items
- stock_movements
- transactions
- transaction_items
- waste_logs
- iot_devices
- alerts
- settings
- audit_log

Sample data is inserted only when the corresponding table is empty. It includes comments marking it as sample data that should be removed or replaced for production.

## Dashboard behavior

The dashboard loads its values from `GET /admin/api/dashboard` and displays:

- Today's sales total
- Today's transaction count
- Low-stock item count
- Employees present today
- Total waste weight today
- Pending user approvals
- Seven-day sales chart
- Seven-day waste chart
- Low-stock list
- Recent five transactions
- Recent alerts

The reusable sidebar is loaded by `nav.js` from `nav.html`. It highlights the active page, supports the mobile hamburger menu, shows pending user approvals, and displays unread notification alerts.

## Install and run

If Express dependencies have not been installed yet, run:

```powershell
npm install
npm start
```

Log in with the seeded account:

```text
Username: admin001
Password: admin
```

Open:

```text
http://localhost:3000/admin/dashboard
```

## A-02 continuation completed: Employees and Attendance

### Files added

- `c:\Users\Elisar\Documents\ScrapWise\public\admin\employees.html`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\employees.js`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\attendance.html`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\attendance.js`

### Files updated

- `c:\Users\Elisar\Documents\ScrapWise\routes\admin.js`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\admin.css`
- `c:\Users\Elisar\Documents\ScrapWise\index.js`

### Added Admin routes

Employees:

- `GET /admin/employees`
- `GET /admin/api/employees?search=`
- `POST /admin/api/employees`
- `PUT /admin/api/employees/:id`
- `DELETE /admin/api/employees/:id`

Attendance:

- `GET /admin/attendance`
- `GET /admin/api/attendance?date=&employee_id=`
- `POST /admin/api/attendance`
- `PUT /admin/api/attendance/:id`
- `DELETE /admin/api/attendance/:id`

### A-02 behavior

- Employees support search plus Add, Edit and Delete confirmation.
- Employee records validate required fields and prevent duplicate employee IDs.
- Employees linked to attendance cannot be deleted; they can be set to inactive instead.
- Attendance supports date and employee filters, Add, Edit, and Delete.
- Duplicate attendance for the same employee and date is prevented.
- Hours worked are calculated automatically from time-in and time-out.
- Employee and attendance changes are written to the existing `audit_log` table.
- All new `/admin` pages, static Admin assets, APIs, and routes require an authenticated Admin.

No new npm package is required.

## Run and verify

```powershell
npm install
npm start
```

Open:

```text
http://localhost:3000/admin/employees
http://localhost:3000/admin/attendance
```

## A-03 completed: Payroll

### Files added

- `c:\Users\Elisar\Documents\ScrapWise\public\admin\payroll.html`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\payroll.js`

### Files updated

- `c:\Users\Elisar\Documents\ScrapWise\models\database.js`
- `c:\Users\Elisar\Documents\ScrapWise\routes\admin.js`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\admin.css`

### New database table

- `payroll_records`

Stores pay-cycle dates, employee attendance totals, regular pay, overtime, deductions, adjustments, net pay, approval status, approver, and approval timestamp.

### New Admin routes

- `GET /admin/payroll`
- `GET /admin/payroll/payslip/:id`
- `GET /admin/api/payroll`
- `POST /admin/api/payroll/compute`
- `PUT /admin/api/payroll/:id`
- `POST /admin/api/payroll/:id/approve`
- `POST /admin/api/payroll/approve-cycle`
- `POST /admin/api/payroll/unlock-cycle`
- `DELETE /admin/api/payroll/:id`

### A-03 behavior

- Select a start/end date, configure common deductions, and compute payroll for all active employees.
- Daily employees are paid by attended days; hourly employees are paid from attendance hours.
- Hours beyond 8 per attendance record are calculated as overtime at 1.25 times the base rate.
- Draft payroll records support adjustments and editable deduction amounts.
- Approved records are locked and cannot be recomputed, edited, or deleted until the cycle is unlocked.
- Approved records provide printable/save-as-PDF payslips for LAHOK Restaurant.
- Payroll computations, edits, approvals, unlocking, and deletion are recorded in `audit_log`.

No new npm package is required. The payslip uses the browser Print / Save as PDF feature.

### Run and verify

```powershell
npm install
npm start
```

Open:

```text
http://localhost:3000/admin/payroll
```

## A-04 completed: Inventory

### Files added

- `c:\Users\Elisar\Documents\ScrapWise\public\admin\inventory.html`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\inventory.js`

### Files updated

- `c:\Users\Elisar\Documents\ScrapWise\models\database.js`
- `c:\Users\Elisar\Documents\ScrapWise\routes\admin.js`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\admin.css`

### New or used database tables

- `inventory_items`
- `stock_movements`
- `audit_log`

### Added Admin routes

- `GET /admin/inventory`
- `GET /admin/api/inventory?search=`
- `POST /admin/api/inventory`
- `PUT /admin/api/inventory/:id`
- `DELETE /admin/api/inventory/:id`
- `GET /admin/api/inventory/movements?item_id=`
- `POST /admin/api/inventory/movements`
- `PUT /admin/api/inventory/movements/:id`
- `DELETE /admin/api/inventory/movements/:id`

### A-04 behavior

- Inventory supports search plus full Add, Edit, and Delete operations.
- Item quantity, status, unit, category, and reorder level are displayed and validated.
- Low stock and out-of-stock rows are highlighted.
- Stock-In and Stock-Out movement records update item quantity atomically.
- Stock-Out is prevented when it would make quantity negative.
- Editing a movement rolls back the original quantity effect and applies the corrected movement.
- Deleting a movement reverses its quantity effect.
- Movements can record item, date, reason, and the logged-in recorder.
- Inventory edits, deletions, and movement changes are recorded in `audit_log`.
- Inventory items with movement history cannot be deleted, preserving stock records.

No new npm package is required.

### Run and verify

```powershell
npm install
npm start
```

Open:

```text
http://localhost:3000/admin/inventory
```

## A-05 completed: Transactions

### Files added

- `c:\Users\Elisar\Documents\ScrapWise\public\admin\transactions.html`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\transactions.js`

### Files updated

- `c:\Users\Elisar\Documents\ScrapWise\routes\admin.js`
- `c:\Users\Elisar\Documents\ScrapWise\admin update.md`

### Added Admin routes

- `GET /admin/transactions`
- `GET /admin/api/transactions?start=&end=&search=`
- `GET /admin/api/transactions/:id`
- `PUT /admin/api/transactions/:id`
- `POST /admin/api/transactions/:id/void`

### A-05 behavior

- Displays transaction ID, date/time, cashier, items, total, payment method, and status.
- Supports date-range and search filtering.
- Opens transaction details with editable payment method and line items.
- Recomputes line subtotals and the transaction total on correction.
- Voids transactions only after a required reason is entered.
- Stores who voided a transaction and when it was voided.
- Keeps voided transactions visible and excludes them from sales totals by status.
- Correction and void actions are written to the existing audit log.
- All routes remain protected by the Admin middleware.

No new npm package is required.

### Verification

- `node --check routes/admin.js` passed.
- `node --check public/admin/transactions.js` passed.

Open:

```text
http://localhost:3000/admin/transactions
```

## A-06 completed: User Management

### Files added

- `c:\Users\Elisar\Documents\ScrapWise\public\admin\users.html`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\users.js`
- `c:\Users\Elisar\Documents\ScrapWise\public\change-password.html`
- `c:\Users\Elisar\Documents\ScrapWise\public\change-password.js`

### Files updated

- `c:\Users\Elisar\Documents\ScrapWise\models\database.js`
- `c:\Users\Elisar\Documents\ScrapWise\routes\auth.js`
- `c:\Users\Elisar\Documents\ScrapWise\routes\admin.js`
- `c:\Users\Elisar\Documents\ScrapWise\index.js`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\admin.css`

### New user schema columns

- `is_active` — active/deactivated account flag
- `must_change_password` — forces a password change after an administrator reset

### Added or updated routes

- `GET /admin/users`
- `GET /admin/api/users?status=pending|approved|declined|all`
- `POST /admin/api/users/:id/approve`
- `POST /admin/api/users/:id/decline`
- `PUT /admin/api/users/:id/role`
- `PUT /admin/api/users/:id/status`
- `POST /admin/api/users/:id/reset-password`
- `GET /change-password`
- `POST /api/change-password`

### A-06 behavior

- User Management has Pending Registrations and All Users tabs.
- Pending registrations can be approved or declined.
- Administrators can change approved or registered user roles.
- Administrators can activate or deactivate accounts, except their own account.
- Account deactivation is enforced during login.
- Password resets create a bcrypt-hashed temporary password.
- A user with a temporary password is redirected to `/change-password` at login.
- Password changes require at least six characters and matching confirmation values.
- User role, approval, decline, account-state, and password-reset actions are logged in `audit_log`.

No new npm package is required.

### Verification status

- File changes are complete.
- Runtime syntax verification could not be executed because terminal/Node execution tooling was unavailable in this environment.
- Restart the server before testing A-06 so the database compatibility columns are created automatically:

```powershell
npm start
```

Open:

```text
http://localhost:3000/admin/users
```

## Employee and Attendance JavaScript fix

### Files fixed

- `c:\Users\Elisar\Documents\ScrapWise\public\admin\employees.js`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\attendance.js`

### Issue corrected

Both scripts contained invalid JavaScript in `escapeAttribute()` due to a malformed backslash regular expression. The invalid regex could stop the entire browser script from executing, breaking page loading, Edit, Delete, modal, and form handlers.

The helper now correctly escapes backslashes and single quotes for names passed to inline JavaScript handlers.

No npm package changes or server-route changes are required. Refresh the browser after restarting the server if static files remain cached.

## A-07 completed: Settings and IoT Devices

### Files added

- `c:\Users\Elisar\Documents\ScrapWise\public\admin\settings.html`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\settings.js`

### Files updated

- `c:\Users\Elisar\Documents\ScrapWise\routes\admin.js`
- `c:\Users\Elisar\Documents\ScrapWise\routes\auth.js`
- `c:\Users\Elisar\Documents\ScrapWise\public\admin\admin.css`

### Added routes

Admin routes:

- `GET /admin/settings`
- `GET /admin/api/settings`
- `PUT /admin/api/settings`
- `GET /admin/api/iot-devices`
- `POST /admin/api/iot-devices`
- `PUT /admin/api/iot-devices/:id`
- `DELETE /admin/api/iot-devices/:id`
- `POST /admin/api/iot-devices/:id/api-key`

Public device API:

- `POST /api/waste-readings`

The waste-reading endpoint requires the header `x-api-key` and the matching device ID in JSON.

### A-07 behavior

- Admin can configure waste capacity and warning percentage.
- Device IDs and names are validated and duplicate IDs are rejected.
- Devices support Add, Edit, Delete, and API-key regeneration.
- Device status is calculated as online when received within the last 15 minutes; otherwise it is offline.
- Waste readings update last reading/received time and are inserted into `waste_logs`.
- Waste capacity thresholds and item reorder levels create unread notifications.
- Alert-generation actions are protected and notification dropdown data continues to use the existing alert APIs.
- Settings and IoT CRUD actions are recorded in `audit_log`.

No new npm package is required.

### Verification

Restart and open:

```powershell
npm start
```

```text
http://localhost:3000/admin/settings
```

Example microcontroller request:

```text
POST /api/waste-readings
Header: x-api-key: <generated-key>
JSON: { "device_id": "KITCHEN-SCALE-1", "weight": 12.5, "timestamp": "2026-10-31T10:00:00.000Z" }
```

## A-08 completed: Waste Analytics and Report Validation

### Files added

- `public/admin/waste.html`
- `public/admin/waste.js`
- `public/admin/reports.html`
- `public/admin/reports.js`

### Behavior

- Waste Analytics provides validated start/end filters and optional device filtering.
- Waste summaries include total waste, reading count, average reading, and peak reading.
- Daily trend and device breakdown charts are generated from `waste_logs`.
- Waste reading detail is limited to the latest 500 matching records.
- Reports support Sales, Transactions, Inventory, Waste, and Payroll data.
- Server-side validation rejects invalid dates, reversed ranges, and ranges longer than 366 days.
- CSV exports use safe escaping and are audit logged.

### API routes

- `GET /admin/api/waste-analytics`
- `GET /admin/api/reports/:type`
- Add `?export=csv` to a report route to download the validated CSV.
