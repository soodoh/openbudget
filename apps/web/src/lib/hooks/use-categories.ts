import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateCategoryGroup(budgetId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { name: string }) => {
			const res = await fetch(`/api/budgets/${budgetId}/categories/groups`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});
			if (!res.ok) throw new Error("Failed to create group");
			return res.json();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["budget-grid", budgetId],
			});
		},
	});
}

export function useRenameCategoryGroup(budgetId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { groupId: string; name: string }) => {
			const res = await fetch(
				`/api/budgets/${budgetId}/categories/groups/${input.groupId}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: input.name }),
				},
			);
			if (!res.ok) throw new Error("Failed to rename group");
			return res.json();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["budget-grid", budgetId],
			});
		},
	});
}

export function useDeleteCategoryGroup(budgetId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (groupId: string) => {
			const res = await fetch(
				`/api/budgets/${budgetId}/categories/groups/${groupId}`,
				{ method: "DELETE" },
			);
			if (!res.ok) throw new Error("Failed to delete group");
			return res.json();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["budget-grid", budgetId],
			});
		},
	});
}

export function useCreateCategory(budgetId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { groupId: string; name: string }) => {
			const res = await fetch(`/api/budgets/${budgetId}/categories`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});
			if (!res.ok) throw new Error("Failed to create category");
			return res.json();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["budget-grid", budgetId],
			});
		},
	});
}

export function useRenameCategory(budgetId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { categoryId: string; name: string }) => {
			const res = await fetch(
				`/api/budgets/${budgetId}/categories/${input.categoryId}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: input.name }),
				},
			);
			if (!res.ok) throw new Error("Failed to rename category");
			return res.json();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["budget-grid", budgetId],
			});
		},
	});
}

export function useDeleteCategory(budgetId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (categoryId: string) => {
			const res = await fetch(
				`/api/budgets/${budgetId}/categories/${categoryId}`,
				{ method: "DELETE" },
			);
			if (!res.ok) throw new Error("Failed to delete category");
			return res.json();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["budget-grid", budgetId],
			});
		},
	});
}

export function useReorderGroups(budgetId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (orderedIds: string[]) => {
			const res = await fetch(
				`/api/budgets/${budgetId}/categories/groups/reorder`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ orderedIds }),
				},
			);
			if (!res.ok) throw new Error("Failed to reorder groups");
			return res.json();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["budget-grid", budgetId],
			});
		},
	});
}

export function useReorderCategories(budgetId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { groupId: string; orderedIds: string[] }) => {
			const res = await fetch(`/api/budgets/${budgetId}/categories/reorder`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});
			if (!res.ok) throw new Error("Failed to reorder categories");
			return res.json();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["budget-grid", budgetId],
			});
		},
	});
}

export function useMoveCategory(budgetId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: {
			categoryId: string;
			targetGroupId: string;
			sortOrder: number;
		}) => {
			const res = await fetch(
				`/api/budgets/${budgetId}/categories/${input.categoryId}/move`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						targetGroupId: input.targetGroupId,
						sortOrder: input.sortOrder,
					}),
				},
			);
			if (!res.ok) throw new Error("Failed to move category");
			return res.json();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["budget-grid", budgetId],
			});
		},
	});
}
