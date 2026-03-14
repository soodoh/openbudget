import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toMinorUnits } from "@/lib/currency";
import { useMoveMoney } from "@/lib/hooks/use-budget-grid";
import type {
  GridData,
  GridCategory,
} from "@/lib/services/budget-grid-service";

interface MoveMoneyDialogProps {
  budgetId: string;
  month: string;
  gridData: GridData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetTarget?: string;
  filterSource?: boolean;
}

export function MoveMoneyDialog({
  budgetId,
  month,
  gridData,
  open,
  onOpenChange,
  presetTarget,
  filterSource,
}: MoveMoneyDialogProps) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState(presetTarget ?? "");
  const [amount, setAmount] = useState("");
  const moveMoney = useMoveMoney(budgetId);

  useEffect(() => {
    if (open) {
      setToId(presetTarget ?? "");
      setFromId("");
      setAmount("");
    }
  }, [open, presetTarget]);

  const allCategories: GridCategory[] = ([] as GridCategory[]).concat(
    ...gridData.groups.map((g) => g.categories),
  );

  const sourceCategories = filterSource
    ? allCategories.filter((c) => c.available > 0)
    : allCategories;

  function handleMove() {
    const parsed = parseFloat(amount);
    if (!fromId || !toId || isNaN(parsed) || parsed <= 0) return;
    moveMoney.mutate(
      {
        fromCategoryId: fromId,
        toCategoryId: toId,
        month,
        amount: toMinorUnits(parsed, gridData.currency),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleMove();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Money</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select source category" />
              </SelectTrigger>
              <SelectContent>
                {sourceCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select target category" />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map((cat) => (
                  <SelectItem
                    key={cat.id}
                    value={cat.id}
                    disabled={cat.id === fromId}
                  >
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="move-amount">Amount ({gridData.currency})</Label>
            <Input
              id="move-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="0.00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={
              !fromId ||
              !toId ||
              !amount ||
              fromId === toId ||
              moveMoney.isPending
            }
          >
            {moveMoney.isPending ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
