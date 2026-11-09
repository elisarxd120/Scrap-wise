# Scrap-Wise Kitchen Staff Dashboard Update

This document records the Kitchen Staff Dashboard implementation for the LAHOK Restaurant Scrap-Wise MIS.

## Current Development Status

### Stage 1 - Shared Navigation and Dashboard

Complete.

### Stage 2 - Stock Movement and Inventory

Complete.

### Stage 3 - Waste Loading

Complete.

### Stage 4 - Processing Status and Alerts

Complete.

### Stage 5 - User Guide

Complete.

## File Changes

### Server

#### `index.js`

Changes made:

1. Imported `./routes/kitchen`.
2. Mounted the Kitchen router with:
   ```js
   app.use("/kitchen", kitchenRoutes);
   ```
3. Removed the temporary inline `/kitchen/dashboard` route.
4. Kept the Kitchen router after authentication/session middleware.

#### `routes/kitchen.js`

New file containing all `/kitchen` pages and APIs.

It includes:

- Kitchen Staff and Admin access middleware.
- Shared Kitchen navigation and alert APIs.
- Dashboard API.
- Inventory read APIs.
- Stock-In and Stock-Out APIs.
- Same-day movement update API.
- Audit-log writes for stock actions.

Every route under this router is protected by login and role middleware. Login is required, and only `Kitchen Staff` and `Admin` users can access the Kitchen module.

### Database

#### `models/database.js`

Changes made:

- Added a `created_at` compatibility column to `stock_movements` when the column does not already exist.
- Added a sample approved Kitchen Staff account when it does not already exist.

Sample account:

- Username: `kitchen001`
- Password: `kitchen`
- Role: `Kitchen Staff`
- Status: `approved`

This account and sample restaurant data are for development only and should be removed or replaced before deployment.

The password is created with bcrypt. Passwords must not be stored as plain text.

## Stage 1 Files

### `public/kitchen/nav.html`

Contains the reusable Kitchen navigation:

- Scrap-Wise branding
- Logged-in staff name
- Dashboard
- Stock In / Out
- Inventory
- Waste Loading
- Processing Status
- Alerts and unread badge
- User Guide
- Logout
- Mobile menu
- Notification bell

### `public/kitchen/nav.js`

Provides reusable frontend behavior:

- Loads navigation content into each page.
- Highlights the active page.
- Loads the staff name and unread alert count.
- Handles the mobile menu.
- Shows the low-stock banner.
- Polls unread alerts every 10 seconds.

### `public/kitchen/kitchen.css`

Provides the shared green-and-white responsive Kitchen interface.

Includes:

- Tablet-friendly large controls
- Mobile hamburger menu
- Notification dropdown
- Low-stock banner
- Summary cards
- Alert badges
- Inventory and stock table styles
- Status colors
- Help and toast styles

### `public/kitchen/dashboard.html`

Kitchen Dashboard page.

### `public/kitchen/dashboard.js`

Loads `/kitchen/api/dashboard` and displays:

- Low-stock item count
- Today's waste weight
- Waste bin capacity
- Current processing status
- Low-stock items
- Latest alerts

## Stage 2 Files

### `public/kitchen/stock.html`

Stock-In and Stock-Out page.

Features:

- Large Stock-In and Stock-Out toggle buttons
- Searchable item input
- Quantity field with selected item's unit
- Movement date, defaulted to today
- Stock-Out reason choices
- Today's movements table
- Same-day Update button

### `public/kitchen/stock.js`

Provides Stock page frontend behavior, including:

- Loading inventory items
- Selecting inventory through the searchable input
- Switching Stock-In and Stock-Out mode
- Submitting create or update requests
- Displaying success and validation messages
- Loading the current staff member's movements from today
- Supporting Inventory page Stock-In shortcuts

### `public/kitchen/inventory.html`

Read-only Kitchen Inventory page.

### `public/kitchen/inventory.js`

Provides:

- Inventory search
- Category filtering
- Low-stock-only filtering
- Status badges
- Low-stock row highlighting
- Stock-In shortcuts

## Kitchen APIs Added

### Navigation and Dashboard

- `GET /kitchen/api/nav`
- `GET /kitchen/api/dashboard`
- `GET /kitchen/api/alerts/unread`

### Inventory

- `GET /kitchen/api/inventory`
- `GET /kitchen/api/inventory/items`

Supported inventory query parameters:

- `search`
- `category`
- `low_only=1`

### Stock Movements

- `GET /kitchen/api/stock/movements/today`
- `POST /kitchen/api/stock/movements`
- `PUT /kitchen/api/stock/movements/:id`

Create and update rules:

- Quantity must be greater than zero.
- Movement date must be today.
- Stock-Out cannot exceed the item's quantity on hand.
- Updates use the logged-in session user, not a user ID submitted by the browser.
- Staff can update only movements they recorded today.
- There is no delete API for Kitchen movements.

## Security and Audit Rules

### Kitchen Route Protection

All routes and APIs under `/kitchen` require:

- An active express-session login
- Either `Kitchen Staff` or `Admin` role

POS Staff and unauthenticated users are redirected to `/`.

### SQL Safety

Kitchen routes use parameterized SQLite queries.

### Frontend Output Safety

Database text displayed with JavaScript uses HTML escaping.

### Inventory Restrictions

The Kitchen module cannot:

- Create, edit, or delete inventory items
- Delete stock movements
- Edit payroll
- Edit attendance
- Edit POS transactions
- Open Admin pages

### Audit Logging

Kitchen Stock movement creation and updates write records to the existing `audit_log` table.

Audit entries contain the session user ID, action, record type, record ID, old value, and new value.

## How to Run

No npm package installation was required for the completed stages.

Start the server with:

```powershell
npm start
```

Or use the existing development command:

```powershell
npm run dev
```

After starting, open:

- `http://localhost:3000/kitchen/dashboard`
- `http://localhost:3000/kitchen/stock`
- `http://localhost:3000/kitchen/inventory`

Login using the development Kitchen account:

- Username: `kitchen001`
- Password: `kitchen`

## Update Log

### 2026-11-04 - Startup migration fix

- Fixed SQLite startup migration for the `stock_movements.created_at` compatibility column.
- SQLite does not allow `CURRENT_TIMESTAMP` as a default when adding a column with `ALTER TABLE`.
- The database now adds the column without a default and fills existing rows with a timestamp based on the movement date.

### 2026-11-04 - npm security cleanup

- Removed the outdated `nodemon` development dependency and its legacy dependency chain.
- Changed `npm run dev` to use Node.js built-in watch mode:
  ```text
  node --watch index.js
  ```
- Run `npm install` once after this update to refresh and prune `package-lock.json`.
- Then run `npm audit` to confirm the remaining dependency status.

### 2026-11-04 - Stage 1

- Added shared reusable Kitchen navigation.
- Added dashboard API and dashboard page.
- Added mobile navigation and notification polling.
- Added the low-stock warning banner.
- Added the sample Kitchen Staff account.

### 2026-11-04 - Stage 2

- Added Stock-In and Stock-Out page.
- Added movement creation and same-day update APIs.
- Added inventory quantity validation.
- Added read-only Inventory page.
- Added search, category filter, low-stock filter, status badges, and Stock-In shortcuts.
