import { createFileRoute } from "@tanstack/react-router";
import { db } from "../../../../../../db";
import { requireBudgetAccess } from "../../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../../lib/services/category-service";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
	"/api/budgets/$budgetId/categories/groups/$groupId",
)({
	server: {
		handlers: {
			PATCH: async ({ request, params }) => {
				await requireBudgetAccess(request, params.budgetId, "editor");
				const body = (await request.json()) as { name?: string };
				if (!body.name || typeof body.name !== "string") {
					return Response.json({ error: "name is required" }, { status: 400 });
				}
				categoryService.renameGroup(params.groupId, body.name);
				return Response.json({ ok: true });
			},
			DELETE: async ({ request, params }) => {
				await requireBudgetAccess(request, params.budgetId, "editor");
				categoryService.deleteGroup(params.groupId);
				return Response.json({ ok: true });
			},
		},
	},
});
