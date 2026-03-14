import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../../lib/services/category-service";
import { db } from "../../../../../../db";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
  "/api/budgets/$budgetId/categories/groups/reorder",
)({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as { orderedIds?: string[] };
        if (!Array.isArray(body.orderedIds)) {
          return Response.json(
            { error: "orderedIds array is required" },
            { status: 400 },
          );
        }
        categoryService.reorderGroups(params.budgetId, body.orderedIds);
        return Response.json({ ok: true });
      },
    },
  },
});
