import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { budgetMember } from "../db/schema";
import { auth } from "./auth";

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type BudgetRole = "owner" | "editor" | "viewer";

const ROLE_HIERARCHY: Record<BudgetRole, number> = {
	viewer: 0,
	editor: 1,
	owner: 2,
};

export function hasMinRole(userRole: BudgetRole, minRole: BudgetRole): boolean {
	return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export async function getSession(
	request: Request,
): Promise<Session | undefined> {
	const session = await auth.api.getSession({
		headers: request.headers,
	});
	return session ?? undefined;
}

export async function requireSession(request: Request): Promise<Session> {
	const session = await getSession(request);
	if (!session) {
		throw Response.json({ error: "Unauthorized" }, { status: 401 });
	}
	return session;
}

export async function requireBudgetAccess(
	request: Request,
	budgetId: string,
	minRole: BudgetRole = "viewer",
): Promise<Session & { budgetRole: BudgetRole }> {
	const session = await requireSession(request);

	const member = db
		.select({ role: budgetMember.role })
		.from(budgetMember)
		.where(
			and(
				eq(budgetMember.budgetId, budgetId),
				eq(budgetMember.userId, session.user.id),
			),
		)
		.get();

	if (!member || !hasMinRole(member.role as BudgetRole, minRole)) {
		throw Response.json({ error: "Forbidden" }, { status: 403 });
	}

	return { ...session, budgetRole: member.role as BudgetRole };
}
