# Sub-project 2: Budget Grid — Design Spec

## Overview

The budget grid is the core view of OpenBudget — a YNAB-style monthly category grid where users assign money to categories, track spending activity, and see available balances. This sub-project adds category management, monthly budget assignments, computed aggregates, and the primary budget interaction surface.

## Scope

### In Scope
- Category groups and categories (CRUD, drag-to-reorder via dnd-kit)
- Monthly budget grid with columns: Category, Assigned, Activity, Available
- "Ready to Assign" computation and display
- Assign money to categories via popover editor
- Move money between categories via dialog
- Month navigation (previous/next)
- Category group collapsing (chevron toggle)
- Grid + Side Inspector layout
- Overspending indicators (red for negative Available)
- Inline add/rename for categories and groups, confirmation dialog for delete

### Out of Scope (Deferred)
- Yellow vs. red overspending distinction (Sub-project 5 — requires credit card logic)
- Target progress indicators (Sub-project 4)
- Auto-assign features (Sub-project 4)
- Account sidebar with balances (Sub-project 3)
- Transaction entry (Sub-project 3)

## Architecture

### Data Fetching: Single Grid Query

One API endpoint returns the full grid state for a given budget and month. The server computes all aggregates (Activity, Available, Ready to Assign) from the underlying transaction and monthly budget data. The client renders the response directly.

Mutations (assign, move money, reorder, CRUD) each hit fine-grained endpoints, then invalidate the grid query to trigger a refetch. For household-scale data (typically <50 categories), this round-trip is imperceptible.

### No New Tables

All required tables already exist in the schema from Sub-project 1: `categoryGroup`, `category`, `monthlyBudget`. The grid service computes aggregates from `transaction` and `monthlyBudget` tables.

## Data Model Reference

### Existing Tables Used

**categoryGroup**: `id`, `budgetId` (FK), `name`, `sortOrder`, `isHidden`, `createdAt`, `updatedAt`

**category**: `id`, `groupId` (FK → categoryGroup), `name`, `sortOrder`, `isHidden`, `createdAt`, `updatedAt`

**monthlyBudget**: `id`, `categoryId` (FK), `month` (YYYY-MM string), `assigned` (integer, minor units), `createdAt`, `updatedAt`. Unique index on `(categoryId, month)`.

**financialAccount**: `id`, `budgetId` (FK), `name`, `type`, `onBudget` (boolean), `closed`, `sortOrder`, `createdAt`, `updatedAt`. Note: the Drizzle export is `financialAccount` (not `account`) to avoid collision with the auth `account` table.

**transaction**: `id`, `accountId` (FK → financialAccount), `date` (YYYY-MM-DD), `amount` (integer, minor units), `categoryId` (FK → category, nullable), `transferTransactionId` (FK → transaction, nullable), plus other fields. Used for computing Activity.

**transactionSplit**: `id`, `transactionId` (FK → transaction), `categoryId` (FK → category, nullable), `amount` (integer, minor units), `memo`. When a transaction is split across categories, the parent transaction's `categoryId` is null and the splits carry the per-category amounts.

### Computed Values

All computed values only include transactions from **on-budget accounts** (`financialAccount.onBudget = true`). Off-budget/tracking account transactions are excluded from budget calculations.

- **Assigned**: Direct lookup from `monthlyBudget` for the given category and month.
- **Activity**: Sum of categorized transaction amounts for the given category and month. For unsplit transactions, use `transaction.amount` where `transaction.categoryId = category.id`. For split transactions (where `transactionSplit` rows exist), use `transactionSplit.amount` where `transactionSplit.categoryId = category.id`. Only includes transactions from on-budget accounts. Computed on read.
- **Available**: For a given category in a given month: sum of all `assigned` values for this category in all months up to and including the current month, plus sum of all activity for this category in all months up to and including the current month. Effectively: cumulative assigned + cumulative activity.
- **Ready to Assign**: Total inflows minus total assigned. Inflows are transactions where `categoryId` is null, `transferTransactionId` is null (excluding transfers between accounts), and the transaction belongs to an on-budget account. Total assigned is the sum of all `monthlyBudget.assigned` across all categories for all months up to and including the current month.

## Service Layer

### CategoryService

Class with constructor-injected `db`, following the BudgetService pattern.

**Methods:**
| Method | Description |
|--------|-------------|
| `listGroupsWithCategories(budgetId)` | Returns all groups with nested categories, ordered by `sortOrder` |
| `createGroup(budgetId, { name })` | Creates group with next `sortOrder` |
| `createCategory(groupId, { name })` | Creates category with next `sortOrder` within group |
| `renameGroup(groupId, name)` | Updates group name |
| `renameCategory(categoryId, name)` | Updates category name |
| `deleteGroup(groupId)` | Deletes group (cascade: categories, monthly budgets; transactions and transaction splits lose categoryId via `SET NULL`) |
| `deleteCategory(categoryId)` | Deletes category (cascade: monthly budgets; transactions and transaction splits lose categoryId via `SET NULL`) |
| `reorderGroups(budgetId, orderedGroupIds[])` | Bulk update `sortOrder` for all groups |
| `reorderCategories(groupId, orderedCategoryIds[])` | Bulk update `sortOrder` within a group |
| `moveCategory(categoryId, targetGroupId, sortOrder)` | Move category to a different group at a specific position |
| `toggleGroupHidden(groupId)` | Toggle `isHidden` flag |
| `toggleCategoryHidden(categoryId)` | Toggle `isHidden` flag |

**Hidden items behavior:** Hidden groups and categories are included in the grid response (with `isHidden: true`) but are visually collapsed/dimmed in the UI. They can be toggled back to visible via the inspector panel or a context action. This ensures users can always find and un-hide categories.

### BudgetGridService

Handles the aggregated grid query and money operations.

**Methods:**
| Method | Description |
|--------|-------------|
| `getGridData(budgetId, month)` | Returns full grid state (see Grid Data Shape below) |
| `assignMoney(categoryId, month, amount)` | Upsert `monthlyBudget` row for the given category and month |
| `moveMoney(fromCategoryId, toCategoryId, month, amount)` | Upserts both categories' `monthlyBudget` rows in a transaction (subtracts from source, adds to target). `amount` must be a positive integer — direction is determined by from/to params. Allows moving more than available — source category can go negative, matching YNAB behavior. |

### Grid Data Shape

```typescript
interface GridData {
  readyToAssign: number; // minor units, can be negative
  currency: string; // ISO 4217 code from budget
  month: string; // YYYY-MM
  groups: GridGroup[];
}

interface GridGroup {
  id: string;
  name: string;
  sortOrder: number;
  isHidden: boolean;
  assigned: number; // sum of categories' assigned
  activity: number; // sum of categories' activity
  available: number; // sum of categories' available
  categories: GridCategory[];
}

interface GridCategory {
  id: string;
  name: string;
  sortOrder: number;
  isHidden: boolean;
  assigned: number; // from monthlyBudget for this month
  activity: number; // computed from transactions this month
  available: number; // cumulative assigned + cumulative activity
}
```

## API Routes

All routes scoped under `/api/budgets/:budgetId/` and protected by `requireBudgetAccess()`.

### Grid Data
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/budgets/:budgetId/grid?month=YYYY-MM` | viewer | Full grid state for a month |

### Category Group CRUD
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/budgets/:budgetId/categories/groups` | editor | Create group |
| PATCH | `/api/budgets/:budgetId/categories/groups/:groupId` | editor | Rename group |
| DELETE | `/api/budgets/:budgetId/categories/groups/:groupId` | editor | Delete group |

### Category CRUD
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/budgets/:budgetId/categories` | editor | Create category (body includes `groupId`) |
| PATCH | `/api/budgets/:budgetId/categories/:categoryId` | editor | Rename category |
| DELETE | `/api/budgets/:budgetId/categories/:categoryId` | editor | Delete category |

### Reordering
| Method | Path | Role | Description |
|--------|------|------|-------------|
| PUT | `/api/budgets/:budgetId/categories/groups/reorder` | editor | Reorder groups (body: `{ orderedIds[] }`) |
| PUT | `/api/budgets/:budgetId/categories/reorder` | editor | Reorder within group (body: `{ groupId, orderedIds[] }`) |
| PUT | `/api/budgets/:budgetId/categories/:categoryId/move` | editor | Move category to group (body: `{ targetGroupId, sortOrder }`) |

### Money Operations
| Method | Path | Role | Description |
|--------|------|------|-------------|
| PUT | `/api/budgets/:budgetId/grid/assign` | editor | Assign money (body: `{ categoryId, month, amount }`) |
| POST | `/api/budgets/:budgetId/grid/move-money` | editor | Move money (body: `{ fromCategoryId, toCategoryId, month, amount }`) |

## React Query Hooks

### `src/lib/hooks/use-budget-grid.ts`

| Hook | Type | Query Key | Description |
|------|------|-----------|-------------|
| `useBudgetGrid(budgetId, month)` | query | `["budget-grid", budgetId, month]` | Fetches full grid state |
| `useAssignMoney(budgetId)` | mutation | invalidates `["budget-grid", budgetId]` | Assign money to category |
| `useMoveMoney(budgetId)` | mutation | invalidates `["budget-grid", budgetId]` | Move money between categories |

### `src/lib/hooks/use-categories.ts`

| Hook | Type | Invalidates | Description |
|------|------|-------------|-------------|
| `useCreateCategoryGroup(budgetId)` | mutation | `["budget-grid", budgetId]` | Create category group |
| `useRenameCategoryGroup(budgetId)` | mutation | `["budget-grid", budgetId]` | Rename group |
| `useDeleteCategoryGroup(budgetId)` | mutation | `["budget-grid", budgetId]` | Delete group |
| `useCreateCategory(budgetId)` | mutation | `["budget-grid", budgetId]` | Create category |
| `useRenameCategory(budgetId)` | mutation | `["budget-grid", budgetId]` | Rename category |
| `useDeleteCategory(budgetId)` | mutation | `["budget-grid", budgetId]` | Delete category |
| `useReorderGroups(budgetId)` | mutation | `["budget-grid", budgetId]` | Reorder groups |
| `useReorderCategories(budgetId)` | mutation | `["budget-grid", budgetId]` | Reorder categories in group |
| `useMoveCategory(budgetId)` | mutation | `["budget-grid", budgetId]` | Move category to different group |

All mutations invalidate the grid query broadly by `budgetId` prefix since most operations affect computed totals.

## UI Components

### Layout: Grid + Side Inspector

The budget view uses a two-panel layout:
- **Left**: The budget grid (category groups, categories, amount columns)
- **Right**: Inspector panel that appears when a category is selected, showing detailed amounts and actions

### Component Tree

```
BudgetViewPage (route component — owns month + selectedCategoryId state)
├── MonthNavigator (← Mar 2026 → controls)
├── ReadyToAssign (banner — green positive, red negative with "Cover overspending" action)
├── BudgetGrid (main grid — DnD context provider)
│   ├── GridHeader (column headers: Category / Assigned / Activity / Available)
│   ├── CategoryGroupRow (draggable group header, chevron collapse toggle, aggregate totals)
│   │   ├── CategoryRow (draggable row — click to select, double-click name to rename)
│   │   ├── CategoryRow
│   │   └── AddCategoryButton (inline "+" at bottom of group)
│   ├── CategoryGroupRow
│   │   ├── CategoryRow
│   │   └── AddCategoryButton
│   └── AddGroupButton ("Add Group" at bottom of grid)
└── CategoryInspector (side panel — shown when category selected)
    ├── AssignPopover (amount input + quick action buttons)
    └── MoveMoneyDialog (from/to category + amount)
```

### File Organization

```
src/components/budget/
├── budget-grid.tsx          — BudgetGrid + DnD context
├── grid-header.tsx          — Column headers
├── category-group-row.tsx   — Group row with chevron collapse
├── category-row.tsx         — Category row with amounts
├── category-inspector.tsx   — Side detail panel
├── month-navigator.tsx      — Month picker
├── ready-to-assign.tsx      — RTA banner
├── assign-popover.tsx       — Amount input popover
└── move-money-dialog.tsx    — Move money modal
```

### Component Responsibilities

**BudgetViewPage**: Route component. Owns `month` (string state, default: current YYYY-MM) and `selectedCategoryId` (string | null). Calls `useBudgetGrid(budgetId, month)`. Passes grid data to children. Handles loading/error states.

**MonthNavigator**: Previous/next buttons that update the parent's `month` state. Displays formatted month name (e.g., "March 2026").

**ReadyToAssign**: Displays the Ready to Assign amount. Green when positive, red when negative. When negative, shows a message ("You've assigned $X more than you have available") and a "Cover Overspending" button that opens the MoveMoneyDialog pre-filtered to categories with available funds.

**BudgetGrid**: Wraps children in dnd-kit's `DndContext` and `SortableContext`. Renders groups and categories. Handles `onDragEnd` events to call reorder/move mutations. Manages collapsed group state locally (not persisted — all groups start expanded).

**CategoryGroupRow**: Displays group name, aggregate Assigned/Activity/Available. Chevron icon on left toggles collapse. Drag handle for reorder. Shows "Add Category" inline input when the "+" is clicked.

**CategoryRow**: Displays category name and three amount columns. Click selects the row (updates parent's `selectedCategoryId`). Double-click on name enters inline rename mode. Drag handle on left for reorder. Available column is color-coded: green (positive), neutral (zero), red (negative).

**CategoryInspector**: Side panel shown when `selectedCategoryId` is non-null. Displays selected category's Assigned, Activity, and Available in larger format. Buttons for: "Assign" (opens AssignPopover), "Move Money" (opens MoveMoneyDialog), "Delete Category" (opens confirmation dialog). Placeholder section for target progress (Sub-project 4).

**AssignPopover**: Popover with an amount input field. User types an amount, presses Enter or clicks "Save" to assign. Quick action buttons below the input (placeholder for Sub-project 4: "Assign Underfunded", "Assign Last Month", etc.). Calls `useAssignMoney` mutation.

**MoveMoneyDialog**: Modal dialog with: source category dropdown, target category dropdown, amount input. When opened from the "Cover Overspending" button on the ReadyToAssign banner, the target is pre-set to the overspent category (or left blank if multiple are overspent) and the source dropdown is filtered to categories with positive Available. Calls `useMoveMoney` mutation.

### Interaction Details

**Inline Add Category**: Clicking the "+" button at the bottom of a group shows an inline text input. Type a name, press Enter to create. Press Escape to cancel. Focus auto-moves to the input.

**Inline Rename**: Double-clicking a category or group name replaces the text with an input field pre-filled with the current name. Press Enter to save, Escape to cancel. Blur saves.

**Delete Confirmation**: Clicking "Delete" in the inspector opens a confirmation dialog explaining that deleting a category will uncategorize any associated transactions (including split transactions). Confirm or cancel.

**Drag-and-Drop (dnd-kit)**:
- Categories can be reordered within their group
- Categories can be dragged to a different group (calls `moveCategory`)
- Groups can be reordered relative to each other
- Visual feedback: drag overlay shows the row being dragged, drop indicator shows insertion point

### Additional shadcn/ui Components Needed

The following components should be installed via the shadcn CLI for this sub-project:
- `popover` — for AssignPopover
- `select` — for category dropdowns in MoveMoneyDialog
- `collapsible` — for category group collapse
- `table` — potentially for grid structure (evaluate vs. custom CSS grid)
- `badge` — for overspending indicators
- `alert` — for the Ready to Assign warning state

## Overspending Indicators

For Sub-project 2, all negative Available values display in **red** (generic overspent state). The distinction between yellow (cash overspending) and red (credit card overspending) requires credit card account logic from Sub-project 5.

Color mapping for the Available column:
- Positive → green (`text-green-600` / `text-green-400` dark)
- Zero → neutral (default text color)
- Negative → red (`text-red-600` / `text-red-400` dark)

## Testing Strategy

Service-level unit tests using Vitest with in-memory SQLite via `createTestDb()`. No component tests (consistent with Sub-project 1 patterns).

### `category-service.test.ts` (~12 tests)
- Create group with auto-incrementing sortOrder
- Create category within group with auto-incrementing sortOrder
- Rename group
- Rename category
- Delete group cascades to categories and monthly budgets
- Delete category cascades to monthly budgets
- Reorder groups updates sortOrder for all groups
- Reorder categories within group updates sortOrder
- Move category to different group
- Toggle group hidden
- Toggle category hidden
- List groups with categories returns correct nesting and order

### `budget-grid-service.test.ts` (~10 tests)
- `getGridData` returns groups with nested categories ordered by sortOrder
- `getGridData` returns correct assigned amounts from monthlyBudget
- `getGridData` computes activity from transactions (seed test transactions)
- `getGridData` computes available as cumulative assigned + cumulative activity
- `getGridData` computes Ready to Assign correctly (income - total assigned)
- Ready to Assign goes negative when over-assigned
- `assignMoney` creates new monthlyBudget row when none exists
- `assignMoney` updates existing monthlyBudget row (upsert behavior)
- `moveMoney` adjusts both categories' monthlyBudget atomically
- `moveMoney` with zero amount is a no-op
- `getGridData` returns zeroes cleanly for a fresh budget with no transactions
- `getGridData` correctly handles split transactions (activity attributed to split categories)

## Dependencies

### New npm packages
- `@dnd-kit/core` — DnD primitives
- `@dnd-kit/sortable` — Sortable lists
- `@dnd-kit/utilities` — CSS transform utilities

### New shadcn/ui components
- `popover`, `select`, `collapsible`, `table` (evaluate), `badge`, `alert`

## Currency Formatting

All amounts in the grid are stored and transmitted as integers in minor units (e.g., `4567` for `$45.67`). The UI uses the existing `fromMinorUnits(amount, currencyCode)` utility from `src/lib/currency.ts` to convert for display. The budget's `currency` field (included in the grid response) determines the minor unit exponent.

## Known Limitations

- **No optimistic updates**: Mutations trigger a full grid refetch. Acceptable for household-scale data.
- **Collapsed state not persisted**: Group collapse is local component state, resets on page reload.
- **No keyboard navigation in grid**: Tab/arrow key navigation within the grid is deferred.
- **No undo**: Assigning/moving money has no undo. Deferred per the overall design spec.
