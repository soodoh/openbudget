import { createFileRoute } from "@tanstack/react-router";
import { db } from "../../../../db";
import { requireBudgetAccess } from "../../../../lib/auth-middleware";
import { BudgetGridService } from "../../../../lib/services/budget-grid-service";

const gridService = new BudgetGridService(db);

export const Route = createFileRoute("/api/budgets/$budgetId/grid")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				await requireBudgetAccess(request, params.budgetId);
				const url = new URL(request.url);
				const month = url.searchParams.get("month");
				if (!month || !/^\d{4}-\d{2}$/.test(month)) {
					return Response.json(
						{ error: "month query param required (YYYY-MM)" },
						{ status: 400 },
					);
				}
				const grid = gridService.getGridData(params.budgetId, month);
				return Response.json(grid);
			},
		},
	},
});
