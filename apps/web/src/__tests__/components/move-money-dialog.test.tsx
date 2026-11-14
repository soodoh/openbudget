// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MoveMoneyDialog } from "@/components/budget/move-money-dialog";
import type { GridData } from "@/lib/services/budget-grid-service";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/lib/hooks/use-budget-grid", () => ({
	useMoveMoney: () => ({ mutate, isPending: false }),
}));

const gridData: GridData = {
	currency: "USD",
	month: "2026-11",
	readyToAssign: 0,
	groups: [
		{
			id: "group",
			name: "Essentials",
			sortOrder: 0,
			isHidden: false,
			assigned: 10000,
			activity: 0,
			available: 10000,
			categories: [
				{
					id: "groceries",
					name: "Groceries",
					sortOrder: 0,
					isHidden: false,
					assigned: 10000,
					activity: 0,
					available: 10000,
				},
				{
					id: "rent",
					name: "Rent",
					sortOrder: 1,
					isHidden: false,
					assigned: 0,
					activity: 0,
					available: 0,
				},
			],
		},
	],
};

afterEach(cleanup);
beforeEach(() => mutate.mockReset());

describe("MoveMoneyDialog dependency compatibility", () => {
	it("selects categories and submits minor units through the updated UI components", async () => {
		const onOpenChange = vi.fn();
		render(
			<MoveMoneyDialog
				budgetId="budget"
				month={gridData.month}
				gridData={gridData}
				open
				onOpenChange={onOpenChange}
			/>,
		);

		expect(screen.getByRole("dialog")).toBeVisible();
		expect(screen.getByRole("button", { name: "Move" })).toBeDisabled();
		fireEvent.click(screen.getAllByRole("combobox")[0]);
		fireEvent.click(await screen.findByRole("option", { name: "Groceries" }));
		fireEvent.click(screen.getAllByRole("combobox")[1]);
		expect(
			await screen.findByRole("option", { name: "Groceries" }),
		).toHaveAttribute("aria-disabled", "true");
		fireEvent.click(screen.getByRole("option", { name: "Rent" }));
		fireEvent.change(screen.getByLabelText("Amount (USD)"), {
			target: { value: "12.34" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Move" }));

		expect(mutate).toHaveBeenCalledWith(
			{
				fromCategoryId: "groceries",
				toCategoryId: "rent",
				month: gridData.month,
				amount: 1234,
			},
			expect.objectContaining({ onSuccess: expect.any(Function) }),
		);
		mutate.mock.calls[0][1].onSuccess();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("only offers funded sources when covering a preset target", async () => {
		render(
			<MoveMoneyDialog
				budgetId="budget"
				month={gridData.month}
				gridData={gridData}
				open
				presetTarget="rent"
				filterSource
				onOpenChange={vi.fn()}
			/>,
		);
		expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("Rent");
		fireEvent.click(screen.getAllByRole("combobox")[0]);
		expect(
			await screen.findByRole("option", { name: "Groceries" }),
		).toBeVisible();
		expect(
			screen.queryByRole("option", { name: "Rent" }),
		).not.toBeInTheDocument();
	});
});
