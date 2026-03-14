import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../../lib/services/category-service";
import { db } from "../../../../../../db";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
  "/api/budgets/$budgetId/categories/groups/",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as { name?: string };
        if (!body.name || typeof body.name !== "string") {
          return Response.json({ error: "name is required" }, { status: 400 });
        }
        const group = categoryService.createGroup(params.budgetId, {
          name: body.name,
        });
        return Response.json(group, { status: 201 });
      },
    },
  },
});
