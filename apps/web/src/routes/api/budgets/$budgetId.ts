import { createFileRoute } from "@tanstack/react-router";
import { db } from "../../../db";
import { requireBudgetAccess } from "../../../lib/auth-middleware";
import { BudgetService } from "../../../lib/services/budget-service";

const budgetService = new BudgetService(db);

export const Route = createFileRoute("/api/budgets/$budgetId")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				await requireBudgetAccess(request, params.budgetId);
				const budget = budgetService.getById(params.budgetId);
				if (!budget) {
					return Response.json({ error: "Not found" }, { status: 404 });
				}
				return Response.json(budget);
			},
			PATCH: async ({ request, params }) => {
				await requireBudgetAccess(request, params.budgetId, "editor");
				const body = (await request.json()) as { name?: string };
				budgetService.update(params.budgetId, body);
				const updated = budgetService.getById(params.budgetId);
				return Response.json(updated);
			},
			DELETE: async ({ request, params }) => {
				await requireBudgetAccess(request, params.budgetId, "owner");
				budgetService.delete(params.budgetId);
				return Response.json({ ok: true });
			},
		},
	},
});
