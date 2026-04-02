import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBudgets, useCreateBudget } from "@/lib/hooks/use-budgets";

export const Route = createFileRoute("/_authenticated/")({
	component: DashboardPage,
});

function DashboardPage(): React.ReactElement {
	const { data: budgets, isLoading } = useBudgets();
	const createBudget = useCreateBudget();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [currency, setCurrency] = useState("USD");

	function handleCreate(e: React.SyntheticEvent<HTMLFormElement>): void {
		e.preventDefault();
		createBudget.mutate(
			{ name, currency },
			{
				onSuccess: () => {
					setOpen(false);
					setName("");
					setCurrency("USD");
				},
			},
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<p className="text-muted-foreground">Loading budgets...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold">Budgets</h2>
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger
						render={
							<Button>
								<Plus className="mr-2 size-4" />
								New Budget
							</Button>
						}
					/>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Create Budget</DialogTitle>
							<DialogDescription>
								Create a new budget to start tracking your spending.
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleCreate} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="budget-name">Budget Name</Label>
								<Input
									id="budget-name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="e.g., Personal Budget"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="budget-currency">Currency</Label>
								<Input
									id="budget-currency"
									value={currency}
									onChange={(e) => setCurrency(e.target.value.toUpperCase())}
									placeholder="USD"
									maxLength={3}
									required
								/>
							</div>
							<DialogFooter>
								<Button type="submit" disabled={createBudget.isPending}>
									{createBudget.isPending ? "Creating..." : "Create Budget"}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{budgets && budgets.length > 0 ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{budgets.map((budget) => (
						<Link
							key={budget.id}
							to="/budgets/$budgetId"
							params={{ budgetId: budget.id }}
							className="block"
						>
							<Card className="transition-colors hover:bg-muted/50">
								<CardHeader>
									<CardTitle>{budget.name}</CardTitle>
									<CardDescription>
										{budget.currency} · {budget.role}
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					))}
				</div>
			) : (
				<Card>
					<CardHeader className="text-center">
						<CardTitle>No budgets yet</CardTitle>
						<CardDescription>
							Create your first budget to get started with envelope budgeting.
						</CardDescription>
					</CardHeader>
				</Card>
			)}
		</div>
	);
}
