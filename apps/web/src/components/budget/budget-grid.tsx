import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GridHeader } from "./grid-header";
import { CategoryGroupRow } from "./category-group-row";
import { CategoryRow } from "./category-row";
import {
  useCreateCategoryGroup,
  useReorderGroups,
  useReorderCategories,
  useMoveCategory,
  useRenameCategory,
  useRenameCategoryGroup,
  useCreateCategory,
} from "@/lib/hooks/use-categories";
import type {
  GridData,
  GridCategory,
} from "@/lib/services/budget-grid-service";

interface BudgetGridProps {
  gridData: GridData;
  budgetId: string;
  month: string;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string) => void;
}

export function BudgetGrid({
  gridData,
  budgetId,
  month,
  selectedCategoryId,
  onSelectCategory,
}: BudgetGridProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [activeCategory, setActiveCategory] = useState<GridCategory | null>(
    null,
  );

  const createGroup = useCreateCategoryGroup(budgetId);
  const reorderGroups = useReorderGroups(budgetId);
  const reorderCategories = useReorderCategories(budgetId);
  const moveCategory = useMoveCategory(budgetId);
  const renameCategory = useRenameCategory(budgetId);
  const renameCategoryGroup = useRenameCategoryGroup(budgetId);
  const createCategory = useCreateCategory(budgetId);

  function toggleCollapse(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const allCategories: GridCategory[] = ([] as GridCategory[]).concat(
      ...gridData.groups.map((g) => g.categories),
    );
    const cat = allCategories.find((c) => c.id === active.id);
    setActiveCategory(cat ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCategory(null);

    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const groupIds = gridData.groups.map((g) => g.id);
    const isGroupReorder =
      groupIds.includes(activeId) && groupIds.includes(overId);

    if (isGroupReorder) {
      const oldIndex = groupIds.indexOf(activeId);
      const newIndex = groupIds.indexOf(overId);
      const reordered = [...groupIds];
      reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, activeId);
      reorderGroups.mutate(reordered);
      return;
    }

    const activeGroup = gridData.groups.find((g) =>
      g.categories.some((c) => c.id === activeId),
    );
    const overGroup = gridData.groups.find(
      (g) => g.id === overId || g.categories.some((c) => c.id === overId),
    );

    if (!activeGroup || !overGroup) return;

    if (activeGroup.id === overGroup.id) {
      const categoryIds = activeGroup.categories.map((c) => c.id);
      const oldIndex = categoryIds.indexOf(activeId);
      const newIndex = categoryIds.includes(overId)
        ? categoryIds.indexOf(overId)
        : categoryIds.length - 1;
      const reordered = [...categoryIds];
      reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, activeId);
      reorderCategories.mutate({
        groupId: activeGroup.id,
        orderedIds: reordered,
      });
    } else {
      const targetIndex = overGroup.categories.findIndex(
        (c) => c.id === overId,
      );
      const sortOrder =
        targetIndex >= 0 ? targetIndex : overGroup.categories.length;
      moveCategory.mutate({
        categoryId: activeId,
        targetGroupId: overGroup.id,
        sortOrder,
      });
    }
  }

  function handleAddGroup() {
    const trimmed = newGroupName.trim();
    if (trimmed) {
      createGroup.mutate({ name: trimmed });
    }
    setNewGroupName("");
    setIsAddingGroup(false);
  }

  function handleAddGroupKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleAddGroup();
    else if (e.key === "Escape") {
      setNewGroupName("");
      setIsAddingGroup(false);
    }
  }

  const groupIds = gridData.groups.map((g) => g.id);

  return (
    <div className="flex flex-col">
      <GridHeader />
      <ScrollArea className="flex-1">
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={groupIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 px-2 pb-4">
              {gridData.groups.map((group) => (
                <CategoryGroupRow
                  key={group.id}
                  group={group}
                  currency={gridData.currency}
                  isCollapsed={collapsedGroups.has(group.id)}
                  onToggleCollapse={toggleCollapse}
                  onRenameGroup={(id, name) =>
                    renameCategoryGroup.mutate({ groupId: id, name })
                  }
                  onAddCategory={(groupId, name) =>
                    createCategory.mutate({ groupId, name })
                  }
                  selectedCategoryId={selectedCategoryId}
                  onSelectCategory={onSelectCategory}
                  onRenameCategory={(id, name) =>
                    renameCategory.mutate({ categoryId: id, name })
                  }
                />
              ))}

              {isAddingGroup ? (
                <div className="rounded-md border border-dashed p-2">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onBlur={handleAddGroup}
                    onKeyDown={handleAddGroupKeyDown}
                    placeholder="Group name"
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => setIsAddingGroup(true)}
                >
                  <Plus className="size-4" />
                  Add Group
                </Button>
              )}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeCategory ? (
              <div className="rounded-md border bg-background shadow-lg opacity-90">
                <CategoryRow
                  category={activeCategory}
                  currency={gridData.currency}
                  isSelected={false}
                  onSelect={() => {}}
                  onRename={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
    </div>
  );
}
