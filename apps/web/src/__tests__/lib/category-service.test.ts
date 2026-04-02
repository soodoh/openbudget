import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { generateId } from "@/lib/id";
import { CategoryService } from "@/lib/services/category-service";
import { createTestDb } from "../test-utils";

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
		expect(updated?.name).toBe("New Name");
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
		expect(updated?.name).toBe("New");
	});

	it("deletes a group and cascades to categories, monthly budgets, and SET NULLs transactions", () => {
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

		const txn = db
			.select()
			.from(schema.transaction)
			.where(eq(schema.transaction.id, txnId))
			.get();
		expect(txn).toBeDefined();
		expect(txn?.categoryId).toBeNull();

		const split = db
			.select()
			.from(schema.transactionSplit)
			.where(eq(schema.transactionSplit.id, splitId))
			.get();
		expect(split).toBeDefined();
		expect(split?.categoryId).toBeNull();
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

		const txn = db
			.select()
			.from(schema.transaction)
			.where(eq(schema.transaction.id, txnId))
			.get();
		expect(txn).toBeDefined();
		expect(txn?.categoryId).toBeNull();
	});

	it("reorders groups", () => {
		const g1 = service.createGroup(budgetId, { name: "A" });
		const g2 = service.createGroup(budgetId, { name: "B" });
		const g3 = service.createGroup(budgetId, { name: "C" });
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
		expect(updated?.groupId).toBe(g2.id);
		expect(updated?.sortOrder).toBe(0);
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
		expect(toggled?.isHidden).toBe(true);
		service.toggleGroupHidden(group.id);
		const unToggled = db
			.select()
			.from(schema.categoryGroup)
			.where(eq(schema.categoryGroup.id, group.id))
			.get();
		expect(unToggled?.isHidden).toBe(false);
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
		expect(toggled?.isHidden).toBe(true);
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
