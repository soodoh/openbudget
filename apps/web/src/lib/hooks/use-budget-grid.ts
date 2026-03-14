import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GridData } from "../services/budget-grid-service";

export function useBudgetGrid(budgetId: string, month: string) {
  return useQuery({
    queryKey: ["budget-grid", budgetId, month],
    queryFn: async () => {
      const res = await fetch(`/api/budgets/${budgetId}/grid?month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch grid data");
      return res.json() as Promise<GridData>;
    },
  });
}

export function useAssignMoney(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      month: string;
      amount: number;
    }) => {
      const res = await fetch(`/api/budgets/${budgetId}/grid/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to assign money");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}

export function useMoveMoney(budgetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fromCategoryId: string;
      toCategoryId: string;
      month: string;
      amount: number;
    }) => {
      const res = await fetch(`/api/budgets/${budgetId}/grid/move-money`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to move money");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["budget-grid", budgetId],
      });
    },
  });
}
