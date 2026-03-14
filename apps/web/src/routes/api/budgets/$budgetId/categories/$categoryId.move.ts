import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../lib/services/category-service";
import { db } from "../../../../../db";

const categoryService = new CategoryService(db);

export const Route = createFileRoute(
  "/api/budgets/$budgetId/categories/$categoryId/move",
)({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as {
          targetGroupId?: string;
          sortOrder?: number;
        };
        if (!body.targetGroupId || typeof body.sortOrder !== "number") {
          return Response.json(
            { error: "targetGroupId and sortOrder are required" },
            { status: 400 },
          );
        }
        categoryService.moveCategory(
          params.categoryId,
          body.targetGroupId,
          body.sortOrder,
        );
        return Response.json({ ok: true });
      },
    },
  },
});
