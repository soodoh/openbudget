import { and, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/schema";
import { budget, budgetMember } from "../../db/schema";
import { generateId } from "../id";

type Db = BunSQLiteDatabase<typeof schema>;

export class BudgetService {
	private db: Db;
	constructor(db: Db) {
		this.db = db;
	}

	create(
		userId: string,
		input: { name: string; currency?: string },
	): typeof budget.$inferSelect {
		const id = generateId();
		const now = new Date();

		this.db.transaction((tx) => {
			tx.insert(budget)
				.values({
					id,
					name: input.name,
					currency: input.currency ?? "USD",
					createdBy: userId,
					createdAt: now,
					updatedAt: now,
				})
				.run();

			tx.insert(budgetMember)
				.values({
					id: generateId(),
					budgetId: id,
					userId,
					role: "owner",
					createdAt: now,
					updatedAt: now,
				})
				.run();
		});

		// biome-ignore lint/style/noNonNullAssertion: record was just inserted
		return this.getById(id)!;
	}

	listForUser(
		userId: string,
	): Array<typeof budget.$inferSelect & { role: string }> {
		return this.db
			.select({
				id: budget.id,
				name: budget.name,
				currency: budget.currency,
				createdBy: budget.createdBy,
				createdAt: budget.createdAt,
				updatedAt: budget.updatedAt,
				role: budgetMember.role,
			})
			.from(budget)
			.innerJoin(
				budgetMember,
				and(
					eq(budgetMember.budgetId, budget.id),
					eq(budgetMember.userId, userId),
				),
			)
			.all();
	}

	getById(budgetId: string): typeof budget.$inferSelect | undefined {
		return this.db.select().from(budget).where(eq(budget.id, budgetId)).get();
	}

	update(budgetId: string, input: { name?: string }): void {
		this.db.update(budget).set(input).where(eq(budget.id, budgetId)).run();
	}

	delete(budgetId: string): void {
		this.db.delete(budget).where(eq(budget.id, budgetId)).run();
	}
}
