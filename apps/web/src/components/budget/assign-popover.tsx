import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { fromMinorUnits, toMinorUnits } from "@/lib/currency";
import { useAssignMoney } from "@/lib/hooks/use-budget-grid";

interface AssignPopoverProps {
	categoryId: string;
	budgetId: string;
	month: string;
	currency: string;
	currentAssigned: number;
}

export function AssignPopover({
	categoryId,
	budgetId,
	month,
	currency,
	currentAssigned,
}: AssignPopoverProps) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState(
		fromMinorUnits(currentAssigned, currency).toFixed(2),
	);
	const assignMoney = useAssignMoney(budgetId);

	function handleSave() {
		const amount = Number.parseFloat(value);
		if (!Number.isNaN(amount)) {
			assignMoney.mutate(
				{ categoryId, month, amount: toMinorUnits(amount, currency) },
				{ onSuccess: () => setOpen(false) },
			);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") handleSave();
		else if (e.key === "Escape") setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button variant="outline" size="sm">
						Assign
					</Button>
				}
			/>
			<PopoverContent side="bottom" align="start">
				<div className="space-y-3">
					<div className="space-y-1.5">
						<Label htmlFor="assign-amount">Amount ({currency})</Label>
						<Input
							id="assign-amount"
							type="number"
							step="0.01"
							min="0"
							value={value}
							onChange={(e) => setValue(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="0.00"
							autoFocus
						/>
					</div>
					<p className="text-xs text-muted-foreground">
						Quick-assign options coming soon
					</p>
					<div className="flex gap-2">
						<Button
							size="sm"
							onClick={handleSave}
							disabled={assignMoney.isPending}
							className="flex-1"
						>
							{assignMoney.isPending ? "Saving..." : "Save"}
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => setOpen(false)}
							className="flex-1"
						>
							Cancel
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
