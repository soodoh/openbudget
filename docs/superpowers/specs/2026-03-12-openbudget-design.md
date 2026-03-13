# OpenBudget — Design Spec

An open-source, self-hosted alternative to YNAB (You Need A Budget) with full envelope budgeting, multi-user budget sharing, and progressive web app support.

## Product Vision

- **Goal:** Community-driven, self-hosted YNAB replacement
- **License:** GPL-3.0
- **Target users:** Individuals and households who want privacy-respecting, zero-cost envelope budgeting

## Tech Stack

Mirrors the [swanki](https://github.com/soodoh/swanki) project:

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Monorepo | Turborepo |
| Framework | TanStack Start + TanStack Router (file-based routing) |
| Data Fetching | React Query |
| Database | SQLite (bun:sqlite) + Drizzle ORM, WAL mode |
| Auth | better-auth (email/password + Google/GitHub OAuth) |
| UI | Tailwind CSS v4 + shadcn/ui + Lucide icons |
| Validation | Zod |
| Testing | Vitest (unit) + Playwright (e2e) |
| Linting | oxlint + Prettier |
| Build/Deploy | Vite + Nitro (Bun preset), single Docker image |

## Monorepo Structure

```
openbudget/
├── apps/
│   ├── web/          # TanStack Start app (main application)
│   ├── mobile/       # Placeholder for future native app
│   └── docs/         # Documentation site
├── turbo.json
├── package.json
├── Dockerfile
└── ...configs
```

Configs copied from swanki: turbo.json, commitlint, husky, prettier, oxlint, .nvmrc, lint-staged, .gitignore.

## Architecture Patterns

Identical to swanki:

- **Service layer:** Classes in `src/lib/services/` that accept a `db` instance and contain synchronous methods (bun:sqlite is sync).
- **API routes:** TanStack Router server handlers in `src/routes/api/` following RESTful conventions.
- **React Query hooks:** In `src/lib/hooks/`, wrapping API calls for client-side data fetching.
- **Auth middleware:** `requireSession()` for authentication guards.
- **Path alias:** `@/*` maps to `./src/*`.

### Budget-Scoped Authorization

Key difference from swanki: most data is budget-scoped, not user-scoped. A `requireBudgetAccess(request, budgetId, minRole)` middleware verifies the user has the required role (owner/editor/viewer) for the target budget. Middleware chain: `requireSession()` → `requireBudgetAccess()` → service call.

## Data Model

All monetary values stored as **integers in minor units** (e.g., `$45.67` = `4567` for USD). No floating point. The number of decimal places is determined by the budget's currency (e.g., 2 for USD/EUR, 0 for JPY, 3 for BHD). A utility function derives the minor unit exponent from the ISO 4217 currency code.

All tables include `createdAt` and `updatedAt` timestamps. Developers should reference the [swanki](https://github.com/soodoh/swanki) codebase for detailed examples of the service layer, API route, and React Query hook patterns described below.

### Budget & Membership

| Table | Key Columns |
|-------|------------|
| `budget` | id (UUID), name, currency (ISO 4217 code, e.g., "USD"), createdBy (FK user), createdAt |
| `budgetMember` | budgetId (FK), userId (FK), role (owner/editor/viewer), invitedAt |

Single currency per budget. Each budget independently shareable.

### Categories

| Table | Key Columns |
|-------|------------|
| `categoryGroup` | id, budgetId (FK), name, sortOrder, isHidden |
| `category` | id, groupId (FK), name, sortOrder, isHidden |
| `monthlyBudget` | id, categoryId (FK), month (YYYY-MM string), assigned (minor units) |

### Accounts & Transactions

| Table | Key Columns |
|-------|------------|
| `account` | id, budgetId (FK), name, type (checking/savings/creditCard/cash/loan/tracking), onBudget (bool), closed, sortOrder |
| `transaction` | id, accountId (FK), date, amount (minor units), payeeId (FK), categoryId (FK), memo, cleared (bool), reconciled (bool), flagColor (red/orange/yellow/green/blue/purple, nullable), transferTransactionId (FK transaction, nullable), approved |
| `transactionSplit` | id, transactionId (FK), categoryId (FK), amount (minor units), memo |
| `scheduledTransaction` | id, accountId (FK), frequency (weekly/biweekly/monthly/yearly/everyNDays), intervalDays (nullable, used when frequency=everyNDays), nextDate, endDate (nullable), amount, payeeId (FK), categoryId (FK), memo |
| `payee` | id, budgetId (FK), name, autoCategory (FK category, nullable) |
| `importMapping` | id, budgetId (FK), name (e.g., "Chase Checking CSV"), fileType (csv/ofx/qfx), columnMap (JSON), createdAt |

### Targets

| Table | Key Columns |
|-------|------------|
| `target` | id, categoryId (FK), type (monthlySpending/weeklySpending/spendingByDate/savingsBalance/monthlySavings), amount, targetDate (nullable), monthlyContribution (nullable) |

## Key Design Decisions

### 1. Month as a String Key

Monthly budgets keyed by `YYYY-MM` string (e.g., `"2026-03"`). Simple to query, sort, and navigate. No timezone issues since budgets operate in wall-clock months.

### 2. "Ready to Assign" is Computed

`Ready to Assign = total income - total assigned across all categories for current and prior months`. Calculated on read, not persisted. Single source of truth from transactions + monthly assignments.

### 3. All Aggregates are Computed, Not Stored

The "Activity" column on the budget grid, account balances (cleared/uncleared), and "Ready to Assign" are all computed from transactions on read. No denormalized counters — just queries with proper indexes. SQLite is fast enough for household-scale data. If performance becomes an issue, computed caches can be added later without schema changes.

### 4. Credit Card Payment Categories are Auto-Managed

When a credit card account is created, a corresponding category is auto-created in a "Credit Card Payments" group. When a transaction on a CC is categorized, the assigned amount in that payment category is automatically adjusted.

### 5. Transfers are Two Linked Transactions

A transfer between accounts creates a linked pair of transactions (one outflow, one inflow) connected via `transferTransactionId` on each transaction pointing to the other. Neither gets a budget category — transfers don't affect the budget.

### 6. File Import Mappings are Persisted

When a user maps CSV columns for a specific bank format, that mapping is saved so future imports from the same bank auto-apply the correct mapping.

## Bank Sync Strategy

**V1: Manual file import only** (CSV, OFX, QFX). No third-party dependencies.

Architecture is designed with a pluggable adapter interface so future integrations (SimpleFIN, GoCardless, etc.) can be added without core changes.

## Deployment

- **Primary:** Single Docker image with SQLite baked in. One `docker run` command.
- **Alternative:** Run directly with Bun for development or users who prefer bare metal.
- SQLite file stored in a mounted volume for persistence.

## Mobile Strategy

**PWA (Progressive Web App)** for v1:
- Responsive design that works well on mobile browsers
- Offline transaction entry (sync when back online)
- Installable to home screen
- Push notifications via Web Push API with VAPID keys (self-hosted, no third-party push service)

The `apps/mobile/` workspace is a placeholder for a future native app.

### Offline Sync Strategy

Offline transaction entry uses a **queue-and-apply** approach:
- Transactions created offline are stored in IndexedDB with client-generated UUIDs
- When connectivity is restored, queued transactions are submitted to the server in order
- The server applies them as normal — if a conflict arises (e.g., category was deleted while offline), the transaction is flagged for user review
- This is intentionally simple (no CRDTs or vector clocks). For a household budget app, conflicting offline edits are rare and manual resolution is acceptable.

## Known Limitations

- **SQLite write concurrency:** WAL mode supports concurrent reads but serializes writes. Acceptable for household use. If write contention becomes an issue, Drizzle's adapter system supports migration to PostgreSQL.
- **No undo/redo in v1:** Deferred. Individual actions (delete transaction, move money) are reversible through the UI but there is no global undo stack.
- **No data export in v1:** Deferred. Users can back up the SQLite file directly. A CSV/OFX export feature will be added in a future sub-project.

## Build Order (Approach: Budget-Grid-First)

Each sub-project gets its own spec → plan → implementation cycle.

### Sub-project 1: Scaffolding

- Monorepo setup (copy swanki configs, turbo, husky, commitlint, etc.)
- better-auth with email/password + Google/GitHub OAuth
- Full DB schema (all tables, even if UI doesn't use them yet)
- Dockerfile
- App shell: sidebar, top nav, theme toggle (system/light/dark)
- Budget CRUD (create, rename, delete)
- `budgetMember` populated on budget creation
- Basic routing: login, register, budget list, budget view (empty)

### Sub-project 2: Budget Grid

- Category groups & categories (CRUD, drag-to-reorder)
- Monthly budget view — the main grid: category group → categories → Assigned / Activity / Available
- "Ready to Assign" calculation
- Assign money to categories
- Move money between categories
- Month navigation (previous/next month)
- Overspending indicators (yellow for cash, red for credit)
- Category group collapsing

### Sub-project 3: Accounts & Transactions

- Account CRUD (all types: checking, savings, credit card, cash, loan, tracking)
- Account sidebar list with balances
- Manual transaction entry (date, payee, category, amount, memo)
- Transaction list view per account with search/filter
- Payee management + auto-categorization
- Split transactions
- Cleared/uncleared status
- Transaction flags (color coding)
- Transfers between accounts
- Budget grid "Activity" column now live

### Sub-project 4: Targets & Automation

- All 5 target types (monthly spending, weekly spending, spending by date, savings balance, monthly savings)
- Target progress indicators on budget grid
- Auto-assign (underfunded, assigned last month, spent last month, average)
- Scheduled/recurring transactions
- Upcoming transaction alerts

### Sub-project 5: Credit Cards & Loans

- Credit card payment category auto-management
- Credit card overspending distinction
- Loan accounts with principal/interest tracking
- Debt payoff progress

### Sub-project 6: File Import

- CSV import with column mapping UI (auto-detect, remember per bank)
- OFX/QFX file import
- Transaction matching (detect duplicates)
- Reconciliation workflow

### Sub-project 7: Reporting

- Spending breakdown (pie/donut chart)
- Spending trends (bar chart over time)
- Income vs. Expense
- Net worth (assets minus liabilities over time)
- Age of Money metric
- Date range and account filtering

### Sub-project 8: Sharing & PWA

- Invite users to a budget (by email)
- Role-based access (owner/editor/viewer)
- Remove/change access
- PWA manifest + service worker
- Offline transaction entry (sync when back online)
- Installable to home screen
- Push notifications

## Features Explicitly Deferred

- Bank sync (SimpleFIN, GoCardless, Plaid) — architecture supports it, not implemented in v1
- Native mobile app (React Native / Expo) — placeholder workspace only
- Multi-currency per budget — single currency per budget in v1
- API for third-party integrations — internal API only
- Apple Watch / widgets / Siri integration
- Loan payoff simulator
- Budget templates
- Fresh Start feature
- Educational content
