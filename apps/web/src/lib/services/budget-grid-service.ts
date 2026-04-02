import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/schema";
import {
	budget,
	category,
	categoryGroup,
	financialAccount,
	monthlyBudget,
	transaction,
	transactionSplit,
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
		const budgetRow = this.db
			.select({ currency: budget.currency })
			.from(budget)
			.where(eq(budget.id, budgetId))
			.get();
		const currency = budgetRow?.currency ?? "USD";

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

				// Activity: direct transactions + split transactions, on-budget only
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

				// Available: cumulative assigned + cumulative activity
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

		// Ready to Assign: inflows - total assigned
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

		return { readyToAssign, currency, month, groups: gridGroups };
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
			const getOrCreate = (catId: string): { id: string; assigned: number } => {
				const existing = tx
					.select({
						id: monthlyBudget.id,
						assigned: monthlyBudget.assigned,
					})
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
