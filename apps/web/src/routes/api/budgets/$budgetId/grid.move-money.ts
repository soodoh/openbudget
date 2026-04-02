import { createFileRoute } from "@tanstack/react-router";
import { db } from "../../../../db";
import { requireBudgetAccess } from "../../../../lib/auth-middleware";
import { BudgetGridService } from "../../../../lib/services/budget-grid-service";

const gridService = new BudgetGridService(db);

export const Route = createFileRoute("/api/budgets/$budgetId/grid/move-money")({
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
