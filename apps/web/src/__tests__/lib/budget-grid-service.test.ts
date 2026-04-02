import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { generateId } from "@/lib/id";
import { BudgetGridService } from "@/lib/services/budget-grid-service";
import { CategoryService } from "@/lib/services/category-service";
import { createTestDb } from "../test-utils";

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
		gridService.assignMoney(cat.id, "2026-02", 180000);
		gridService.assignMoney(cat.id, "2026-03", 180000);
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
		const grid = gridService.getGridData(budgetId, "2026-03");
		expect(grid.groups[0].categories[0].available).toBe(180000);
	});

	it("computes Ready to Assign correctly (income - total assigned)", () => {
		const group = categoryService.createGroup(budgetId, { name: "Housing" });
		const cat = categoryService.createCategory(group.id, { name: "Rent" });
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
		gridService.assignMoney(cat.id, "2026-03", 180000);
		const grid = gridService.getGridData(budgetId, "2026-03");
		expect(grid.readyToAssign).toBe(320000);
	});

	it("Ready to Assign goes negative when over-assigned", () => {
		const group = categoryService.createGroup(budgetId, { name: "Housing" });
		const cat = categoryService.createCategory(group.id, { name: "Rent" });
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
		gridService.moveMoney(cat1.id, cat2.id, "2026-03", 50000);
		const grid = gridService.getGridData(budgetId, "2026-03");
		// biome-ignore lint/style/noNonNullAssertion: test data is known to exist
		const rent = grid.groups[0].categories.find((c) => c.name === "Rent")!;
		// biome-ignore lint/style/noNonNullAssertion: test data is known to exist
		const food = grid.groups[0].categories.find((c) => c.name === "Food")!;
		expect(rent.assigned).toBe(130000);
		expect(food.assigned).toBe(90000);
	});

	it("moveMoney with zero amount is a no-op", () => {
		const group = categoryService.createGroup(budgetId, { name: "Budget" });
		const cat1 = categoryService.createCategory(group.id, { name: "Rent" });
		const cat2 = categoryService.createCategory(group.id, { name: "Food" });
		gridService.assignMoney(cat1.id, "2026-03", 180000);
		gridService.moveMoney(cat1.id, cat2.id, "2026-03", 0);
		const grid = gridService.getGridData(budgetId, "2026-03");
		// biome-ignore lint/style/noNonNullAssertion: test data is known to exist
		const rent = grid.groups[0].categories.find((c) => c.name === "Rent")!;
		expect(rent.assigned).toBe(180000);
	});

	it("correctly handles split transactions (activity attributed to split categories)", () => {
		const group = categoryService.createGroup(budgetId, { name: "Budget" });
		const cat1 = categoryService.createCategory(group.id, {
			name: "Groceries",
		});
		const cat2 = categoryService.createCategory(group.id, {
			name: "Household",
		});
		const txId = generateId();
		db.insert(schema.transaction)
			.values({
				id: txId,
				accountId,
				date: "2026-03-15",
				amount: -10000,
				categoryId: null,
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
		// biome-ignore lint/style/noNonNullAssertion: test data is known to exist
		const groceries = grid.groups[0].categories.find(
			(c) => c.name === "Groceries",
		)!;
		// biome-ignore lint/style/noNonNullAssertion: test data is known to exist
		const household = grid.groups[0].categories.find(
			(c) => c.name === "Household",
		)!;
		expect(groceries.activity).toBe(-6000);
		expect(household.activity).toBe(-4000);
	});

	it("excludes off-budget account transactions from activity", () => {
		const group = categoryService.createGroup(budgetId, { name: "Budget" });
		const cat = categoryService.createCategory(group.id, { name: "Rent" });
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
		expect(grid.readyToAssign).toBe(500000);
	});
});
