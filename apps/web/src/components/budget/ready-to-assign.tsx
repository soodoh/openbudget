import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { fromMinorUnits } from "@/lib/currency";

interface ReadyToAssignProps {
  amount: number;
  currency: string;
  onCoverOverspending: () => void;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function ReadyToAssign({
  amount,
  currency,
  onCoverOverspending,
}: ReadyToAssignProps) {
  const majorAmount = fromMinorUnits(amount, currency);
  const isNegative = amount < 0;

  if (isNegative) {
    return (
      <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50">
        <AlertTriangle className="text-red-600 dark:text-red-400" />
        <AlertTitle className="text-red-700 dark:text-red-300">
          Overspent by {formatCurrency(Math.abs(majorAmount), currency)}
        </AlertTitle>
        <AlertDescription className="text-red-600 dark:text-red-400">
          You have overspent your budget. Cover the overspending to balance your
          budget.
        </AlertDescription>
        <Button
          size="sm"
          variant="destructive"
          onClick={onCoverOverspending}
          className="mt-2"
        >
          Cover Overspending
        </Button>
      </Alert>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg bg-green-50 px-4 py-3 dark:bg-green-950/50">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-green-700 dark:text-green-400">
          Ready to Assign
        </p>
        <p className="text-2xl font-bold text-green-800 dark:text-green-300">
          {formatCurrency(majorAmount, currency)}
        </p>
      </div>
    </div>
  );
}
