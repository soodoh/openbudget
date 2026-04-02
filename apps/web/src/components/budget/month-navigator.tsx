import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonthNavigatorProps {
	month: string;
	onMonthChange: (month: string) => void;
}

function formatMonth(month: string): string {
	const [year, monthNum] = month.split("-").map(Number);
	const date = new Date(year, monthNum - 1, 1);
	return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function adjustMonth(month: string, delta: number): string {
	const [year, monthNum] = month.split("-").map(Number);
	const date = new Date(year, monthNum - 1 + delta, 1);
	const newYear = date.getFullYear();
	const newMonth = String(date.getMonth() + 1).padStart(2, "0");
	return `${newYear}-${newMonth}`;
}

export function MonthNavigator({ month, onMonthChange }: MonthNavigatorProps) {
	return (
		<div className="flex items-center gap-2">
			<Button
				variant="ghost"
				size="icon"
				onClick={() => onMonthChange(adjustMonth(month, -1))}
				aria-label="Previous month"
			>
				<ChevronLeft />
			</Button>
			<span className="min-w-36 text-center font-medium">
				{formatMonth(month)}
			</span>
			<Button
				variant="ghost"
				size="icon"
				onClick={() => onMonthChange(adjustMonth(month, 1))}
				aria-label="Next month"
			>
				<ChevronRight />
			</Button>
		</div>
	);
}
