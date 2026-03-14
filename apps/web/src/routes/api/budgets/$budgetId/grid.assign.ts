import { createFileRoute } from "@tanstack/react-router";
import { requireBudgetAccess } from "../../../../lib/auth-middleware";
import { BudgetGridService } from "../../../../lib/services/budget-grid-service";
import { db } from "../../../../db";

const gridService = new BudgetGridService(db);

export const Route = createFileRoute("/api/budgets/$budgetId/grid/assign")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        await requireBudgetAccess(request, params.budgetId, "editor");
        const body = (await request.json()) as {
          categoryId?: string;
          month?: string;
          amount?: number;
        };
        if (
          !body.categoryId ||
          !body.month ||
          typeof body.amount !== "number"
        ) {
          return Response.json(
            { error: "categoryId, month, and amount are required" },
            { status: 400 },
          );
        }
        gridService.assignMoney(body.categoryId, body.month, body.amount);
        return Response.json({ ok: true });
      },
    },
  },
});
