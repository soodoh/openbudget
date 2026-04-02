import { createFileRoute } from "@tanstack/react-router";
import { db } from "../../../../../db";
import { requireBudgetAccess } from "../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../lib/services/category-service";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
	"/api/budgets/$budgetId/categories/reorder",
)({
	server: {
		handlers: {
			PUT: async ({ request, params }) => {
				await requireBudgetAccess(request, params.budgetId, "editor");
				const body = (await request.json()) as {
					groupId?: string;
					orderedIds?: string[];
				};
				if (!body.groupId || !Array.isArray(body.orderedIds)) {
					return Response.json(
						{ error: "groupId and orderedIds array are required" },
						{ status: 400 },
					);
				}
				categoryService.reorderCategories(body.groupId, body.orderedIds);
				return Response.json({ ok: true });
			},
		},
	},
});
