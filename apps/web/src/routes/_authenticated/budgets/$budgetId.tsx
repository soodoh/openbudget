import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthNavigator } from "@/components/budget/month-navigator";
import { ReadyToAssign } from "@/components/budget/ready-to-assign";
import { BudgetGrid } from "@/components/budget/budget-grid";
import { CategoryInspector } from "@/components/budget/category-inspector";
import { MoveMoneyDialog } from "@/components/budget/move-money-dialog";
import { useBudgetGrid } from "@/lib/hooks/use-budget-grid";
import { useDeleteCategory } from "@/lib/hooks/use-categories";
import type { GridGroup } from "@/lib/services/budget-grid-service";

export const Route = createFileRoute("/_authenticated/budgets/$budgetId")({
  component: BudgetViewPage,
});

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function BudgetViewPage(): React.ReactElement {
  const { budgetId }: { budgetId: string } = Route.useParams();
  const [month, setMonth] = useState(getCurrentMonth);
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >();
  const [moveMoneyOpen, setMoveMoneyOpen] = useState(false);

  const { data: gridData, isLoading } = useBudgetGrid(budgetId, month);
  const deleteCategory = useDeleteCategory(budgetId);

  if (isLoading || !gridData) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const groups: GridGroup[] = gridData.groups;
  const allCategories = groups.flatMap((g) => g.categories);
  const selectedCategory = selectedCategoryId
    ? allCategories.find((c) => c.id === selectedCategoryId)
    : undefined;

  function handleDeleteCategory(categoryId: string) {
    deleteCategory.mutate(categoryId);
    setSelectedCategoryId(undefined);
  }

  return (
    <div className="flex h-full gap-4 p-4">
      <div className="flex flex-1 flex-col gap-4">
        <MonthNavigator month={month} onMonthChange={setMonth} />

        <ReadyToAssign
          amount={gridData.readyToAssign}
          currency={gridData.currency}
          onCoverOverspending={() => setMoveMoneyOpen(true)}
        />

        <BudgetGrid
          gridData={gridData}
          budgetId={budgetId}
          month={month}
          selectedCategoryId={selectedCategoryId ?? null}
          onSelectCategory={setSelectedCategoryId}
        />
      </div>

      {selectedCategory && (
        <CategoryInspector
          category={selectedCategory}
          currency={gridData.currency}
          budgetId={budgetId}
          month={month}
          gridData={gridData}
          onDelete={handleDeleteCategory}
        />
      )}

      <MoveMoneyDialog
        budgetId={budgetId}
        month={month}
        gridData={gridData}
        open={moveMoneyOpen}
        onOpenChange={setMoveMoneyOpen}
      />
    </div>
  );
}
