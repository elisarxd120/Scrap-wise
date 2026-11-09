# Scrap-Wise POS Update

## Phase completed: POS Staff Point of Sale Landing Page

This phase implements a complete POS landing page for approved POS Staff accounts. It covers requirements P-01 through P-05 and connects the POS workflow to the existing SQLite menu and transaction records.

## Files added

- `c:\Users\Elisar\Documents\ScrapWise\public\pos\dashboard.html`
- `c:\Users\Elisar\Documents\ScrapWise\public\pos\pos.css`
- `c:\Users\Elisar\Documents\ScrapWise\public\pos\pos.js`
- `c:\Users\Elisar\Documents\ScrapWise\routes\pos.js`

## Files changed

- `c:\Users\Elisar\Documents\ScrapWise\index.js`
- `c:\Users\Elisar\Documents\ScrapWise\models\database.js`

No new npm package is required.

## Update: POS menu editing, table numbers, discounts, and receipt format

The POS landing page now includes the following refinements:

### Menu editing button

The menu toolbar contains an **Edit Menu** button for POS Staff. It opens a menu-item editor where POS Staff can change:

- Menu item name.
- Menu item price.
- Item availability.

The save operation updates the shared `menu_items` table. The POS menu and availability filters refresh immediately after saving.

Name and price validation is handled in the POS API. Duplicate names and negative prices are rejected.

### Table number

Dine-in orders now include a table-number input beside the order type controls.

- Dine-in requires a table number before hold or checkout.
- Take-out does not require a table number.
- Table numbers are stored with held `pos_orders` records.
- Dine-in receipts display the table as `Table <number>`.

### Discount

The payment modal includes a Discount % field.

- Discounts accept percentages from 0 to 100.
- The payment amount updates immediately as the discount changes.
- Cash validation uses the discounted amount due.
- Both direct and held-order receipts include subtotal, percentage, and discounted total.

### Receipt format

Completed POS receipts now use the requested bill layout:

```text
Name of the store
Naic Cavite
#090909090909

BILL

Order: Table Number / Take Out
Employee: Owner
POS: POS Cashier name
-------------------------------
Dine In / Take Out
-------------------------------
Product name                    total price
quantity x product price

-------------------------------
SR / transaction reference
-------------------------------
Subtotal                         total price
Discount%                        percentage
Total                            discounted total
Payment                          payment method
```

The store is shown as Scrap-Wise, the sample address and phone are shown as Naic Cavite and #090909090909, Employee is shown as Owner, and the POS field uses the signed-in POS Staff member's name.

## Requirements implemented

### P-01: Menu selection, quantities, and order type

POS Staff can:

- View menu items loaded from the database.
- Search menu items.
- Filter items as all, available, or unavailable.
- Add available menu items to the current order.
- Increase or decrease item quantities.
- Select either Dine-in or Take-out for the order.
- See the subtotal and total update immediately.

The current order is submitted with menu-item IDs and quantities. Prices and item names are taken from the database at checkout rather than trusted from the browser.

### P-02: Payment and receipts

POS Staff can:

- Record Cash, Card, GCash, or PayMaya payments.
- Enter cash received and see the calculated change.
- Prevent cash checkout when the amount received is below the order total.
- Complete the transaction and save it to the existing `transactions` table.
- Save each sold line item to the existing `transaction_items` table.
- Display a receipt after successful payment.
- Print the displayed receipt through the browser print function.

Completed transactions remain available to the existing Admin transaction-management module for viewing and audit-controlled corrections.

### P-03: Menu availability

The POS menu reads the `is_available` state from `menu_items`.

- Available items can be added to an order.
- Unavailable items are visually disabled and cannot be added.
- Availability is checked again on the server when an order is held or paid.

### P-04: Hold and cancel orders

POS Staff can hold an order before payment. Held orders are stored in `pos_orders` and `pos_order_items`, and are associated with the signed-in cashier.

POS Staff can:

- Hold the current order.
- View held orders in the Held Orders drawer.
- Load a held order back into the current order.
- Cancel a held order before payment.

Only held orders can be loaded, cancelled, or paid. Completed transactions cannot be corrected through the POS module. Post-payment corrections and voids continue to be restricted to Admin transaction controls.

### P-05: Own shift transaction summary

The Shift Summary drawer shows the signed-in POS Staff member's completed transactions for the current day.

The summary includes:

- Number of completed transactions for the shift.
- Total completed sales for the shift.
- Transaction code.
- Transaction date and time.
- Payment method.
- Transaction total.

Voided transactions are excluded from the completed sales summary.

## Database changes

The database compatibility logic adds an availability column when needed:

```sql
menu_items.is_available INTEGER NOT NULL DEFAULT 1
```

New tables created automatically at server startup:

- `pos_orders`
- `pos_order_items`

### `pos_orders`

The held-order record stores:

- Order code.
- Order date.
- Cashier user ID.
- Order type: `dine-in` or `take-out`.
- Total.
- Status: `held`, `paid`, or `cancelled`.
- Optional completed transaction ID.

### `pos_order_items`

Each held-order item stores:

- Parent POS order ID.
- Optional menu-item ID.
- Item name snapshot.
- Quantity.
- Unit price snapshot.
- Subtotal.

Foreign-key deletion cascades to line items when a held order record is deleted.

## POS server routes

All POS routes require an authenticated session with the `POS Staff` role.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/pos/dashboard` | POS landing page |
| `GET` | `/pos/api/menu` | Available and unavailable menu items |
| `GET` | `/pos/api/orders` | Own held orders |
| `POST` | `/pos/api/orders` | Hold a new order |
| `POST` | `/pos/api/orders/:id/cancel` | Cancel a held order |
| `POST` | `/pos/api/orders/:id/checkout` | Pay a held order |
| `POST` | `/pos/api/checkout` | Pay the current cart directly |
| `GET` | `/pos/api/summary` | Own current-day shift summary |

Unauthenticated POS requests redirect to `/`. Logged-in users outside the POS role receive HTTP 403.

## Login routing

`dashboardForRole` routes POS Staff to:

```text
/pos/dashboard
```

The POS router is mounted after the authentication router:

```js
app.use("/api", authRoutes);
app.use("/pos", posRoutes);
```

`/pos/dashboard` is role-protected by both the dashboard route middleware and the POS router.

## POS interface

The page uses a responsive two-column layout:

- Left: menu search, availability filters, and menu cards.
- Right: current order, order type, quantity controls, total, hold, and payment actions.

Mobile layouts stack the menu and current-order sections and make the payment, receipt, held-order, and summary interfaces drawer or modal based.

The interface includes:

- Clear visual unavailable-item states.
- Current-order quantity controls.
- Dine-in and Take-out selectors.
- Cash and change calculations.
- Held-order and shift-summary drawers.
- Payment modal.
- Receipt modal and print button.
- Error toast feedback.

## Validation behavior

Server-side validation includes:

- Order type must be `dine-in` or `take-out`.
- An order must contain at least one item.
- Quantities must be positive whole numbers.
- Menu items must exist and be available.
- Payment method must be Cash, Card, GCash, or PayMaya.
- Held orders must belong to the signed-in POS cashier.
- Cancelled and paid orders cannot be paid or cancelled again.
- Cash payments must meet or exceed the transaction total.

## Transaction behavior

Direct checkout creates a transaction in `transactions` and matching line items in `transaction_items`.

Held-order checkout:

1. Validates that the order still belongs to the cashier and is held.
2. Creates an `ORD-*` transaction.
3. Copies the held line items into `transaction_items`.
4. Marks the POS order as paid.
5. Associates the transaction ID with the POS order.

This preserves an audit-friendly separation:

- POS Staff creates sales and holds orders.
- Admin Staff views, corrects, or voids post-payment transactions.

## Verification performed

- The application server started successfully.
- The login page returned HTTP 200.
- No startup database or route errors appeared.
- POS route, menu, held-order, checkout, and shift-summary code was added.

## Start the application

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

Log in with an approved account that has the `POS Staff` role. POS Staff are automatically redirected to `/pos/dashboard`.
