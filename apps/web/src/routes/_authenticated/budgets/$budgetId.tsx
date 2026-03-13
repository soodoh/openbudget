import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/budgets/$budgetId")({
  component: BudgetViewPage,
});

function BudgetViewPage(): React.ReactElement {
  const { budgetId } = Route.useParams();
  return (
    <div>
      <h2 className="text-2xl font-bold">Budget View</h2>
      <p className="text-muted-foreground">Budget ID: {budgetId}</p>
      <p className="text-muted-foreground">
        Budget grid will be built in Sub-project 2.
      </p>
    </div>
  );
}
