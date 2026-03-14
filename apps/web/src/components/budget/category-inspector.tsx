import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { fromMinorUnits } from "@/lib/currency";
import { AssignPopover } from "./assign-popover";
import { MoveMoneyDialog } from "./move-money-dialog";
import type {
  GridCategory,
  GridData,
} from "@/lib/services/budget-grid-service";
import { cn } from "@/lib/utils";

interface CategoryInspectorProps {
  category: GridCategory;
  currency: string;
  budgetId: string;
  month: string;
  gridData: GridData;
  onDelete: (id: string) => void;
}

function formatCurrency(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(fromMinorUnits(minorUnits, currency));
}

function availableColor(amount: number): string {
  if (amount > 0) return "text-green-600 dark:text-green-400";
  if (amount < 0) return "text-red-600 dark:text-red-400";
  return "text-foreground";
}

export function CategoryInspector({
  category,
  currency,
  budgetId,
  month,
  gridData,
  onDelete,
}: CategoryInspectorProps) {
  const [moveMoneOpen, setMoveMoneyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="w-72 shrink-0 space-y-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="font-semibold">{category.name}</h3>
        <p className="text-xs text-muted-foreground">Category details</p>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Assigned</span>
          <span className="text-lg font-semibold tabular-nums">
            {formatCurrency(category.assigned, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Activity</span>
          <span className="text-lg font-semibold tabular-nums">
            {formatCurrency(category.activity, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Available</span>
          <span
            className={cn(
              "text-lg font-semibold tabular-nums",
              availableColor(category.available),
            )}
          >
            {formatCurrency(category.available, currency)}
          </span>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <AssignPopover
          categoryId={category.id}
          budgetId={budgetId}
          month={month}
          currency={currency}
          currentAssigned={category.assigned}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setMoveMoneyOpen(true)}
        >
          Move Money
        </Button>
      </div>

      <Separator />

      <div className="rounded-md bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">
          Targets coming in a future update
        </p>
      </div>

      <Separator />

      <Button
        variant="destructive"
        size="sm"
        className="w-full"
        onClick={() => setDeleteOpen(true)}
      >
        Delete Category
      </Button>

      <MoveMoneyDialog
        budgetId={budgetId}
        month={month}
        gridData={gridData}
        open={moveMoneOpen}
        onOpenChange={setMoveMoneyOpen}
        presetTarget={category.id}
        filterSource={true}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{category.name}&quot;?</DialogTitle>
            <DialogDescription>
              Deleting this category will leave any associated transactions
              uncategorized. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(category.id);
                setDeleteOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
