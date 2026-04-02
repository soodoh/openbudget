import { createFileRoute } from "@tanstack/react-router";
import { db } from "../../../db";
import { requireSession } from "../../../lib/auth-middleware";
import { BudgetService } from "../../../lib/services/budget-service";

const budgetService = new BudgetService(db);

export const Route = createFileRoute("/api/budgets/")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const session = await requireSession(request);
				const budgets = budgetService.listForUser(session.user.id);
				return Response.json(budgets);
			},
			POST: async ({ request }) => {
				const session = await requireSession(request);
				const body = (await request.json()) as {
					name: string;
					currency?: string;
				};
				if (!body.name || typeof body.name !== "string") {
					return Response.json({ error: "Name is required" }, { status: 400 });
				}
				const budget = budgetService.create(session.user.id, {
					name: body.name,
					currency: body.currency,
				});
				return Response.json(budget, { status: 201 });
			},
		},
	},
});
