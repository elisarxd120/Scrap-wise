# Supabase Integration Guide

This guide describes how to replace the SQLite database used by ScrapWise with Supabase PostgreSQL and what tables, columns, indexes, security rules, and application changes are required.

## Architecture

Keep the Express application as the backend. The browser should continue calling the existing `/api`, `/admin`, `/pos`, and `/kitchen` routes.

```text
Browser
  -> Express routes
  -> Supabase server client using SUPABASE_SERVICE_ROLE_KEY
  -> Supabase PostgreSQL

IoT scale
  -> POST /api/waste-readings
  -> Express validates device_id and api_key
  -> Supabase PostgreSQL
```

Do not expose the service-role key in HTML or JavaScript. Never put `SUPABASE_SERVICE_ROLE_KEY` in a Vite, React, browser, or public environment variable.

The existing custom login system stores bcrypt password hashes in the `users` table. Supabase Auth can be integrated later, but it is not required for the database migration. Keep the service-role backend until the session and role system has been deliberately migrated to Supabase Auth/RLS.

## 1. Create the Supabase project

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Choose a database password and store it securely.
3. Wait for provisioning to finish.
4. Open **Project Settings > API** and copy:
   - Project URL
   - `anon` public key (optional for browser-side features)
   - `service_role` secret key (server only)
5. Add these server environment variables:

```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_SECRET
SUPABASE_DB_PASSWORD=YOUR_DATABASE_PASSWORD
SESSION_SECRET=use-a-long-random-production-secret
```

Generate a separate session secret, for example:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2. Install the Supabase client

```powershell
npm install @supabase/supabase-js
```

Create `models/supabase.js`:

```js
const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured",
  );
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

module.exports = supabase;
```

The service-role client bypasses Row Level Security and is appropriate only in trusted Express server code.

## 3. Run this schema in Supabase SQL Editor

Create the tables in the `public` schema. This schema preserves all application features currently implemented in SQLite.

```sql
create type user_role as enum ('Admin', 'Kitchen Staff', 'POS Staff');
create type user_status as enum ('pending', 'approved', 'declined');
create type employee_status as enum ('active', 'inactive');
create type rate_type as enum ('daily', 'hourly');
create type attendance_status as enum ('present', 'late', 'absent', 'leave');
create type stock_movement_type as enum ('in', 'out');
create type transaction_status as enum ('completed', 'voided');
create type order_type as enum ('dine-in', 'take-out');
create type order_status as enum ('held', 'paid', 'cancelled');
create type payroll_status as enum ('draft', 'approved');

create table public.users (
  id bigint generated always as identity primary key,
  full_name text not null,
  username text not null unique,
  password_hash text not null,
  role user_role not null,
  status user_status not null,
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  constraint users_username_trimmed check (length(btrim(username)) > 0)
);

create table public.employees (
  id bigint generated always as identity primary key,
  employee_id text not null unique,
  full_name text not null,
  position text not null,
  rate numeric(12, 2) not null check (rate >= 0),
  rate_type rate_type not null,
  contact_number text,
  status employee_status not null default 'active',
  date_hired date not null
);

create table public.attendance (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id),
  attendance_date date not null,
  time_in time,
  time_out time,
  status attendance_status not null,
  hours_worked numeric(8, 2) not null default 0 check (hours_worked >= 0)
);

create table public.menu_items (
  id bigint generated always as identity primary key,
  name text not null unique,
  price numeric(12, 2) not null check (price >= 0),
  is_available boolean not null default true
);

create table public.inventory_items (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null,
  unit text not null,
  quantity numeric(14, 3) not null default 0,
  reorder_level numeric(14, 3) not null default 0
);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.inventory_items(id),
  movement_type stock_movement_type not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  movement_date date not null,
  reason text,
  recorded_by bigint references public.users(id),
  created_at timestamptz not null default now()
);

create table public.transactions (
  id bigint generated always as identity primary key,
  transaction_code text not null unique,
  transaction_date timestamptz not null,
  cashier_id bigint references public.users(id),
  total numeric(12, 2) not null default 0 check (total >= 0),
  payment_method text not null,
  status transaction_status not null default 'completed',
  void_reason text,
  voided_by bigint references public.users(id),
  voided_at timestamptz,
  subtotal numeric(12, 2),
  discount_percentage numeric(5, 2) check (
    discount_percentage >= 0 and discount_percentage <= 100
  ),
  order_type order_type,
  table_number text
);

create table public.transaction_items (
  id bigint generated always as identity primary key,
  transaction_id bigint not null
    references public.transactions(id) on delete cascade,
  item_id bigint references public.menu_items(id),
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0)
);

create table public.pos_orders (
  id bigint generated always as identity primary key,
  order_code text not null unique,
  order_date timestamptz not null,
  cashier_id bigint not null references public.users(id),
  order_type order_type not null,
  table_number text,
  total numeric(12, 2) not null default 0 check (total >= 0),
  status order_status not null default 'held',
  paid_transaction_id bigint references public.transactions(id)
);

create table public.pos_order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null
    references public.pos_orders(id) on delete cascade,
  menu_item_id bigint references public.menu_items(id),
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0)
);

create table public.iot_devices (
  id bigint generated always as identity primary key,
  device_id text not null unique,
  name text not null,
  api_key text not null unique,
  status text not null default 'offline',
  last_reading numeric(14, 3),
  last_received_at timestamptz,
  calibration_date date
);

create table public.waste_logs (
  id bigint generated always as identity primary key,
  device_id text not null,
  weight numeric(14, 3) not null check (weight >= 0),
  recorded_at timestamptz not null,
  processing_status text not null default 'recorded',
  before_weight numeric(14, 3),
  after_weight numeric(14, 3),
  recorded_by bigint references public.users(id),
  created_at timestamptz not null default now()
);

create table public.alerts (
  id bigint generated always as identity primary key,
  alert_type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value text not null
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id bigint references public.users(id),
  action text not null,
  record_type text not null,
  record_id text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table public.payroll_records (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id),
  cycle_start date not null,
  cycle_end date not null,
  days_worked numeric(8, 2) not null default 0,
  hours_worked numeric(8, 2) not null default 0,
  regular_pay numeric(12, 2) not null default 0,
  gross_pay numeric(12, 2) not null default 0,
  overtime_hours numeric(8, 2) not null default 0,
  overtime_pay numeric(12, 2) not null default 0,
  deductions_json jsonb not null default '{}'::jsonb,
  adjustments numeric(12, 2) not null default 0,
  net_pay numeric(12, 2) not null default 0,
  status payroll_status not null default 'draft',
  approved_by bigint references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (employee_id, cycle_start, cycle_end),
  check (cycle_end >= cycle_start)
);
```

## 4. Add indexes

These indexes support the queries, date reports, kitchen stock checks, alert checks, and transaction lookups used by the application.

```sql
create index attendance_employee_date_idx
  on public.attendance (employee_id, attendance_date);
create index stock_movements_item_date_idx
  on public.stock_movements (item_id, movement_date desc);
create index stock_movements_recorded_by_idx
  on public.stock_movements (recorded_by);
create index transactions_cashier_idx
  on public.transactions (cashier_id);
create index transactions_date_idx
  on public.transactions (transaction_date desc);
create index transaction_items_transaction_idx
  on public.transaction_items (transaction_id);
create index pos_orders_cashier_status_idx
  on public.pos_orders (cashier_id, status);
create index pos_order_items_order_idx
  on public.pos_order_items (order_id);
create index waste_logs_device_date_idx
  on public.waste_logs (device_id, recorded_at desc);
create index alerts_unread_type_idx
  on public.alerts (alert_type, is_read, created_at desc);
create index audit_log_created_idx
  on public.audit_log (created_at desc);
create index payroll_employee_cycle_idx
  on public.payroll_records (employee_id, cycle_start, cycle_end);
```

## 5. Enable Row Level Security

Because all routes presently use a server-side Supabase client, enable RLS on every table and add no permissive browser policy.

```sql
alter table public.users enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.menu_items enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.pos_orders enable row level security;
alter table public.pos_order_items enable row level security;
alter table public.iot_devices enable row level security;
alter table public.waste_logs enable row level security;
alter table public.alerts enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;
alter table public.payroll_records enable row level security;
```

The service-role key bypasses these policies. Do not expose a table policy, anonymous table access, or a direct browser `select`/`insert` call for these tables until the app uses Supabase Auth and complete role policies.

## 6. Seed the first users and settings

Bcrypt hashes cannot be generated in PostgreSQL using the previous SQLite hashes as-is, and existing hashes can be copied from SQLite without modification.

Required non-sample settings:

```sql
insert into public.settings (key, value) values
  ('waste_capacity_kg', '50'),
  ('waste_warning_percent', '80')
on conflict (key) do update set value = excluded.value;
```

For a fresh installation, generate a new admin password hash in Node.js and insert the result:

```powershell
node -e "console.log(require('bcrypt').hashSync('choose-a-new-password', 10))"
```

```sql
insert into public.users (
  full_name, username, password_hash, role, status, is_active, must_change_password
)
values (
  'Administrator',
  'admin001',
  '$2b$YOUR_GENERATED_BCRYPT_HASH',
  'Admin',
  'approved',
  true,
  true
);
```

Immediately change the seeded password after deployment. Remove any sample kitchen account, employees, menu items, transactions, and waste logs rather than migrating them into a production database.

## 7. Migrate SQLite data

Use the existing `data.sqlite` as the source. A migration can export each SQLite table to a JSON/CSV file and then import it with a Node script or the Supabase dashboard.

Before migration:

1. Stop the SQLite application.
2. Back up `data.sqlite`.
3. Confirm that menu items with missing `is_available` values should default to `true`.
4. Confirm that POS orders with missing `table_number` values should default to `NULL`.
5. Convert SQLite booleans `0`/`1` to PostgreSQL `false`/`true`.
6. Convert SQLite date strings to ISO `timestamptz`, `date`, or `time` values depending on the column.
7. Use numeric values rather than SQLite floating-point values for money.
8. Preserve primary-key relationships with explicit ID maps, because newly inserted PostgreSQL IDs may differ.

Recommended migration order:

```text
users
employees
attendance
menu_items
inventory_items
stock_movements
transactions
transaction_items
pos_orders
pos_order_items
iot_devices
waste_logs
alerts
settings
audit_log
payroll_records
```

For large datasets, import CSV or use a scripted server migration. PostgreSQL identity sequences must be updated after importing explicit IDs:

```sql
select setval(
  pg_get_serial_sequence('public.users', 'id'),
  coalesce((select max(id) from public.users), 1),
  true
);
```

Repeat with every sequence-bearing table. Supabase's generated identities support `setval` with the sequence returned by `pg_get_serial_sequence`.

## 8. Replace `better-sqlite3` calls

Supabase methods are asynchronous. Routes that currently use `db.prepare(...).get/all/run` and `db.transaction(...)` must be changed.

Typical conversion:

```js
// SQLite
const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

// Supabase
const { data: user, error } = await supabase
  .from("users")
  .select("*")
  .eq("username", username)
  .maybeSingle();

if (error) throw error;
```

Insert and update examples:

```js
const { data, error } = await supabase
  .from("inventory_items")
  .update({ quantity: newQuantity })
  .eq("id", itemId)
  .select()
  .single();

if (error) throw error;
```

```js
const { data, error } = await supabase
  .from("alerts")
  .insert({
    alert_type: "low-stock",
    message: alertMessage,
    is_read: false,
  })
  .select()
  .single();

if (error) throw error;
```

## 9. Wrap multi-table writes transactionally

Supabase JavaScript calls should not be relied on to provide one transaction across multiple independent `.insert()` and `.update()` calls. Create PostgreSQL functions for operations that require atomicity and call them with `rpc()`.

Useful functions to add first:

1. `hold_pos_order(...)`
2. `complete_pos_checkout(...)`
3. `cancel_pos_order(...)`
4. `record_waste_reading(...)`
5. `approve_payroll(...)`
6. `create_stock_movement(...)`

Example RPC call from Express:

```js
const { data, error } = await supabase.rpc("record_waste_reading", {
  p_device_id: deviceId,
  p_weight: weight,
  p_recorded_at: receivedAt,
});

if (error) throw error;
```

At minimum, the initial conversion should use RPC functions for POS checkout, held-order checkout/cancellation, waste readings, voided transactions, and stock movements because those operations currently update multiple tables or inventory values.

## 10. Update route modules

Replace the SQLite import in these files:

```text
routes/auth.js
routes/admin.js
routes/pos.js
routes/kitchen.js
models/database.js
```

Remove:

```js
const db = require("../models/database");
```

Replace it with:

```js
const supabase = require("../models/supabase");
```

Then convert each synchronous route handler to `async` and wait for every Supabase query. Add consistent error handling such as:

```js
router.post("/example", async (req, res) => {
  const { data, error } = await supabase.from("settings").select("key, value");

  if (error) {
    console.error("Supabase settings error:", error);
    return res.status(500).json({ error: "Database operation failed." });
  }

  res.json(data);
});
```

Do not expose raw PostgreSQL or Supabase error objects to users.

## 11. Deployment checklist

- Remove `better-sqlite3` when no SQLite route remains:

```powershell
npm uninstall better-sqlite3
```

- Add Supabase environment variables to the production host.
- Set `NODE_ENV=production`.
- Replace the fallback session secret in `index.js`; it must never use a known default.
- Use HTTPS in production.
- Enable Supabase database backups/PITR where available and appropriate.
- Rotate the sample IoT API key and all demo credentials.
- Verify RLS is enabled on every public table.
- Verify that only the Express server process can access the service-role key.
- Test login, registration approval, password change, POS checkout, held orders, kitchen stock movements, attendance, payroll, alerts, settings, and waste readings.
- Compare Supabase migrated row counts with SQLite row counts before removing SQLite.

## 12. Verification queries

Run these in Supabase to confirm the migration:

```sql
select count(*) from public.users;
select count(*) from public.employees;
select count(*) from public.attendance;
select count(*) from public.menu_items;
select count(*) from public.inventory_items;
select count(*) from public.stock_movements;
select count(*) from public.transactions;
select count(*) from public.transaction_items;
select count(*) from public.pos_orders;
select count(*) from public.pos_order_items;
select count(*) from public.iot_devices;
select count(*) from public.waste_logs;
select count(*) from public.alerts;
select count(*) from public.settings;
select count(*) from public.audit_log;
select count(*) from public.payroll_records;
```

Find broken relationships:

```sql
select * from public.attendance a
left join public.employees e on e.id = a.employee_id
where e.id is null;

select * from public.transaction_items ti
left join public.transactions t on t.id = ti.transaction_id
where t.id is null;

select * from public.pos_order_items oi
left join public.pos_orders o on o.id = oi.order_id
where o.id is null;
```
