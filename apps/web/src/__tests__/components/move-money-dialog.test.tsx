import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
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

beforeEach(() => mutate.mockReset());

describe("MoveMoneyDialog dependency compatibility", () => {
	it("selects categories and submits minor units through the updated UI components", async () => {
		const onOpenChange = vi.fn();
		await render(
			<MoveMoneyDialog
				budgetId="budget"
				month={gridData.month}
				gridData={gridData}
				open
				onOpenChange={onOpenChange}
			/>,
		);

		await expect.element(page.getByRole("dialog")).toBeVisible();
		await expect
			.element(page.getByRole("button", { name: "Move", exact: true }))
			.toBeDisabled();
		await page.getByRole("combobox").nth(0).click();
		await page.getByRole("option", { name: "Groceries", exact: true }).click();
		await page.getByRole("combobox").nth(1).click();
		await expect
			.element(page.getByRole("option", { name: "Groceries", exact: true }))
			.toHaveAttribute("aria-disabled", "true");
		await page.getByRole("option", { name: "Rent", exact: true }).click();
		await page.getByLabelText("Amount (USD)").fill("12.34");
		await page.getByRole("button", { name: "Move", exact: true }).click();

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
		await render(
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
		await expect
			.element(page.getByRole("combobox").nth(1))
			.toMatchTextContent("Rent");
		await page.getByRole("combobox").nth(0).click();
		await expect
			.element(page.getByRole("option", { name: "Groceries", exact: true }))
			.toBeVisible();
		await expect
			.element(page.getByRole("option", { name: "Rent", exact: true }))
			.not.toBeInTheDocument();
	});
});
