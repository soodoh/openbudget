# Sub-project 2: Budget Grid — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the YNAB-style monthly budget grid with category management, money assignment, and computed aggregates.

**Architecture:** Single grid query returns full month state (groups, categories, assigned, activity, available, ready to assign). Server computes all aggregates. Mutations hit fine-grained endpoints and invalidate the grid query. Grid + side inspector layout with dnd-kit for drag-to-reorder.

**Tech Stack:** TanStack Start/Router, React 19, React Query, Drizzle ORM, SQLite (bun:sqlite), dnd-kit, shadcn/ui, Tailwind CSS v4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-13-budget-grid-design.md`

---

## File Structure

### `apps/web/src/lib/services/` (business logic)

| File | Purpose |
|------|---------|
| `category-service.ts` | Category group + category CRUD, reorder, move, toggle hidden |
| `budget-grid-service.ts` | Grid data aggregation query, assignMoney, moveMoney |

### `apps/web/src/__tests__/lib/` (tests)

| File | Purpose |
|------|---------|
| `category-service.test.ts` | CategoryService unit tests (~12 tests) |
| `budget-grid-service.test.ts` | BudgetGridService unit tests (~12 tests) |

### `apps/web/src/routes/api/budgets/$budgetId/` (API routes)

| File | Purpose |
|------|---------|
| `grid.ts` | GET grid data |
| `grid.assign.ts` | PUT assign money |
| `grid.move-money.ts` | POST move money |
| `categories/index.ts` | POST create category |
| `categories/$categoryId.ts` | PATCH rename / DELETE category |
| `categories/$categoryId.move.ts` | PUT move category to another group |
| `categories/reorder.ts` | PUT reorder categories within group |
| `categories/groups/index.ts` | POST create group |
| `categories/groups/$groupId.ts` | PATCH rename / DELETE group |
| `categories/groups/reorder.ts` | PUT reorder groups |

### `apps/web/src/lib/hooks/` (React Query)

| File | Purpose |
|------|---------|
| `use-budget-grid.ts` | Grid query + assign + move money hooks |
| `use-categories.ts` | Category/group CRUD + reorder hooks |

### `apps/web/src/components/budget/` (UI)

| File | Purpose |
|------|---------|
| `budget-grid.tsx` | BudgetGrid — DnD context, renders groups/categories |
| `grid-header.tsx` | Column headers (Category / Assigned / Activity / Available) |
| `category-group-row.tsx` | Draggable group header with chevron collapse and aggregates |
| `category-row.tsx` | Draggable category row with amounts and selection |
| `category-inspector.tsx` | Side detail panel with actions |
| `month-navigator.tsx` | Month navigation (← Mar 2026 →) |
| `ready-to-assign.tsx` | Ready to Assign banner (green/red with action) |
| `assign-popover.tsx` | Amount input popover for assigning money |
| `move-money-dialog.tsx` | Move money between categories dialog |

### `apps/web/src/routes/_authenticated/budgets/` (page)

| File | Purpose |
|------|---------|
| `$budgetId.tsx` | Modify: replace placeholder with BudgetViewPage |

---

## Chunk 1: CategoryService with Tests (TDD)

### Task 1: Write CategoryService tests

**Files:**
- Create: `apps/web/src/__tests__/lib/category-service.test.ts`

- [ ] **Step 1: Write failing tests for CategoryService**

Create `apps/web/src/__tests__/lib/category-service.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import { createTestDb } from "../test-utils";
import { CategoryService } from "@/lib/services/category-service";
import * as schema from "@/db/schema";
import { generateId } from "@/lib/id";

describe("CategoryService", () => {
  let db: BunSQLiteDatabase<typeof schema>;
  let service: CategoryService;
  let budgetId: string;
  let accountId: string;

  beforeEach(() => {
    db = createTestDb();
    service = new CategoryService(db);

    // Seed test user, budget, and account (required by FKs)
    const userId = generateId();
    budgetId = generateId();
    accountId = generateId();
    const now = new Date();

    db.insert(schema.user)
      .values({
        id: userId,
        name: "Test User",
        email: "test@example.com",
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(schema.budget)
      .values({
        id: budgetId,
        name: "Test Budget",
        currency: "USD",
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(schema.financialAccount)
      .values({
        id: accountId,
        budgetId,
        name: "Checking",
        type: "checking",
        onBudget: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  it("creates a group with auto-incrementing sortOrder", () => {
    const g1 = service.createGroup(budgetId, { name: "Housing" });
    const g2 = service.createGroup(budgetId, { name: "Food" });
    expect(g1.sortOrder).toBe(0);
    expect(g2.sortOrder).toBe(1);
  });

  it("creates a category within a group with auto-incrementing sortOrder", () => {
    const group = service.createGroup(budgetId, { name: "Housing" });
    const c1 = service.createCategory(group.id, { name: "Rent" });
    const c2 = service.createCategory(group.id, { name: "Utilities" });
    expect(c1.sortOrder).toBe(0);
    expect(c2.sortOrder).toBe(1);
    expect(c1.groupId).toBe(group.id);
  });

  it("renames a group", () => {
    const group = service.createGroup(budgetId, { name: "Old Name" });
    service.renameGroup(group.id, "New Name");
    const updated = db
      .select()
      .from(schema.categoryGroup)
      .where(eq(schema.categoryGroup.id, group.id))
      .get();
    expect(updated!.name).toBe("New Name");
  });

  it("renames a category", () => {
    const group = service.createGroup(budgetId, { name: "Housing" });
    const cat = service.createCategory(group.id, { name: "Old" });
    service.renameCategory(cat.id, "New");
    const updated = db
      .select()
      .from(schema.category)
      .where(eq(schema.category.id, cat.id))
      .get();
    expect(updated!.name).toBe("New");
  });

  it("deletes a group and cascades to categories, monthly budgets, and SET NULLs transactions", () => {
    const group = service.createGroup(budgetId, { name: "Housing" });
    const cat = service.createCategory(group.id, { name: "Rent" });

    // Seed a monthly budget for the category
    db.insert(schema.monthlyBudget)
      .values({
        id: generateId(),
        categoryId: cat.id,
        month: "2026-03",
        assigned: 180000,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    // Seed a transaction and a split referencing the category
    const txnId = generateId();
    db.insert(schema.transaction)
      .values({
        id: txnId,
        accountId,
        date: "2026-03-15",
        amount: -180000,
        categoryId: cat.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const splitTxnId = generateId();
    db.insert(schema.transaction)
      .values({
        id: splitTxnId,
        accountId,
        date: "2026-03-15",
        amount: -10000,
        categoryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const splitId = generateId();
    db.insert(schema.transactionSplit)
      .values({
        id: splitId,
        transactionId: splitTxnId,
        categoryId: cat.id,
        amount: -10000,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    service.deleteGroup(group.id);

    const groups = db
      .select()
      .from(schema.categoryGroup)
      .where(eq(schema.categoryGroup.id, group.id))
      .all();
    expect(groups).toHaveLength(0);

    const categories = db
      .select()
      .from(schema.category)
      .where(eq(schema.category.groupId, group.id))
      .all();
    expect(categories).toHaveLength(0);

    const budgets = db
      .select()
      .from(schema.monthlyBudget)
      .where(eq(schema.monthlyBudget.categoryId, cat.id))
      .all();
    expect(budgets).toHaveLength(0);

    // Transaction should still exist but with categoryId set to null
    const txn = db.select().from(schema.transaction).where(eq(schema.transaction.id, txnId)).get();
    expect(txn).toBeDefined();
    expect(txn!.categoryId).toBeNull();

    // Split should still exist but with categoryId set to null
    const split = db.select().from(schema.transactionSplit).where(eq(schema.transactionSplit.id, splitId)).get();
    expect(split).toBeDefined();
    expect(split!.categoryId).toBeNull();
  });

  it("deletes a category and cascades to monthly budgets, SET NULLs transactions", () => {
    const group = service.createGroup(budgetId, { name: "Housing" });
    const cat = service.createCategory(group.id, { name: "Rent" });

    db.insert(schema.monthlyBudget)
      .values({
        id: generateId(),
        categoryId: cat.id,
        month: "2026-03",
        assigned: 180000,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    // Seed a transaction referencing the category
    const txnId = generateId();
    db.insert(schema.transaction)
      .values({
        id: txnId,
        accountId,
        date: "2026-03-15",
        amount: -180000,
        categoryId: cat.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    service.deleteCategory(cat.id);

    const categories = db
      .select()
      .from(schema.category)
      .where(eq(schema.category.id, cat.id))
      .all();
    expect(categories).toHaveLength(0);

    const budgets = db
      .select()
      .from(schema.monthlyBudget)
      .where(eq(schema.monthlyBudget.categoryId, cat.id))
      .all();
    expect(budgets).toHaveLength(0);

    // Transaction still exists with categoryId set to null
    const txn = db.select().from(schema.transaction).where(eq(schema.transaction.id, txnId)).get();
    expect(txn).toBeDefined();
    expect(txn!.categoryId).toBeNull();
  });

  it("reorders groups", () => {
    const g1 = service.createGroup(budgetId, { name: "A" });
    const g2 = service.createGroup(budgetId, { name: "B" });
    const g3 = service.createGroup(budgetId, { name: "C" });

    // Reverse order
    service.reorderGroups(budgetId, [g3.id, g1.id, g2.id]);

    const groups = service.listGroupsWithCategories(budgetId);
    expect(groups.map((g) => g.name)).toEqual(["C", "A", "B"]);
  });

  it("reorders categories within a group", () => {
    const group = service.createGroup(budgetId, { name: "Housing" });
    const c1 = service.createCategory(group.id, { name: "Rent" });
    const c2 = service.createCategory(group.id, { name: "Utilities" });
    const c3 = service.createCategory(group.id, { name: "Insurance" });

    service.reorderCategories(group.id, [c3.id, c1.id, c2.id]);

    const result = service.listGroupsWithCategories(budgetId);
    expect(result[0].categories.map((c) => c.name)).toEqual([
      "Insurance",
      "Rent",
      "Utilities",
    ]);
  });

  it("moves a category to a different group", () => {
    const g1 = service.createGroup(budgetId, { name: "Housing" });
    const g2 = service.createGroup(budgetId, { name: "Food" });
    const cat = service.createCategory(g1.id, { name: "Rent" });

    service.moveCategory(cat.id, g2.id, 0);

    const updated = db
      .select()
      .from(schema.category)
      .where(eq(schema.category.id, cat.id))
      .get();
    expect(updated!.groupId).toBe(g2.id);
    expect(updated!.sortOrder).toBe(0);
  });

  it("toggles group hidden", () => {
    const group = service.createGroup(budgetId, { name: "Housing" });
    expect(group.isHidden).toBe(false);

    service.toggleGroupHidden(group.id);
    const toggled = db
      .select()
      .from(schema.categoryGroup)
      .where(eq(schema.categoryGroup.id, group.id))
      .get();
    expect(toggled!.isHidden).toBe(true);

    service.toggleGroupHidden(group.id);
    const unToggled = db
      .select()
      .from(schema.categoryGroup)
      .where(eq(schema.categoryGroup.id, group.id))
      .get();
    expect(unToggled!.isHidden).toBe(false);
  });

  it("toggles category hidden", () => {
    const group = service.createGroup(budgetId, { name: "Housing" });
    const cat = service.createCategory(group.id, { name: "Rent" });
    expect(cat.isHidden).toBe(false);

    service.toggleCategoryHidden(cat.id);
    const toggled = db
      .select()
      .from(schema.category)
      .where(eq(schema.category.id, cat.id))
      .get();
    expect(toggled!.isHidden).toBe(true);
  });

  it("lists groups with categories in correct nesting and order", () => {
    const g1 = service.createGroup(budgetId, { name: "Housing" });
    const g2 = service.createGroup(budgetId, { name: "Food" });
    service.createCategory(g1.id, { name: "Rent" });
    service.createCategory(g1.id, { name: "Utilities" });
    service.createCategory(g2.id, { name: "Groceries" });

    const result = service.listGroupsWithCategories(budgetId);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Housing");
    expect(result[0].categories).toHaveLength(2);
    expect(result[0].categories[0].name).toBe("Rent");
    expect(result[1].name).toBe("Food");
    expect(result[1].categories).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && bun --bun vitest run src/__tests__/lib/category-service.test.ts`
Expected: FAIL — module `@/lib/services/category-service` not found

---

### Task 2: Implement CategoryService

**Files:**
- Create: `apps/web/src/lib/services/category-service.ts`

- [ ] **Step 1: Create CategoryService implementation**

Create `apps/web/src/lib/services/category-service.ts`:

```typescript
import { eq, and, max, asc } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/schema";
import { categoryGroup, category } from "../../db/schema";
import { generateId } from "../id";

type Db = BunSQLiteDatabase<typeof schema>;

export class CategoryService {
  private db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  listGroupsWithCategories(budgetId: string) {
    const groups = this.db
      .select()
      .from(categoryGroup)
      .where(eq(categoryGroup.budgetId, budgetId))
      .orderBy(asc(categoryGroup.sortOrder))
      .all();

    return groups.map((group) => ({
      ...group,
      categories: this.db
        .select()
        .from(category)
        .where(eq(category.groupId, group.id))
        .orderBy(asc(category.sortOrder))
        .all(),
    }));
  }

  createGroup(
    budgetId: string,
    input: { name: string },
  ): typeof categoryGroup.$inferSelect {
    const maxOrder = this.db
      .select({ value: max(categoryGroup.sortOrder) })
      .from(categoryGroup)
      .where(eq(categoryGroup.budgetId, budgetId))
      .get();

    const id = generateId();
    const now = new Date();
    this.db
      .insert(categoryGroup)
      .values({
        id,
        budgetId,
        name: input.name,
        sortOrder: (maxOrder?.value ?? -1) + 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return this.db
      .select()
      .from(categoryGroup)
      .where(eq(categoryGroup.id, id))
      .get()!;
  }

  createCategory(
    groupId: string,
    input: { name: string },
  ): typeof category.$inferSelect {
    const maxOrder = this.db
      .select({ value: max(category.sortOrder) })
      .from(category)
      .where(eq(category.groupId, groupId))
      .get();

    const id = generateId();
    const now = new Date();
    this.db
      .insert(category)
      .values({
        id,
        groupId,
        name: input.name,
        sortOrder: (maxOrder?.value ?? -1) + 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return this.db
      .select()
      .from(category)
      .where(eq(category.id, id))
      .get()!;
  }

  renameGroup(groupId: string, name: string): void {
    this.db
      .update(categoryGroup)
      .set({ name })
      .where(eq(categoryGroup.id, groupId))
      .run();
  }

  renameCategory(categoryId: string, name: string): void {
    this.db
      .update(category)
      .set({ name })
      .where(eq(category.id, categoryId))
      .run();
  }

  deleteGroup(groupId: string): void {
    this.db
      .delete(categoryGroup)
      .where(eq(categoryGroup.id, groupId))
      .run();
  }

  deleteCategory(categoryId: string): void {
    this.db
      .delete(category)
      .where(eq(category.id, categoryId))
      .run();
  }

  reorderGroups(budgetId: string, orderedGroupIds: string[]): void {
    this.db.transaction((tx) => {
      for (let i = 0; i < orderedGroupIds.length; i++) {
        tx.update(categoryGroup)
          .set({ sortOrder: i })
          .where(
            and(
              eq(categoryGroup.id, orderedGroupIds[i]),
              eq(categoryGroup.budgetId, budgetId),
            ),
          )
          .run();
      }
    });
  }

  reorderCategories(groupId: string, orderedCategoryIds: string[]): void {
    this.db.transaction((tx) => {
      for (let i = 0; i < orderedCategoryIds.length; i++) {
        tx.update(category)
          .set({ sortOrder: i })
          .where(
            and(
              eq(category.id, orderedCategoryIds[i]),
              eq(category.groupId, groupId),
            ),
          )
          .run();
      }
    });
  }

  moveCategory(
    categoryId: string,
    targetGroupId: string,
    sortOrder: number,
  ): void {
    this.db
      .update(category)
      .set({ groupId: targetGroupId, sortOrder })
      .where(eq(category.id, categoryId))
      .run();
  }

  toggleGroupHidden(groupId: string): void {
    const group = this.db
      .select({ isHidden: categoryGroup.isHidden })
      .from(categoryGroup)
      .where(eq(categoryGroup.id, groupId))
      .get();
    if (group) {
      this.db
        .update(categoryGroup)
        .set({ isHidden: !group.isHidden })
        .where(eq(categoryGroup.id, groupId))
        .run();
    }
  }

  toggleCategoryHidden(categoryId: string): void {
    const cat = this.db
      .select({ isHidden: category.isHidden })
      .from(category)
      .where(eq(category.id, categoryId))
      .get();
    if (cat) {
      this.db
        .update(category)
        .set({ isHidden: !cat.isHidden })
        .where(eq(category.id, categoryId))
        .run();
    }
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd apps/web && bun --bun vitest run src/__tests__/lib/category-service.test.ts`
Expected: All 12 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/services/category-service.ts apps/web/src/__tests__/lib/category-service.test.ts
git commit -m "feat: add category service with CRUD, reorder, and tests"
```

---

## Chunk 2: BudgetGridService with Tests (TDD)

### Task 3: Write BudgetGridService tests

**Files:**
- Create: `apps/web/src/__tests__/lib/budget-grid-service.test.ts`

- [ ] **Step 1: Write failing tests for BudgetGridService**

Create `apps/web/src/__tests__/lib/budget-grid-service.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { createTestDb } from "../test-utils";
import { BudgetGridService } from "@/lib/services/budget-grid-service";
import { CategoryService } from "@/lib/services/category-service";
import * as schema from "@/db/schema";
import { generateId } from "@/lib/id";

describe("BudgetGridService", () => {
  let db: BunSQLiteDatabase<typeof schema>;
  let gridService: BudgetGridService;
  let categoryService: CategoryService;
  let budgetId: string;
  let userId: string;
  let accountId: string;

  beforeEach(() => {
    db = createTestDb();
    gridService = new BudgetGridService(db);
    categoryService = new CategoryService(db);

    userId = generateId();
    budgetId = generateId();
    accountId = generateId();
    const now = new Date();

    // Seed user
    db.insert(schema.user)
      .values({
        id: userId,
        name: "Test User",
        email: "test@example.com",
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Seed budget
    db.insert(schema.budget)
      .values({
        id: budgetId,
        name: "Test Budget",
        currency: "USD",
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Seed on-budget checking account (needed for transaction tests)
    db.insert(schema.financialAccount)
      .values({
        id: accountId,
        budgetId,
        name: "Checking",
        type: "checking",
        onBudget: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  it("returns zeroes cleanly for a fresh budget with no data", () => {
    const grid = gridService.getGridData(budgetId, "2026-03");
    expect(grid.readyToAssign).toBe(0);
    expect(grid.currency).toBe("USD");
    expect(grid.month).toBe("2026-03");
    expect(grid.groups).toHaveLength(0);
  });

  it("returns groups with nested categories ordered by sortOrder", () => {
    const g1 = categoryService.createGroup(budgetId, { name: "Housing" });
    const g2 = categoryService.createGroup(budgetId, { name: "Food" });
    categoryService.createCategory(g1.id, { name: "Rent" });
    categoryService.createCategory(g1.id, { name: "Utilities" });
    categoryService.createCategory(g2.id, { name: "Groceries" });

    const grid = gridService.getGridData(budgetId, "2026-03");
    expect(grid.groups).toHaveLength(2);
    expect(grid.groups[0].name).toBe("Housing");
    expect(grid.groups[0].categories).toHaveLength(2);
    expect(grid.groups[0].categories[0].name).toBe("Rent");
    expect(grid.groups[1].name).toBe("Food");
    expect(grid.groups[1].categories).toHaveLength(1);
  });

  it("returns correct assigned amounts from monthlyBudget", () => {
    const group = categoryService.createGroup(budgetId, { name: "Housing" });
    const cat = categoryService.createCategory(group.id, { name: "Rent" });

    gridService.assignMoney(cat.id, "2026-03", 180000);

    const grid = gridService.getGridData(budgetId, "2026-03");
    expect(grid.groups[0].categories[0].assigned).toBe(180000);
  });

  it("computes activity from transactions", () => {
    const group = categoryService.createGroup(budgetId, { name: "Housing" });
    const cat = categoryService.createCategory(group.id, { name: "Rent" });

    // Seed a categorized transaction (spending = negative amount)
    db.insert(schema.transaction)
      .values({
        id: generateId(),
        accountId,
        date: "2026-03-15",
        amount: -180000,
        categoryId: cat.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const grid = gridService.getGridData(budgetId, "2026-03");
    expect(grid.groups[0].categories[0].activity).toBe(-180000);
  });

  it("computes available as cumulative assigned + cumulative activity", () => {
    const group = categoryService.createGroup(budgetId, { name: "Housing" });
    const cat = categoryService.createCategory(group.id, { name: "Rent" });

    // Assign in Feb and March
    gridService.assignMoney(cat.id, "2026-02", 180000);
    gridService.assignMoney(cat.id, "2026-03", 180000);

    // Spend in Feb
    db.insert(schema.transaction)
      .values({
        id: generateId(),
        accountId,
        date: "2026-02-15",
        amount: -180000,
        categoryId: cat.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    // March: cumulative assigned = 360000, cumulative activity = -180000 → available = 180000
    const grid = gridService.getGridData(budgetId, "2026-03");
    expect(grid.groups[0].categories[0].available).toBe(180000);
  });

  it("computes Ready to Assign correctly (income - total assigned)", () => {
    const group = categoryService.createGroup(budgetId, { name: "Housing" });
    const cat = categoryService.createCategory(group.id, { name: "Rent" });

    // Income: uncategorized inflow (no categoryId, no transferTransactionId)
    db.insert(schema.transaction)
      .values({
        id: generateId(),
        accountId,
        date: "2026-03-01",
        amount: 500000, // $5000.00 paycheck
        categoryId: null,
        transferTransactionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    // Assign $1800 to Rent
    gridService.assignMoney(cat.id, "2026-03", 180000);

    const grid = gridService.getGridData(budgetId, "2026-03");
    // 500000 income - 180000 assigned = 320000
    expect(grid.readyToAssign).toBe(320000);
  });

  it("Ready to Assign goes negative when over-assigned", () => {
    const group = categoryService.createGroup(budgetId, { name: "Housing" });
    const cat = categoryService.createCategory(group.id, { name: "Rent" });

    // Small income
    db.insert(schema.transaction)
      .values({
        id: generateId(),
        accountId,
        date: "2026-03-01",
        amount: 100000,
        categoryId: null,
        transferTransactionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    // Over-assign
    gridService.assignMoney(cat.id, "2026-03", 200000);

    const grid = gridService.getGridData(budgetId, "2026-03");
    expect(grid.readyToAssign).toBe(-100000);
  });

  it("assignMoney creates new monthlyBudget row when none exists", () => {
    const group = categoryService.createGroup(budgetId, { name: "Housing" });
    const cat = categoryService.createCategory(group.id, { name: "Rent" });

    gridService.assignMoney(cat.id, "2026-03", 180000);

    const rows = db.select().from(schema.monthlyBudget).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].assigned).toBe(180000);
    expect(rows[0].categoryId).toBe(cat.id);
    expect(rows[0].month).toBe("2026-03");
  });

  it("assignMoney updates existing monthlyBudget row (upsert)", () => {
    const group = categoryService.createGroup(budgetId, { name: "Housing" });
    const cat = categoryService.createCategory(group.id, { name: "Rent" });

    gridService.assignMoney(cat.id, "2026-03", 180000);
    gridService.assignMoney(cat.id, "2026-03", 200000);

    const grid = gridService.getGridData(budgetId, "2026-03");
    expect(grid.groups[0].categories[0].assigned).toBe(200000);
  });

  it("moveMoney adjusts both categories atomically", () => {
    const group = categoryService.createGroup(budgetId, { name: "Budget" });
    const cat1 = categoryService.createCategory(group.id, { name: "Rent" });
    const cat2 = categoryService.createCategory(group.id, { name: "Food" });

    gridService.assignMoney(cat1.id, "2026-03", 180000);
    gridService.assignMoney(cat2.id, "2026-03", 40000);

    // Move 50000 from Rent to Food
    gridService.moveMoney(cat1.id, cat2.id, "2026-03", 50000);

    const grid = gridService.getGridData(budgetId, "2026-03");
    const rent = grid.groups[0].categories.find((c) => c.name === "Rent")!;
    const food = grid.groups[0].categories.find((c) => c.name === "Food")!;
    expect(rent.assigned).toBe(130000); // 180000 - 50000
    expect(food.assigned).toBe(90000); // 40000 + 50000
  });

  it("moveMoney with zero amount is a no-op", () => {
    const group = categoryService.createGroup(budgetId, { name: "Budget" });
    const cat1 = categoryService.createCategory(group.id, { name: "Rent" });
    const cat2 = categoryService.createCategory(group.id, { name: "Food" });

    gridService.assignMoney(cat1.id, "2026-03", 180000);

    gridService.moveMoney(cat1.id, cat2.id, "2026-03", 0);

    const grid = gridService.getGridData(budgetId, "2026-03");
    const rent = grid.groups[0].categories.find((c) => c.name === "Rent")!;
    expect(rent.assigned).toBe(180000);
  });

  it("correctly handles split transactions (activity attributed to split categories)", () => {
    const group = categoryService.createGroup(budgetId, { name: "Budget" });
    const cat1 = categoryService.createCategory(group.id, { name: "Groceries" });
    const cat2 = categoryService.createCategory(group.id, {
      name: "Household",
    });

    // Create a split transaction: $100 total, $60 groceries + $40 household
    const txId = generateId();
    db.insert(schema.transaction)
      .values({
        id: txId,
        accountId,
        date: "2026-03-15",
        amount: -10000,
        categoryId: null, // split transactions have null categoryId on parent
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    db.insert(schema.transactionSplit)
      .values([
        {
          id: generateId(),
          transactionId: txId,
          categoryId: cat1.id,
          amount: -6000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: generateId(),
          transactionId: txId,
          categoryId: cat2.id,
          amount: -4000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .run();

    const grid = gridService.getGridData(budgetId, "2026-03");
    const groceries = grid.groups[0].categories.find(
      (c) => c.name === "Groceries",
    )!;
    const household = grid.groups[0].categories.find(
      (c) => c.name === "Household",
    )!;
    expect(groceries.activity).toBe(-6000);
    expect(household.activity).toBe(-4000);
  });

  it("excludes off-budget account transactions from activity", () => {
    const group = categoryService.createGroup(budgetId, { name: "Budget" });
    const cat = categoryService.createCategory(group.id, { name: "Rent" });

    // Create an off-budget account
    const offBudgetAccountId = generateId();
    db.insert(schema.financialAccount)
      .values({
        id: offBudgetAccountId,
        budgetId,
        name: "Investment",
        type: "tracking",
        onBudget: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    // Transaction on off-budget account — should NOT appear in activity
    db.insert(schema.transaction)
      .values({
        id: generateId(),
        accountId: offBudgetAccountId,
        date: "2026-03-15",
        amount: -50000,
        categoryId: cat.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const grid = gridService.getGridData(budgetId, "2026-03");
    expect(grid.groups[0].categories[0].activity).toBe(0);
  });

  it("excludes transfers from Ready to Assign income", () => {
    // Income transaction (should count)
    db.insert(schema.transaction)
      .values({
        id: generateId(),
        accountId,
        date: "2026-03-01",
        amount: 500000,
        categoryId: null,
        transferTransactionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    // Transfer transaction (should NOT count as income)
    const transferId = generateId();
    db.insert(schema.transaction)
      .values({
        id: transferId,
        accountId,
        date: "2026-03-01",
        amount: 100000,
        categoryId: null,
        transferTransactionId: "some-linked-tx",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const grid = gridService.getGridData(budgetId, "2026-03");
    expect(grid.readyToAssign).toBe(500000); // Only the income, not the transfer
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && bun --bun vitest run src/__tests__/lib/budget-grid-service.test.ts`
Expected: FAIL — module `@/lib/services/budget-grid-service` not found

---

### Task 4: Implement BudgetGridService

**Files:**
- Create: `apps/web/src/lib/services/budget-grid-service.ts`

- [ ] **Step 1: Create BudgetGridService implementation**

Create `apps/web/src/lib/services/budget-grid-service.ts`:

```typescript
import { eq, and, sql, lte, isNull, isNotNull, asc } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/schema";
import {
  budget,
  categoryGroup,
  category,
  monthlyBudget,
  transaction,
  transactionSplit,
  financialAccount,
} from "../../db/schema";
import { generateId } from "../id";

type Db = BunSQLiteDatabase<typeof schema>;

export interface GridCategory {
  id: string;
  name: string;
  sortOrder: number;
  isHidden: boolean;
  assigned: number;
  activity: number;
  available: number;
}

export interface GridGroup {
  id: string;
  name: string;
  sortOrder: number;
  isHidden: boolean;
  assigned: number;
  activity: number;
  available: number;
  categories: GridCategory[];
}

export interface GridData {
  readyToAssign: number;
  currency: string;
  month: string;
  groups: GridGroup[];
}

export class BudgetGridService {
  private db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  getGridData(budgetId: string, month: string): GridData {
    // Get budget currency
    const budgetRow = this.db
      .select({ currency: budget.currency })
      .from(budget)
      .where(eq(budget.id, budgetId))
      .get();
    const currency = budgetRow?.currency ?? "USD";

    // Compute the month end for range queries (e.g., "2026-03" → "2026-03" for lte comparison)
    const monthEnd = month; // YYYY-MM string comparison works for lte

    // Get all groups with categories
    const groups = this.db
      .select()
      .from(categoryGroup)
      .where(eq(categoryGroup.budgetId, budgetId))
      .orderBy(asc(categoryGroup.sortOrder))
      .all();

    const gridGroups: GridGroup[] = groups.map((group) => {
      const categories = this.db
        .select()
        .from(category)
        .where(eq(category.groupId, group.id))
        .orderBy(asc(category.sortOrder))
        .all();

      const gridCategories: GridCategory[] = categories.map((cat) => {
        // Assigned: from monthlyBudget for THIS month only
        const assignedRow = this.db
          .select({ assigned: monthlyBudget.assigned })
          .from(monthlyBudget)
          .where(
            and(
              eq(monthlyBudget.categoryId, cat.id),
              eq(monthlyBudget.month, month),
            ),
          )
          .get();
        const assigned = assignedRow?.assigned ?? 0;

        // Activity: sum of transactions for this category THIS month
        // Includes both direct transactions and split transactions
        // Only on-budget accounts
        const activityRow = this.db
          .select({
            total: sql<number>`coalesce(sum(${transaction.amount}), 0)`,
          })
          .from(transaction)
          .innerJoin(
            financialAccount,
            eq(transaction.accountId, financialAccount.id),
          )
          .where(
            and(
              eq(transaction.categoryId, cat.id),
              sql`substr(${transaction.date}, 1, 7) = ${month}`,
              eq(financialAccount.onBudget, true),
            ),
          )
          .get();

        // Split transaction activity
        const splitActivityRow = this.db
          .select({
            total: sql<number>`coalesce(sum(${transactionSplit.amount}), 0)`,
          })
          .from(transactionSplit)
          .innerJoin(
            transaction,
            eq(transactionSplit.transactionId, transaction.id),
          )
          .innerJoin(
            financialAccount,
            eq(transaction.accountId, financialAccount.id),
          )
          .where(
            and(
              eq(transactionSplit.categoryId, cat.id),
              sql`substr(${transaction.date}, 1, 7) = ${month}`,
              eq(financialAccount.onBudget, true),
            ),
          )
          .get();

        const activity =
          (activityRow?.total ?? 0) + (splitActivityRow?.total ?? 0);

        // Available: cumulative assigned + cumulative activity (all months up to and including current)
        const cumulativeAssignedRow = this.db
          .select({
            total: sql<number>`coalesce(sum(${monthlyBudget.assigned}), 0)`,
          })
          .from(monthlyBudget)
          .where(
            and(
              eq(monthlyBudget.categoryId, cat.id),
              lte(monthlyBudget.month, month),
            ),
          )
          .get();

        const cumulativeActivityRow = this.db
          .select({
            total: sql<number>`coalesce(sum(${transaction.amount}), 0)`,
          })
          .from(transaction)
          .innerJoin(
            financialAccount,
            eq(transaction.accountId, financialAccount.id),
          )
          .where(
            and(
              eq(transaction.categoryId, cat.id),
              sql`substr(${transaction.date}, 1, 7) <= ${month}`,
              eq(financialAccount.onBudget, true),
            ),
          )
          .get();

        const cumulativeSplitActivityRow = this.db
          .select({
            total: sql<number>`coalesce(sum(${transactionSplit.amount}), 0)`,
          })
          .from(transactionSplit)
          .innerJoin(
            transaction,
            eq(transactionSplit.transactionId, transaction.id),
          )
          .innerJoin(
            financialAccount,
            eq(transaction.accountId, financialAccount.id),
          )
          .where(
            and(
              eq(transactionSplit.categoryId, cat.id),
              sql`substr(${transaction.date}, 1, 7) <= ${month}`,
              eq(financialAccount.onBudget, true),
            ),
          )
          .get();

        const available =
          (cumulativeAssignedRow?.total ?? 0) +
          (cumulativeActivityRow?.total ?? 0) +
          (cumulativeSplitActivityRow?.total ?? 0);

        return {
          id: cat.id,
          name: cat.name,
          sortOrder: cat.sortOrder,
          isHidden: cat.isHidden,
          assigned,
          activity,
          available,
        };
      });

      return {
        id: group.id,
        name: group.name,
        sortOrder: group.sortOrder,
        isHidden: group.isHidden,
        assigned: gridCategories.reduce((sum, c) => sum + c.assigned, 0),
        activity: gridCategories.reduce((sum, c) => sum + c.activity, 0),
        available: gridCategories.reduce((sum, c) => sum + c.available, 0),
        categories: gridCategories,
      };
    });

    // Ready to Assign: total inflows - total assigned
    // Inflows: uncategorized, non-transfer transactions on on-budget accounts
    const inflowsRow = this.db
      .select({
        total: sql<number>`coalesce(sum(${transaction.amount}), 0)`,
      })
      .from(transaction)
      .innerJoin(
        financialAccount,
        eq(transaction.accountId, financialAccount.id),
      )
      .where(
        and(
          eq(financialAccount.budgetId, budgetId),
          eq(financialAccount.onBudget, true),
          isNull(transaction.categoryId),
          isNull(transaction.transferTransactionId),
          sql`substr(${transaction.date}, 1, 7) <= ${month}`,
        ),
      )
      .get();

    const totalAssignedRow = this.db
      .select({
        total: sql<number>`coalesce(sum(${monthlyBudget.assigned}), 0)`,
      })
      .from(monthlyBudget)
      .innerJoin(category, eq(monthlyBudget.categoryId, category.id))
      .innerJoin(categoryGroup, eq(category.groupId, categoryGroup.id))
      .where(
        and(
          eq(categoryGroup.budgetId, budgetId),
          lte(monthlyBudget.month, month),
        ),
      )
      .get();

    const readyToAssign =
      (inflowsRow?.total ?? 0) - (totalAssignedRow?.total ?? 0);

    return {
      readyToAssign,
      currency,
      month,
      groups: gridGroups,
    };
  }

  assignMoney(categoryId: string, month: string, amount: number): void {
    const existing = this.db
      .select({ id: monthlyBudget.id })
      .from(monthlyBudget)
      .where(
        and(
          eq(monthlyBudget.categoryId, categoryId),
          eq(monthlyBudget.month, month),
        ),
      )
      .get();

    if (existing) {
      this.db
        .update(monthlyBudget)
        .set({ assigned: amount })
        .where(eq(monthlyBudget.id, existing.id))
        .run();
    } else {
      this.db
        .insert(monthlyBudget)
        .values({
          id: generateId(),
          categoryId,
          month,
          assigned: amount,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();
    }
  }

  moveMoney(
    fromCategoryId: string,
    toCategoryId: string,
    month: string,
    amount: number,
  ): void {
    if (amount <= 0) return;

    this.db.transaction((tx) => {
      // Helper to get or create monthly budget
      const getOrCreate = (catId: string): { id: string; assigned: number } => {
        const existing = tx
          .select({ id: monthlyBudget.id, assigned: monthlyBudget.assigned })
          .from(monthlyBudget)
          .where(
            and(
              eq(monthlyBudget.categoryId, catId),
              eq(monthlyBudget.month, month),
            ),
          )
          .get();

        if (existing) return existing;

        const id = generateId();
        tx.insert(monthlyBudget)
          .values({
            id,
            categoryId: catId,
            month,
            assigned: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .run();
        return { id, assigned: 0 };
      };

      const from = getOrCreate(fromCategoryId);
      const to = getOrCreate(toCategoryId);

      tx.update(monthlyBudget)
        .set({ assigned: from.assigned - amount })
        .where(eq(monthlyBudget.id, from.id))
        .run();

      tx.update(monthlyBudget)
        .set({ assigned: to.assigned + amount })
        .where(eq(monthlyBudget.id, to.id))
        .run();
    });
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd apps/web && bun --bun vitest run src/__tests__/lib/budget-grid-service.test.ts`
Expected: All 14 tests PASS

- [ ] **Step 3: Run all tests to verify nothing is broken**

Run: `cd apps/web && bun --bun vitest run`
Expected: All tests pass (currency + budget-service + category-service + budget-grid-service)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/services/budget-grid-service.ts apps/web/src/__tests__/lib/budget-grid-service.test.ts
git commit -m "feat: add budget grid service with aggregation, assign, and move money"
```

---

## Chunk 3: API Routes

### Task 5: Install dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install dnd-kit and new shadcn components**

```bash
cd apps/web && bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
cd apps/web && bunx shadcn@latest add popover select collapsible badge alert scroll-area
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json apps/web/src/components/ui/ bun.lock
git commit -m "feat: add dnd-kit and shadcn components for budget grid"
```

---

### Task 6: Create grid API route

**Files:**
- Create: `apps/web/src/routes/api/budgets/$budgetId/grid.ts`

- [ ] **Step 1: Create grid API route**

Create `apps/web/src/routes/api/budgets/$budgetId/grid.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../lib/auth-middleware";
import { BudgetGridService } from "../../../../lib/services/budget-grid-service";
import { db } from "../../../../db";

const gridService = new BudgetGridService(db);

export const Route = createFileRoute("/api/budgets/$budgetId/grid")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId);
        const url = new URL(request.url);
        const month = url.searchParams.get("month");
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
          return Response.json(
            { error: "month query param required (YYYY-MM)" },
            { status: 400 },
          );
        }
        const grid = gridService.getGridData(params.budgetId, month);
        return Response.json(grid);
      },
    },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/routes/api/budgets/\$budgetId/grid.ts
git commit -m "feat: add grid data API endpoint"
```

---

### Task 7: Create money operation API routes

**Files:**
- Create: `apps/web/src/routes/api/budgets/$budgetId/grid.assign.ts`
- Create: `apps/web/src/routes/api/budgets/$budgetId/grid.move-money.ts`

- [ ] **Step 1: Create assign money route**

Create `apps/web/src/routes/api/budgets/$budgetId/grid.assign.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../lib/auth-middleware";
import { BudgetGridService } from "../../../../lib/services/budget-grid-service";
import { db } from "../../../../db";

const gridService = new BudgetGridService(db);

export const Route = createFileRoute("/api/budgets/$budgetId/grid/assign")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as {
          categoryId?: string;
          month?: string;
          amount?: number;
        };
        if (
          !body.categoryId ||
          !body.month ||
          typeof body.amount !== "number"
        ) {
          return Response.json(
            { error: "categoryId, month, and amount are required" },
            { status: 400 },
          );
        }
        gridService.assignMoney(body.categoryId, body.month, body.amount);
        return Response.json({ ok: true });
      },
    },
  },
});
```

- [ ] **Step 2: Create move money route**

Create `apps/web/src/routes/api/budgets/$budgetId/grid.move-money.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../lib/auth-middleware";
import { BudgetGridService } from "../../../../lib/services/budget-grid-service";
import { db } from "../../../../db";

const gridService = new BudgetGridService(db);

export const Route = createFileRoute(
  "/api/budgets/$budgetId/grid/move-money",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as {
          fromCategoryId?: string;
          toCategoryId?: string;
          month?: string;
          amount?: number;
        };
        if (
          !body.fromCategoryId ||
          !body.toCategoryId ||
          !body.month ||
          typeof body.amount !== "number" ||
          body.amount < 0
        ) {
          return Response.json(
            {
              error:
                "fromCategoryId, toCategoryId, month, and positive amount required",
            },
            { status: 400 },
          );
        }
        gridService.moveMoney(
          body.fromCategoryId,
          body.toCategoryId,
          body.month,
          body.amount,
        );
        return Response.json({ ok: true });
      },
    },
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/api/budgets/\$budgetId/grid.assign.ts apps/web/src/routes/api/budgets/\$budgetId/grid.move-money.ts
git commit -m "feat: add assign and move money API endpoints"
```

---

### Task 8: Create category group API routes

**Files:**
- Create: `apps/web/src/routes/api/budgets/$budgetId/categories/groups/index.ts`
- Create: `apps/web/src/routes/api/budgets/$budgetId/categories/groups/$groupId.ts`
- Create: `apps/web/src/routes/api/budgets/$budgetId/categories/groups/reorder.ts`

- [ ] **Step 1: Create group create route**

Create `apps/web/src/routes/api/budgets/$budgetId/categories/groups/index.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../../lib/services/category-service";
import { db } from "../../../../../../db";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
  "/api/budgets/$budgetId/categories/groups/",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as { name?: string };
        if (!body.name || typeof body.name !== "string") {
          return Response.json(
            { error: "name is required" },
            { status: 400 },
          );
        }
        const group = categoryService.createGroup(params.budgetId, {
          name: body.name,
        });
        return Response.json(group, { status: 201 });
      },
    },
  },
});
```

- [ ] **Step 2: Create group rename/delete route**

Create `apps/web/src/routes/api/budgets/$budgetId/categories/groups/$groupId.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../../lib/services/category-service";
import { db } from "../../../../../../db";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
  "/api/budgets/$budgetId/categories/groups/$groupId",
)({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as { name?: string };
        if (!body.name || typeof body.name !== "string") {
          return Response.json(
            { error: "name is required" },
            { status: 400 },
          );
        }
        categoryService.renameGroup(params.groupId, body.name);
        return Response.json({ ok: true });
      },
      DELETE: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        categoryService.deleteGroup(params.groupId);
        return Response.json({ ok: true });
      },
    },
  },
});
```

- [ ] **Step 3: Create group reorder route**

Create `apps/web/src/routes/api/budgets/$budgetId/categories/groups/reorder.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../../lib/services/category-service";
import { db } from "../../../../../../db";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
  "/api/budgets/$budgetId/categories/groups/reorder",
)({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as { orderedIds?: string[] };
        if (!Array.isArray(body.orderedIds)) {
          return Response.json(
            { error: "orderedIds array is required" },
            { status: 400 },
          );
        }
        categoryService.reorderGroups(params.budgetId, body.orderedIds);
        return Response.json({ ok: true });
      },
    },
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/api/budgets/\$budgetId/categories/groups/
git commit -m "feat: add category group CRUD and reorder API endpoints"
```

---

### Task 9: Create category API routes

**Files:**
- Create: `apps/web/src/routes/api/budgets/$budgetId/categories/index.ts`
- Create: `apps/web/src/routes/api/budgets/$budgetId/categories/$categoryId.ts`
- Create: `apps/web/src/routes/api/budgets/$budgetId/categories/$categoryId.move.ts`
- Create: `apps/web/src/routes/api/budgets/$budgetId/categories/reorder.ts`

- [ ] **Step 1: Create category create route**

Create `apps/web/src/routes/api/budgets/$budgetId/categories/index.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../lib/services/category-service";
import { db } from "../../../../../db";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
  "/api/budgets/$budgetId/categories/",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as {
          groupId?: string;
          name?: string;
        };
        if (!body.groupId || !body.name || typeof body.name !== "string") {
          return Response.json(
            { error: "groupId and name are required" },
            { status: 400 },
          );
        }
        const cat = categoryService.createCategory(body.groupId, {
          name: body.name,
        });
        return Response.json(cat, { status: 201 });
      },
    },
  },
});
```

- [ ] **Step 2: Create category rename/delete route**

Create `apps/web/src/routes/api/budgets/$budgetId/categories/$categoryId.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../lib/services/category-service";
import { db } from "../../../../../db";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
  "/api/budgets/$budgetId/categories/$categoryId",
)({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as { name?: string };
        if (!body.name || typeof body.name !== "string") {
          return Response.json(
            { error: "name is required" },
            { status: 400 },
          );
        }
        categoryService.renameCategory(params.categoryId, body.name);
        return Response.json({ ok: true });
      },
      DELETE: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        categoryService.deleteCategory(params.categoryId);
        return Response.json({ ok: true });
      },
    },
  },
});
```

- [ ] **Step 3: Create category move route**

Create `apps/web/src/routes/api/budgets/$budgetId/categories/$categoryId.move.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../lib/services/category-service";
import { db } from "../../../../../db";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
  "/api/budgets/$budgetId/categories/$categoryId/move",
)({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as {
          targetGroupId?: string;
          sortOrder?: number;
        };
        if (!body.targetGroupId || typeof body.sortOrder !== "number") {
          return Response.json(
            { error: "targetGroupId and sortOrder are required" },
            { status: 400 },
          );
        }
        categoryService.moveCategory(
          params.categoryId,
          body.targetGroupId,
          body.sortOrder,
        );
        return Response.json({ ok: true });
      },
    },
  },
});
```

- [ ] **Step 4: Create category reorder route**

Create `apps/web/src/routes/api/budgets/$budgetId/categories/reorder.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../lib/services/category-service";
import { db } from "../../../../../db";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
  "/api/budgets/$budgetId/categories/reorder",
)({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as {
          groupId?: string;
          orderedIds?: string[];
        };
        if (!body.groupId || !Array.isArray(body.orderedIds)) {
          return Response.json(
            { error: "groupId and orderedIds array are required" },
            { status: 400 },
          );
        }
        categoryService.reorderCategories(body.groupId, body.orderedIds);
        return Response.json({ ok: true });
      },
    },
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/api/budgets/\$budgetId/categories/
git commit -m "feat: add category CRUD, reorder, and move API endpoints"
```

---

## Chunk 4: React Query Hooks

### Task 10: Create budget grid hooks

**Files:**
- Create: `apps/web/src/lib/hooks/use-budget-grid.ts`

- [ ] **Step 1: Create budget grid hooks**

Create `apps/web/src/lib/hooks/use-budget-grid.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GridData } from "../services/budget-grid-service";

export function useBudgetGrid(budgetId: string, month: string) {
  return useQuery({
    queryKey: ["budget-grid", budgetId, month],
    queryFn: async () => {
      const res = await fetch(
        `/api/budgets/${budgetId}/grid?month=${month}`,
      );
      if (!res.ok) throw new Error("Failed to fetch grid data");
      return res.json() as Promise<GridData>;
    },
  });
}

export function useAssignMoney(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      month: string;
      amount: number;
    }) => {
      const res = await fetch(`/api/budgets/${budgetId}/grid/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to assign money");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}

export function useMoveMoney(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fromCategoryId: string;
      toCategoryId: string;
      month: string;
      amount: number;
    }) => {
      const res = await fetch(`/api/budgets/${budgetId}/grid/move-money`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to move money");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/hooks/use-budget-grid.ts
git commit -m "feat: add budget grid React Query hooks"
```

---

### Task 11: Create category hooks

**Files:**
- Create: `apps/web/src/lib/hooks/use-categories.ts`

- [ ] **Step 1: Create category hooks**

Create `apps/web/src/lib/hooks/use-categories.ts`:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateCategoryGroup(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const res = await fetch(
        `/api/budgets/${budgetId}/categories/groups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) throw new Error("Failed to create group");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}

export function useRenameCategoryGroup(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; name: string }) => {
      const res = await fetch(
        `/api/budgets/${budgetId}/categories/groups/${input.groupId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: input.name }),
        },
      );
      if (!res.ok) throw new Error("Failed to rename group");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}

export function useDeleteCategoryGroup(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const res = await fetch(
        `/api/budgets/${budgetId}/categories/groups/${groupId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete group");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}

export function useCreateCategory(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; name: string }) => {
      const res = await fetch(`/api/budgets/${budgetId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create category");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}

export function useRenameCategory(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { categoryId: string; name: string }) => {
      const res = await fetch(
        `/api/budgets/${budgetId}/categories/${input.categoryId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: input.name }),
        },
      );
      if (!res.ok) throw new Error("Failed to rename category");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}

export function useDeleteCategory(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (categoryId: string) => {
      const res = await fetch(
        `/api/budgets/${budgetId}/categories/${categoryId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete category");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}

export function useReorderGroups(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch(
        `/api/budgets/${budgetId}/categories/groups/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds }),
        },
      );
      if (!res.ok) throw new Error("Failed to reorder groups");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}

export function useReorderCategories(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      groupId: string;
      orderedIds: string[];
    }) => {
      const res = await fetch(
        `/api/budgets/${budgetId}/categories/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) throw new Error("Failed to reorder categories");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}

export function useMoveCategory(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      targetGroupId: string;
      sortOrder: number;
    }) => {
      const res = await fetch(
        `/api/budgets/${budgetId}/categories/${input.categoryId}/move`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetGroupId: input.targetGroupId,
            sortOrder: input.sortOrder,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to move category");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/hooks/use-categories.ts
git commit -m "feat: add category CRUD and reorder React Query hooks"
```

---

## Chunk 5: UI Components + Route Update

### Task 12: Create utility components (MonthNavigator, ReadyToAssign, GridHeader)

**Files:**
- Create: `apps/web/src/components/budget/month-navigator.tsx`
- Create: `apps/web/src/components/budget/ready-to-assign.tsx`
- Create: `apps/web/src/components/budget/grid-header.tsx`

- [ ] **Step 1: Create MonthNavigator**

Create `apps/web/src/components/budget/month-navigator.tsx`. This component:
- Receives `month` (YYYY-MM) and `onMonthChange` callback as props
- Displays formatted month name (e.g., "March 2026")
- Previous/next buttons using `ChevronLeft`/`ChevronRight` from lucide-react
- Computes prev/next month by parsing the YYYY-MM string, adjusting, and formatting back
- Uses `Button` variant="ghost" size="icon" for nav buttons

- [ ] **Step 2: Create ReadyToAssign**

Create `apps/web/src/components/budget/ready-to-assign.tsx`. This component:
- Receives `amount` (number, minor units), `currency` (string), and `onCoverOverspending` callback
- Uses `fromMinorUnits()` from `@/lib/currency` for display formatting
- Green background + text when `amount >= 0`
- Red background + text + warning message + "Cover Overspending" button when `amount < 0`
- Uses `Alert` component from shadcn/ui

- [ ] **Step 3: Create GridHeader**

Create `apps/web/src/components/budget/grid-header.tsx`. This component:
- Renders the column header row: Category | Assigned | Activity | Available
- Uses CSS grid matching the category rows: `grid-template-columns: 1fr 120px 120px 120px`
- Uppercase, small text, muted color for headers

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/budget/month-navigator.tsx apps/web/src/components/budget/ready-to-assign.tsx apps/web/src/components/budget/grid-header.tsx
git commit -m "feat: add month navigator, ready to assign banner, and grid header"
```

---

### Task 13: Create CategoryRow and CategoryGroupRow

**Files:**
- Create: `apps/web/src/components/budget/category-row.tsx`
- Create: `apps/web/src/components/budget/category-group-row.tsx`

- [ ] **Step 1: Create CategoryRow**

Create `apps/web/src/components/budget/category-row.tsx`. This component:
- Receives category data (`id`, `name`, `assigned`, `activity`, `available`), `currency`, `isSelected`, `onSelect`, `onRename` callbacks
- Uses `useSortable` from `@dnd-kit/sortable` for drag-and-drop
- Drag handle icon (`GripVertical` from lucide-react) on the left
- Category name (double-click enters inline rename mode with an input field)
- Three amount columns formatted with `fromMinorUnits()` + `Intl.NumberFormat` for currency display
- Available column color-coded: green (`text-green-600 dark:text-green-400`) for positive, red (`text-red-600 dark:text-red-400`) for negative, default for zero
- Click on row calls `onSelect(id)` — highlights with a subtle background
- CSS grid: `grid-template-columns: 1fr 120px 120px 120px` (matches GridHeader)
- Inline rename: on double-click, show `Input` pre-filled with name. Enter saves (calls `onRename`), Escape cancels, blur saves.

- [ ] **Step 2: Create CategoryGroupRow**

Create `apps/web/src/components/budget/category-group-row.tsx`. This component:
- Receives group data (`id`, `name`, `assigned`, `activity`, `available`, `isHidden`, `categories`), `currency`, `isCollapsed`, `onToggleCollapse`, `onRenameGroup`, `onAddCategory`, `selectedCategoryId`, `onSelectCategory`, `onRenameCategory` callbacks
- Uses `useSortable` from `@dnd-kit/sortable` for group reordering
- Drag handle, chevron toggle (`ChevronDown`/`ChevronRight`), group name (double-click to rename), aggregate amounts
- When expanded, renders child `CategoryRow` components inside a `SortableContext` for within-group reorder
- "Add Category" button (`Plus` icon) at bottom of expanded group — shows inline input on click
- Group header has a slightly different background (`bg-muted/50`)
- Hidden groups are dimmed (`opacity-50`)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/budget/category-row.tsx apps/web/src/components/budget/category-group-row.tsx
git commit -m "feat: add category row and group row components with drag-and-drop"
```

---

### Task 14: Create CategoryInspector, AssignPopover, MoveMoneyDialog

**Files:**
- Create: `apps/web/src/components/budget/category-inspector.tsx`
- Create: `apps/web/src/components/budget/assign-popover.tsx`
- Create: `apps/web/src/components/budget/move-money-dialog.tsx`

- [ ] **Step 1: Create AssignPopover**

Create `apps/web/src/components/budget/assign-popover.tsx`. This component:
- Uses shadcn `Popover` + `PopoverTrigger` + `PopoverContent`
- Contains a number input for the amount (in major units, e.g., user types "1800.00")
- "Save" button that calls `useAssignMoney` mutation with `toMinorUnits()` conversion
- Cancel button closes the popover
- Placeholder section for future quick-assign buttons (Sub-project 4)

- [ ] **Step 2: Create MoveMoneyDialog**

Create `apps/web/src/components/budget/move-money-dialog.tsx`. This component:
- Uses shadcn `Dialog` + `DialogContent` + `DialogHeader` + `DialogTitle`
- Source category `Select` dropdown (all categories from grid data)
- Target category `Select` dropdown
- Amount input (major units)
- "Move" button calls `useMoveMoney` mutation with `toMinorUnits()` conversion
- When `presetTarget` prop is provided, pre-selects the target category
- When `filterSource` prop is true, only shows categories with positive Available in source dropdown

- [ ] **Step 3: Create CategoryInspector**

Create `apps/web/src/components/budget/category-inspector.tsx`. This component:
- Receives selected category data, `currency`, `budgetId`, `month`, and grid data (for MoveMoneyDialog dropdowns)
- Displays category name as title
- Large-format display of Assigned, Activity, Available
- "Assign" button triggers `AssignPopover`
- "Move Money" button opens `MoveMoneyDialog`
- "Delete Category" button opens a confirmation `Dialog` with warning text about uncategorized transactions
- Placeholder section for target progress (text: "Targets coming in a future update")
- Fixed width: `w-72` (288px)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/budget/assign-popover.tsx apps/web/src/components/budget/move-money-dialog.tsx apps/web/src/components/budget/category-inspector.tsx
git commit -m "feat: add category inspector with assign popover and move money dialog"
```

---

### Task 15: Create BudgetGrid container

**Files:**
- Create: `apps/web/src/components/budget/budget-grid.tsx`

- [ ] **Step 1: Create BudgetGrid**

Create `apps/web/src/components/budget/budget-grid.tsx`. This component:
- Receives grid data (`GridData`), `budgetId`, `month`, `selectedCategoryId`, `onSelectCategory` props
- Wraps content in dnd-kit `DndContext` with `closestCenter` collision detection
- Two sortable contexts: one for groups (vertical list), and each group contains a sortable context for its categories
- `onDragEnd` handler determines if a group was reordered or a category was reordered/moved:
  - Check if the dragged item is a group ID → call `useReorderGroups`
  - Check if dragged item is a category → if same container, call `useReorderCategories`; if different container, call `useMoveCategory`
- Uses `DragOverlay` for visual feedback during drag
- Renders `GridHeader` at top
- Maps over groups to render `CategoryGroupRow` components
- "Add Group" button at bottom — inline input for new group name, calls `useCreateCategoryGroup`
- Manages `collapsedGroups` state as `Set<string>` (local state, not persisted)
- Uses `ScrollArea` from shadcn for scrollable grid content

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/budget/budget-grid.tsx
git commit -m "feat: add budget grid container with drag-and-drop context"
```

---

### Task 16: Update BudgetViewPage route

**Files:**
- Modify: `apps/web/src/routes/_authenticated/budgets/$budgetId.tsx`

- [ ] **Step 1: Replace placeholder with full budget view**

Replace the content of `apps/web/src/routes/_authenticated/budgets/$budgetId.tsx` with the full BudgetViewPage:
- Owns `month` state (default: current YYYY-MM computed from `new Date()`)
- Owns `selectedCategoryId` state (`string | null`, default: null)
- Calls `useBudgetGrid(budgetId, month)` hook
- Renders loading skeleton while `isLoading`
- Layout: flex row with main content + inspector
  - Main content (flex-1): `MonthNavigator` → `ReadyToAssign` → `BudgetGrid`
  - Inspector (fixed width, shown when category selected): `CategoryInspector`
- `MonthNavigator` receives `month` and `setMonth`
- `ReadyToAssign` receives `readyToAssign`, `currency`, and opens `MoveMoneyDialog` on cover overspending
- `BudgetGrid` receives grid data, budgetId, month, selectedCategoryId, onSelectCategory
- `CategoryInspector` receives selected category data (looked up from grid), budgetId, month, currency, full grid data

- [ ] **Step 2: Run all tests**

Run: `cd apps/web && bun --bun vitest run`
Expected: All tests pass

- [ ] **Step 3: Run lint**

Run: `cd /Users/pauldiloreto/Projects/openbudget && bun run lint`
Expected: No lint errors (fix any issues)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/budgets/\$budgetId.tsx
git commit -m "feat: replace budget view placeholder with full budget grid page"
```

---

### Task 17: Smoke test

- [ ] **Step 1: Start dev server**

Run: `cd /Users/pauldiloreto/Projects/openbudget && bun run dev:web`
Expected: Server starts on port 3000

- [ ] **Step 2: Manual verification**

Navigate to `http://localhost:3000`:
- Log in or register
- Create a budget (or use existing)
- Click into the budget → should see the budget grid (empty initially)
- Add a category group ("Housing")
- Add categories within the group ("Rent", "Utilities")
- Click a category → inspector should appear on the right
- Click "Assign" → popover should appear, enter an amount
- Verify the assigned amount shows in the grid
- Add another group, verify both appear
- Test month navigation (← →)
- Test drag-and-drop reorder of categories and groups
- Test "Move Money" dialog
- Test inline rename (double-click category name)
- Test delete category (confirmation dialog)

- [ ] **Step 3: Fix any issues found**

Address linting, runtime, or visual issues. Commit each fix separately.

- [ ] **Step 4: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during budget grid smoke testing"
```
