import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../../lib/auth-middleware";
import { CategoryService } from "../../../../../lib/services/category-service";
import { db } from "../../../../../db";

const categoryService = new CategoryService(db);

export const Route = createFileRoute("/api/budgets/$budgetId/categories/")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as {
          groupId?: string;
          name?: string;
        };
        if (!body.groupId || !body.name || typeof body.name !== "string") {
          return Response.json(
            { error: "groupId and name are required" },
            { status: 400 },
          );
        }
        const cat = categoryService.createCategory(body.groupId, {
          name: body.name,
        });
        return Response.json(cat, { status: 201 });
      },
    },
  },
});
