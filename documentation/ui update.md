# Scrap-Wise UI Update

## Document purpose

This document defines a polished UI/UX direction for the existing Scrap-Wise administration system. It is based on the shared Admin implementation, the Dashboard and Employees screens, and the requirements for maintaining the current navigation and business functionality.

No business logic, routes, database behavior, or existing features are included in this document as UI implementation requirements. The application remains a restaurant and waste-management administration system.

The recommendation retains the sustainability-inspired identity while making the interface feel like a premium, modern SaaS administration product.

---

## A. Design Audit

### 1. Overall visual weaknesses

The current interface has a sound functional foundation, but the visual system is not yet fully developed:

- The green identity is broad and repetitive because one green is used for branding, primary actions, headings, focus states, and large-value text.
- The interface uses similarly sized cards and sections, which reduces visual hierarchy. Important KPIs do not clearly receive more emphasis than secondary content.
- Several containers rely on thin borders and medium shadows. Some cards appear interchangeable rather than forming a clear content hierarchy.
- Spacing is generally usable but can feel dense in tables and uneven in page headers.
- The Dashboard presents all six KPIs as equal cards, although sales, waste, and operational exceptions have different levels of importance.
- The charts have enough space but could better communicate comparison, period, trends, units, and empty or partial data.
- The Employees page is visually consistent with the Dashboard's shared styles, but it currently reads as a plain CRUD table rather than a complete people-management view.
- The sidebar is functional, but navigation items lack icons, which makes long navigation lists more difficult to scan.
- Most status information uses text pills. Some meaningful states, such as active, inactive, low stock, and voided, still compete visually.
- Refresh, search, notification, and filter controls do not yet appear as part of one strongly defined interaction pattern.
- Mobile behavior works through a drawer and stacked layouts, but small-screen tables still require horizontal scrolling and action controls could be easier to discover.
- The interface is missing a strongly established typography and type-scale system. Headings and labels currently rely mainly on browser and global default relationships.

### 2. Color and contrast audit

- The existing green, white, and orange combination communicates sustainability, but the strongest green lacks enough tonal variety.
- Light background areas can make containers look muted instead of intentionally structured.
- The orange is used in both warnings and secondary accents, but there is no consistently documented distinction between warning, error, informational, and success states.
- Danger buttons use a pale red background and should be more restrained in destructive contexts.
- Text contrast and semantic states must be validated at every breakpoint, not just against a white card.

Recommended changes:

- Reserve the primary green for brand identity, primary actions, navigation selection, and critical positive data.
- Use orange selectively for waste warnings, low stock, and items requiring attention.
- Add a restrained blue informational color rather than increasing the overall color palette unnecessarily.
- Introduce dedicated success, warning, error, and inactive tones with both text and icon or shape cues.
- Never communicate status by color alone; include clear labels.

### 3. Typography audit

Arial/Helvetica is readable but does not provide a distinct premium SaaS appearance.

Recommended:

- Adopt Inter or an approved system fallback. Inter is preferred.
- Use tabular numerals for KPI values and monetary amounts.
- Define a formal type scale instead of choosing sizes independently per page.
- Reduce repeated all-caps treatment in table headers. Table headers should remain uppercase only when it improves compactness; sentence case is preferred in dense operational tables.
- Give page headings and card titles clear weight differences rather than relying mainly on size.

### 4. Layout and spacing audit

- The 248 px sidebar is reasonable on desktop, but the navigation needs visual grouping and clearer icon alignment.
- The main content padding and card gaps are close in scale. A larger content gutter can improve separation.
- A single Dashboard card radius is used everywhere. The visual system can better differentiate page sections, data cards, controls, and modal surfaces.
- Employees rows are compact and readable, but identity, position, status, and actions are not clearly separated by hierarchy.
- Tables should use horizontal rules and subtle row separation rather than relying on dense text and borders.

### 5. Dashboard usability audit

- The sales chart and waste chart currently receive the same visual treatment even though they answer slightly different operational questions.
- KPI cards should distinguish business health, people operations, alerts, and exceptions.
- A refresh control should be located with the page header and clearly indicate the last updated time.
- The notification indicator should be in the same header control area as menu and profile information.
- Recent alerts should not create a second notification hierarchy when the same data is already available in the notification drawer.
- The Dashboard should prioritize five to six decision-making metrics, then charts, then operational tables.

### 6. Employees usability audit

- The Add Employee action should remain prominent but should not compete with page title navigation.
- Search needs a visible label, clear affordance, and a wider, stable focus area.
- The employee identity is currently two lines with employee ID under the name. This is appropriate and should be standardized.
- Edit and Delete buttons need consistent dimensions, spacing, and visual hierarchy.
- Status and date columns need stronger alignment.
- A delete confirmation should be descriptive and consistent rather than relying on the browser's native dialog.
- Employee rows should offer keyboard-visible focus, hover emphasis, and predictable action placement.

---

## B. Recommended Design System

## B1. Color palette

Primary identity:

| Role | Recommended HEX | Use |
|---|---:|---|
| Primary green | `#176B45` | Brand mark, active navigation, primary buttons, selected states |
| Deep green | `#124B32` | Page heading accents, sidebar branding, strong text, chart emphasis |
| Soft green | `#EAF3ED` | Active navigation, selected inputs, success surfaces, subtle emphasis |
| Mint tint | `#F4F8F5` | Optional data-section backgrounds and low-emphasis success areas |

Neutral palette:

| Role | Recommended HEX | Use |
|---|---:|---|
| Main background | `#F5F7F5` | Page canvas |
| Card/table surface | `#FFFFFF` | Cards, content containers, fields, dialogs |
| Border | `#DCE5DE` | Subtle field, card, and table boundaries |
| Divider | `#EDF2EE` | Internal separators, alternating section divisions |
| Primary text | `#1E2B24` | Titles and high-emphasis content |
| Secondary text | `#637268` | Supporting labels and descriptions |
| Disabled text | `#98A59C` | Disabled controls and placeholder-only metadata |

Semantic colors:

| State | Main HEX | Surface HEX | Use |
|---|---:|---:|---|
| Success/Active | `#176B45` | `#EAF3ED` | Active employee, completed transaction, successful operation |
| Warning/Attention | `#E58A23` | `#FFF4E5` | Low stock, waste warning, calibration attention |
| Error/Destructive | `#B42318` | `#FEE4E2` | Delete, voided status, validation errors |
| Information | `#3971A9` | `#EAF2FA` | Informational messages, neutral data status |
| Pending/Neutral | `#7A5C00` | `#FFF1C7` | Pending approval, draft, or waiting state |

Color principles:

- Do not introduce additional saturated colors to decorative surfaces.
- Use semantic colors only when the state has meaning.
- Waste and low-stock warning indicators may use orange without making the whole Dashboard orange.
- Primary green should cover no more than approximately 15–20% of the visible interface.
- Muted text should remain at least WCAG AA readable on white and light backgrounds.

## B2. Typography

Recommended font:

- Primary: `Inter`
- Fallback: `system-ui, -apple-system, "Segoe UI", Arial, sans-serif`
- Optional web fallback: no external font required if Inter is unavailable; system UI maintains consistency.

Type scale:

| Style | Size | Weight | Line height | Use |
|---|---:|---:|---:|---|
| Page title | 28 px | 700 | 34 px | Admin Dashboard, Employees, Waste Analytics, Reports |
| Section title | 18 px | 700 | 24 px | Card and panel headings |
| Card title/label | 14 px | 650 | 20 px | Chart names, table headings, field labels |
| KPI value | 30–32 px | 750 | 38 px | Important Dashboard totals and metrics |
| Body | 14 px | 400 | 21 px | Tables, lists, descriptions |
| Table header | 12 px | 700 | 16 px | Table metadata |
| Caption | 12 px | 500 | 16 px | Last updated, employee IDs, timestamps |
| Button | 14 px | 700 | 20 px | Button text |
| Navigation | 14 px | 650 | 20 px | Sidebar links |

Typography rules:

- Use tabular numerals for prices, quantities, KPI values, and employee rates.
- Page titles should not use all caps.
- Eyebrows may be small uppercase labels, but they should not carry an information hierarchy stronger than the title.
- Avoid bolding every table cell; emphasize names and totals only.
- Keep tables at 13–14 px to support dense operational data without becoming visually compressed.
- Use sentence case for status labels such as Active, Inactive, Completed, Voided, and Pending.

## B3. Spacing, sizing, and layout

Use an 4 px base spacing scale:

- `4 px`, `8 px`, `12 px`, `16 px`, `20 px`, `24 px`, `32 px`, `40 px`

Recommended page-level values:

- Sidebar width: 248–256 px on desktop
- Main content padding: 24–32 px horizontally and 24–28 px vertically
- Maximum readable content width: 1440 px for wide screens
- Card gap: 16–20 px
- Page header to content gap: 20–24 px
- Toolbar to table gap: 12–16 px

Corner radii:

- Page containers/cards: 12 px
- Input fields and buttons: 8 px
- Status badges: 999 px
- Modal surfaces: 16 px
- Avatar/initial circles: 50%
- Icon buttons: 8–10 px

Shadows:

- Cards: `0 1px 2px rgba(18, 75, 50, 0.04), 0 6px 18px rgba(18, 75, 50, 0.05)`
- Dropdown and notification menus: `0 12px 32px rgba(18, 75, 50, 0.14)`
- Modal: `0 24px 64px rgba(18, 75, 50, 0.20)`
- Toast: `0 10px 24px rgba(18, 75, 50, 0.16)`

Use shadows for elevation, not decoration. Most page cards should have only a border plus a very subtle shadow.

## B4. Button styles

| Button | Appearance | Recommended behavior |
|---|---|---|
| Primary | Green background, white text | Add Employee, Save, Generate, Apply |
| Secondary | White background, green-gray text, border | Refresh, Cancel, View, Export |
| Tertiary/text | Transparent or white, green text | View inventory, navigation to full list |
| Danger | Pale red or solid red only in confirmation dialogs | Delete, Void |
| Icon action | Neutral border/background, accessible label | Edit icon, Delete icon, More menu |

Button rules:

- Standard height: 40–44 px.
- Minimum horizontal padding: 16 px.
- Use an icon only when it improves recognition and pair it with text in primary management actions.
- Keep Edit and Delete labels readable on desktop; use restrained icon-only buttons only where the table width is constrained.
- Delete should be less prominent than Edit until confirmation is needed.
- All controls need visible hover, focus, active, disabled, and keyboard focus states.
- Destructive confirmations should describe the consequence and require an explicit button.

## B5. Inputs and focus states

- Height: 44 px.
- Border: 1 px neutral border.
- Corner radius: 8 px.
- Background: white.
- Placeholder text: muted but distinguishable from entered text.
- Focus ring: 3 px soft-green outer ring plus 1 px primary-green border.
- Validation error: red border, red message below the field, and no color-only error indicator.
- Search input should include a search icon and clear button when text is present.

## B6. Tables

- Use a soft-gray table header with 12 px medium text.
- Remove unnecessary vertical borders.
- Use one subtle horizontal divider per row.
- Add a very light row hover state.
- Maintain 12–16 px horizontal cell padding and 12 px vertical padding.
- Align numeric columns right and text or identity columns left.
- Align status, date, and action columns consistently.
- Keep action columns right-aligned and sticky on mobile/tablet only when necessary.
- Show empty states in a centered, padded row with a concise explanation.
- On small screens, transform dense tables into cards or prioritized columns instead of presenting an endless scroll.

---

## C. Layout Recommendations

## C1. Shared Admin shell

The shared shell should follow this structure on every page:

1. Fixed left sidebar, desktop.
2. Off-canvas sidebar with overlay, mobile.
3. Top content header area containing page context and global controls.
4. Notification bell and unread badge on the right.
5. Main content in a 24–32 px content gutter.

## C2. Sidebar redesign

Recommended visual structure:

- White or very light neutral sidebar with a subtle right divider.
- Scrap-Wise brand mark at the top using the existing recycle icon.
- Display “Scrap-Wise” and a short role label such as “Admin Workspace.”
- Add a small user/organization block showing the signed-in administrator and optional avatar initials.
- Navigation icons should be 18 px, aligned in a 40 px icon column, and paired with text.
- Active items should use the soft-green background, a 3 px green left indicator, and medium-bold text.
- Inactive items should use primary text rather than pale gray.
- Add small section labels only when groups are introduced:
  - `Operations`
  - `Management`
  - `Configuration`
- Keep all existing navigation entries:
  - Dashboard
  - Employees
  - Attendance
  - Payroll
  - Inventory
  - Transactions
  - Waste Analytics
  - Users
  - Settings
  - Reports
  - Logout
- Keep Logout at the bottom, separated by a divider.
- The Logout control should look secondary rather than like a permanent primary action.
- Do not use red for Logout unless a destructive confirmation is required.

Mobile sidebar:

- Use 280 px width.
- Preserve icons and labels.
- Make the close button accessible and visible.
- Apply the body menu-open state and overlay behavior already present.
- Trap keyboard focus while open and restore focus to the menu button after close.

## C3. Dashboard structure

Recommended top-to-bottom structure:

1. Page header:
   - Eyebrow: `Operations overview`
   - Title: `Admin Dashboard`
   - Supporting line: `Wednesday, November 2 | Last updated just now`
   - Actions: Refresh and date range selector when expanded
2. KPI grid:
   - Six cards, using three columns on desktop.
   - Use a stronger visual weight only for Today's Sales and Waste Today.
   - Use status or small comparison text inside each card rather than adding colored borders everywhere.
   - Keep Exceptions cards in a light warning surface:
     - Low-Stock Items
     - Pending Approvals
   - Include a small trend label or unit where data can support it.
3. Charts:
   - Sales chart and Waste chart remain side by side on large screens.
   - Sales can use a green line/area visualization.
   - Waste can use a restrained orange bar visualization.
   - Each chart card should include period, title, total, and accessible legend.
   - Use tooltips with exact currency or weight values.
4. Operational tables:
   - Low Stock on the left.
   - Recent Transactions on the right.
   - For low stock, show item identity, available quantity, reorder level, and status.
   - For recent transactions, show code, cashier, total, status, and date.
5. Recent alerts:
   - Keep recent alerts below the operational tables, but present only five relevant items.
   - Avoid duplicate unread badges between the notification drawer and the page card.

Dashboard wireframe:

```text
+------------------------------------------------------------------+
| Sidebar | Operations overview                                     |
|         | Admin Dashboard                     [Refresh] [Bell 3] |
| Links   | Last updated 09:45                              |
|---------+--------------------------------------------------------|
|         | [Today's Sales] [Transactions] [Employees Present]  |
|         | [Low Stock 4]   [Waste Today]  [Pending Approvals]  |
|         +---------------------+------------------------------+
|         | Sales - Last 7 Days | Waste - Last 7 Days         |
|         | line chart           | orange bar chart             |
|         +---------------------+------------------------------+
|         | Low Stock            | Recent Transactions          |
|         | item table           | transaction table            |
|         +--------------------------------------------------------+
|         | Recent Alerts                                          |
+------------------------------------------------------------------+
```

## C4. Employees structure

Recommended top-to-bottom structure:

1. Page header:
   - Eyebrow: `Human Resources`
   - Title: `Employees`
   - Supporting text: total employee count and active employee count.
   - Right-side Add Employee primary button.
2. Employee management card:
   - Search row on its own line.
   - Optional status filter: All, Active, Inactive.
   - Optional position filter if the data becomes large.
   - Table with seven existing columns retained.
3. Table:
   - Employee identity includes name, employee ID, and optional initials avatar.
   - Position is a text column.
   - Rate shows formatted currency and rate period.
   - Contact is readable and accessible.
   - Status uses a semantic badge.
   - Date Hired is date-formatted.
   - Actions are right aligned.

Employees wireframe:

```text
+------------------------------------------------------------------+
| Sidebar | Human Resources                                         |
|         | Employees                          [+ Add Employee]      |
| Links   | 8 employees | 6 active                                  |
|---------+--------------------------------------------------------|
|         | [Search name, ID, or position]  [All v]                  |
|         +--------------------------------------------------------+
|         | Employee | Position | Rate | Contact | Status | Hired | |
|         | Avatar   |          |      |         | Badge   | Date  | Edit/Delete |
|         | Avatar   |          |      |         | Badge   | Date  | Edit/Delete |
|         +--------------------------------------------------------+
+------------------------------------------------------------------+
```

## C5. Responsive behavior

Desktop:

- Sidebar visible above 980 px.
- Three-column Dashboard KPI grid above 980 px.
- Chart grid uses two equal columns.
- Employee table uses full width with horizontal space allocation by content priority.

Tablet:

- Sidebar may use the existing mobile drawer at widths below 760 px.
- Dashboard KPI grid moves to two columns.
- Charts move to one column when the content width is less than approximately 900 px.
- Employee table can retain full width horizontally if only supporting columns are hidden; better implementation is a card view for 760 px and below.

Mobile:

- Sidebar becomes an overlay drawer.
- Page header stacks title and action.
- Add Employee becomes full-width in a stacked header or placed near the search controls.
- KPI cards become one column or a compact two-column layout when text remains readable.
- Charts use 220–240 px heights.
- Employees move from table columns to compact employee cards:
  - Avatar and identity
  - Position and status
  - Rate and date hired
  - Actions
- Date and transaction information should remain visible but never require a horizontal scroll.

Accessibility:

- Add semantic `<header>`, `<main>`, `<nav>`, `<section>`, and `<table>` landmarks where appropriate.
- Buttons and links must be keyboard accessible.
- Use visible 3 px focus rings.
- Add accessible names to icon-only controls and chart canvases.
- Provide chart text summaries or tables for equivalent access.
- Ensure modal dialogs trap focus and close with Escape.
- Do not trigger actions on hover alone.
- Use labels and status text rather than color as the only message.
- Confirmation dialogs should receive initial focus on the safe action when appropriate.

---

## D. Before-and-After Improvements

### D1. Dashboard header

Before:

- Page title and eyebrow are concise but the header lacks meaningful context, date, and update status.
- The notification and refresh controls are separate and less integrated.

After:

- Use a two-line title and page context.
- Add a date/last-updated caption.
- Place Refresh and notification controls together at the right.
- Keep “Admin Dashboard” visually prominent but not oversized.

### D2. Dashboard KPI cards

Before:

- KPI cards use equal weight, and a few warning cards receive orange/pale backgrounds.
- Values are green everywhere.

After:

- Preserve six existing cards, but establish three levels:
  - Primary business KPIs
  - Operational quantities
  - Warning/approval exceptions
- Use supporting labels, units, and compact status text.
- Reserve orange and attention surfaces for low stock, waste warnings, and pending approval.
- Use consistent green text only for normal health and positive totals.

### D3. Sales and Waste charts

Before:

- Charts are presented in equal card sizes and fixed heights.
- Titles are functional but do not show the current total or interpretation.

After:

- Sales chart should show a clear period total above the chart, with currency formatting and tooltips.
- Waste chart should show period total above the chart, with kilograms in the unit label.
- Keep chart palettes aligned to the overall system.
- Improve grid lines and axis labels.
- Hide decorative legends where only one series exists.
- Avoid using gradients on the charts.
- Show a clear empty-data state instead of a blank canvas.

### D4. Low Stock and Recent Transactions

Before:

- Both sections look like equal lightweight tables with links in the heading.
- Status and quantity comparisons may require reading every cell individually.

After:

- Create clearer hierarchy for item identity and quantity.
- Use low-stock and out-of-stock visual states with text and color.
- Add right-aligned totals in transaction tables.
- Show status in consistent semantic badges.
- Use “View inventory” and “View all” as low-emphasis links or right-side actions.

### D5. Employees header and primary action

Before:

- The Add Employee button shares the header with no supporting employee count context.

After:

- Add total and active employee context under the title.
- Keep Add Employee right-aligned, but ensure it stacks correctly on mobile.
- Use an employee icon or plus icon only if it improves recognition.

### D6. Search and filters

Before:

- Search is an unadorned field under an “Employees” section.

After:

- Give search a visible label and stable width.
- Add a search icon and clear control.
- Place status and other filters in the same toolbar row.
- Keep the search field wide enough for the placeholder and actual employee names.

### D7. Employee table

Before:

- Seven text-heavy columns are distributed without identity visuals.
- Edit and Delete are two visible buttons that receive equal visual prominence.
- Status is represented as Completed or Voided-style classes from the existing status pattern.

After:

- Add an initial/avatar treatment only if no employee photo is available.
- Keep employee name and ID together in one identity cell.
- Add aligned status badges for Active and Inactive.
- Use Edit as a neutral outlined button and Delete as a restrained red icon or text button.
- Add hover and keyboard focus to each row.
- Use right-aligned action cells.
- Replace the browser confirmation with a styled, accessible delete dialog.

### D8. Modals and forms

Before:

- Add/Edit modals use a 680 px two-column form and compact footer actions.

After:

- Preserve the existing two-column form on desktop and one column on mobile.
- Divide the form into sections only if fields become more complex.
- Keep labels above fields.
- Place Cancel before Save, with the primary action right-aligned.
- Show validation inline.
- Make close and Escape behavior keyboard accessible.

---

## E. Final Redesigned Interface

The final implementation should look and behave as a custom administrative SaaS interface, not a generic template.

### E1. High-fidelity Dashboard specification

```text
LEFT SIDEBAR
  Brand: recycle mark + Scrap-Wise
  Section: Operations
    Dashboard
    Employees
    Attendance
    Payroll
    Inventory
    Transactions
    Waste Analytics
  Section: Management
    Users
    Settings
    Reports
  Bottom: administrator identity + Logout

MAIN HEADER
  Operations / Admin Dashboard
  October 28 - November 2
  Last updated 09:45
  [Refresh] [Notification bell with unread badge]

TOP METRICS
  Today's Sales                 Transactions Today
  PHP 24,800                   18
  + supporting trend if available

  Low-Stock Items               Employees Present
  4                            12
  warning state / normal state

  Waste Today                   Pending Approvals
  36.4 kg                       3
  warning state / attention state

DATA SECTION
  [Sales - Last 7 Days]
  Period total and green line chart

  [Waste - Last 7 Days]
  Period total and orange bar chart

TABLE SECTION
  Low Stock | View inventory
  Item identity / Quantity / Reorder / Status

  Recent Transactions | View all
  Code / Cashier / Total / Status / Date

SECONDARY
  Recent Alerts
  Alert identity, readable message, and timestamp
```

### E2. High-fidelity Employees specification

```text
LEFT SIDEBAR
  The same sidebar, grouped and active on Employees

HEADER
  Human Resources / Employees
  8 employees - 6 active
  [+ Add Employee]

TOOLBAR
  [Search icon] Search name, ID, or position
  [All statuses v]

EMPLOYEE TABLE
  Employee
    Initial avatar
    Full name
    Employee ID

  Position
  Rate
  Contact
  Status
    Active / Inactive semantic badge
  Date Hired
  Actions
    Edit
    Delete

ROW STATES
  Default: white
  Hover: #F7FAF8
  Active status: soft green badge
  Inactive status: neutral gray badge
  Action column: Edit restrained, Delete subdued red
```

### E3. Recommended implementation sequence

1. Establish CSS variables for the refined palette, typography, radii, shadows, spacing, and states.
2. Update the shared navigation markup and add icon-based navigation.
3. Normalize button, input, badge, card, modal, toast, and table styles in `admin.css`.
4. Refine Dashboard card hierarchy and chart presentation.
5. Refine the Employees page toolbar, table, and action controls.
6. Verify responsive behavior at desktop, tablet, and mobile widths.
7. Audit keyboard access, focus indicators, contrast, status labels, and screen-reader names.
8. Review all admin pages against the shared design system so the change remains consistent beyond Dashboard and Employees.

## F. Acceptance Criteria

The redesigned interface should:

- Preserve every existing navigation route and feature.
- Preserve all current form fields, CRUD actions, reports, charts, and notification behavior.
- Use the refined green as the primary brand/action color.
- Use orange only for meaningful warnings or attention states.
- Make the Dashboard feel data-first and action-oriented.
- Make Employees feel readable, searchable, and manageable.
- Use the same sidebar, page header, card, table, badge, button, and input language across all Admin pages.
- Remain usable at desktop, tablet, and mobile widths.
- Meet WCAG AA contrast and keyboard accessibility expectations.
- Avoid decorative gradients, excessive animation, and unnecessary shadows.
- Require no business logic or database changes for visual implementation.

## G. Implementation Status

The shared recommendation has been implemented at the foundation and priority-screen levels:

- `public/admin/admin.css` now defines the refined green palette, Inter typography stack, shared card/table/button/input styles, sidebar styling, notification styling, and responsive rules.
- `public/admin/nav.html` now includes grouped navigation sections and navigation icons while preserving all existing routes.
- `public/admin/nav.js` now updates notification accessibility state and supports Escape-key dismissal.
- `public/admin/dashboard.html` now includes a page-context line and refreshed header action presentation.
- `public/admin/dashboard.js` now uses refined KPI hierarchy and chart colors, adds supporting metric notes, and displays the dashboard update time.
- `public/admin/employees.html` now includes employee totals, status filtering, a refined search toolbar, a refreshed table class, and a styled delete confirmation modal.
- `public/admin/employees.js` now renders employee initials, status-filtered rows, formatted dates, compact actions, and a custom delete confirmation flow.

Existing navigation options, routes, CRUD operations, report behavior, database access, and business logic remain unchanged.
