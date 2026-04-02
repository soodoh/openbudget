import { and, asc, eq, max } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../../db/schema";
import { category, categoryGroup } from "../../db/schema";
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
		// biome-ignore lint/style/noNonNullAssertion: record was just inserted
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
		// biome-ignore lint/style/noNonNullAssertion: record was just inserted
		return this.db.select().from(category).where(eq(category.id, id)).get()!;
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
		this.db.delete(categoryGroup).where(eq(categoryGroup.id, groupId)).run();
	}

	deleteCategory(categoryId: string): void {
		this.db.delete(category).where(eq(category.id, categoryId)).run();
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
