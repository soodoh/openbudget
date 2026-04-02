import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

// Re-export auth tables so drizzle can see everything
export { account, session, user, verification } from "./auth-schema";

// --- Budget & Membership ---

export const budget = sqliteTable("budget", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	currency: text("currency").notNull().default("USD"),
	createdBy: text("created_by")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull(),
});

export const budgetMember = sqliteTable(
	"budget_member",
	{
		id: text("id").primaryKey(),
		budgetId: text("budget_id")
			.notNull()
			.references(() => budget.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").notNull().default("viewer"),
		invitedAt: integer("invited_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("budget_member_budget_user_idx").on(
			table.budgetId,
			table.userId,
		),
		index("budget_member_userId_idx").on(table.userId),
	],
);

// --- Categories ---

export const categoryGroup = sqliteTable(
	"category_group",
	{
		id: text("id").primaryKey(),
		budgetId: text("budget_id")
			.notNull()
			.references(() => budget.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		isHidden: integer("is_hidden", { mode: "boolean" })
			.notNull()
			.default(false),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("category_group_budgetId_idx").on(table.budgetId)],
);

export const category = sqliteTable(
	"category",
	{
		id: text("id").primaryKey(),
		groupId: text("group_id")
			.notNull()
			.references(() => categoryGroup.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		isHidden: integer("is_hidden", { mode: "boolean" })
			.notNull()
			.default(false),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("category_groupId_idx").on(table.groupId)],
);

export const monthlyBudget = sqliteTable(
	"monthly_budget",
	{
		id: text("id").primaryKey(),
		categoryId: text("category_id")
			.notNull()
			.references(() => category.id, { onDelete: "cascade" }),
		month: text("month").notNull(),
		assigned: integer("assigned").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("monthly_budget_category_month_idx").on(
			table.categoryId,
			table.month,
		),
	],
);

// --- Accounts & Transactions ---

export const financialAccount = sqliteTable(
	"financial_account",
	{
		id: text("id").primaryKey(),
		budgetId: text("budget_id")
			.notNull()
			.references(() => budget.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		type: text("type").notNull(),
		onBudget: integer("on_budget", { mode: "boolean" }).notNull().default(true),
		closed: integer("closed", { mode: "boolean" }).notNull().default(false),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("financial_account_budgetId_idx").on(table.budgetId)],
);

export const payee = sqliteTable(
	"payee",
	{
		id: text("id").primaryKey(),
		budgetId: text("budget_id")
			.notNull()
			.references(() => budget.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		autoCategoryId: text("auto_category_id").references(() => category.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("payee_budgetId_idx").on(table.budgetId)],
);

export const transaction = sqliteTable(
	"transaction",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id")
			.notNull()
			.references(() => financialAccount.id, { onDelete: "cascade" }),
		date: text("date").notNull(),
		amount: integer("amount").notNull(),
		payeeId: text("payee_id").references(() => payee.id, {
			onDelete: "set null",
		}),
		categoryId: text("category_id").references(() => category.id, {
			onDelete: "set null",
		}),
		memo: text("memo"),
		cleared: integer("cleared", { mode: "boolean" }).notNull().default(false),
		reconciled: integer("reconciled", { mode: "boolean" })
			.notNull()
			.default(false),
		flagColor: text("flag_color"),
		transferTransactionId: text("transfer_transaction_id"),
		approved: integer("approved", { mode: "boolean" }).notNull().default(true),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("transaction_accountId_idx").on(table.accountId),
		index("transaction_date_idx").on(table.date),
		index("transaction_categoryId_idx").on(table.categoryId),
		index("transaction_payeeId_idx").on(table.payeeId),
	],
);

export const transactionSplit = sqliteTable(
	"transaction_split",
	{
		id: text("id").primaryKey(),
		transactionId: text("transaction_id")
			.notNull()
			.references(() => transaction.id, { onDelete: "cascade" }),
		categoryId: text("category_id").references(() => category.id, {
			onDelete: "set null",
		}),
		amount: integer("amount").notNull(),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("transaction_split_transactionId_idx").on(table.transactionId),
	],
);

export const scheduledTransaction = sqliteTable(
	"scheduled_transaction",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id")
			.notNull()
			.references(() => financialAccount.id, { onDelete: "cascade" }),
		frequency: text("frequency").notNull(),
		intervalDays: integer("interval_days"),
		nextDate: text("next_date").notNull(),
		endDate: text("end_date"),
		amount: integer("amount").notNull(),
		payeeId: text("payee_id").references(() => payee.id, {
			onDelete: "set null",
		}),
		categoryId: text("category_id").references(() => category.id, {
			onDelete: "set null",
		}),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("scheduled_transaction_accountId_idx").on(table.accountId)],
);

// --- Targets ---

export const target = sqliteTable(
	"target",
	{
		id: text("id").primaryKey(),
		categoryId: text("category_id")
			.notNull()
			.references(() => category.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		amount: integer("amount").notNull(),
		targetDate: text("target_date"),
		monthlyContribution: integer("monthly_contribution"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("target_categoryId_idx").on(table.categoryId)],
);

// --- Import ---

export const importMapping = sqliteTable(
	"import_mapping",
	{
		id: text("id").primaryKey(),
		budgetId: text("budget_id")
			.notNull()
			.references(() => budget.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		fileType: text("file_type").notNull(),
		columnMap: text("column_map", { mode: "json" })
			.$type<Record<string, string>>()
			.notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("import_mapping_budgetId_idx").on(table.budgetId)],
);
