import { useState, useRef, useEffect } from "react";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fromMinorUnits } from "@/lib/currency";
import { CategoryRow } from "./category-row";
import type { GridGroup } from "@/lib/services/budget-grid-service";
import { cn } from "@/lib/utils";

interface CategoryGroupRowProps {
  group: GridGroup;
  currency: string;
  isCollapsed: boolean;
  onToggleCollapse: (id: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onAddCategory: (groupId: string, name: string) => void;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string) => void;
  onRenameCategory: (id: string, name: string) => void;
}

function formatCurrency(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(fromMinorUnits(minorUnits, currency));
}

export function CategoryGroupRow({
  group,
  currency,
  isCollapsed,
  onToggleCollapse,
  onRenameGroup,
  onAddCategory,
  selectedCategoryId,
  onSelectCategory,
  onRenameCategory,
}: CategoryGroupRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editValue, setEditValue] = useState(group.name);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (isAddingCategory && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAddingCategory]);

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditValue(group.name);
    setIsEditingName(true);
  }

  function commitGroupRename() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== group.name) {
      onRenameGroup(group.id, trimmed);
    }
    setIsEditingName(false);
  }

  function handleGroupKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      commitGroupRename();
    } else if (e.key === "Escape") {
      setEditValue(group.name);
      setIsEditingName(false);
    }
  }

  function commitAddCategory() {
    const trimmed = newCategoryName.trim();
    if (trimmed) {
      onAddCategory(group.id, trimmed);
    }
    setNewCategoryName("");
    setIsAddingCategory(false);
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      commitAddCategory();
    } else if (e.key === "Escape") {
      setNewCategoryName("");
      setIsAddingCategory(false);
    }
  }

  const categoryIds = group.categories.map((c) => c.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border border-border/50",
        isDragging && "opacity-50",
        group.isHidden && "opacity-50",
      )}
    >
      <div
        className="grid items-center gap-2 rounded-t-md bg-muted/50 px-2 py-2"
        style={{ gridTemplateColumns: "1fr 120px 120px 120px" }}
      >
        <div className="flex min-w-0 items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
            tabIndex={-1}
            aria-label="Drag to reorder group"
          >
            <GripVertical className="size-4" />
          </button>
          <button
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onToggleCollapse(group.id)}
            tabIndex={-1}
            aria-label={isCollapsed ? "Expand group" : "Collapse group"}
          >
            {isCollapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
          {isEditingName ? (
            <Input
              ref={nameInputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitGroupRename}
              onKeyDown={handleGroupKeyDown}
              className="h-6 py-0 text-sm font-semibold"
            />
          ) : (
            <span
              className="truncate text-sm font-semibold"
              onDoubleClick={handleDoubleClick}
            >
              {group.name}
            </span>
          )}
        </div>
        <span className="text-right text-sm tabular-nums font-medium">
          {formatCurrency(group.assigned, currency)}
        </span>
        <span className="text-right text-sm tabular-nums text-muted-foreground">
          {formatCurrency(group.activity, currency)}
        </span>
        <span className="text-right text-sm tabular-nums font-medium">
          {formatCurrency(group.available, currency)}
        </span>
      </div>

      {!isCollapsed && (
        <div className="px-2 pb-1 pt-0.5">
          <SortableContext
            items={categoryIds}
            strategy={verticalListSortingStrategy}
          >
            {group.categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                currency={currency}
                isSelected={selectedCategoryId === category.id}
                onSelect={onSelectCategory}
                onRename={onRenameCategory}
              />
            ))}
          </SortableContext>

          {isAddingCategory ? (
            <div className="flex items-center gap-2 px-2 py-1">
              <Input
                ref={addInputRef}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onBlur={commitAddCategory}
                onKeyDown={handleAddKeyDown}
                placeholder="Category name"
                className="h-7 text-sm"
              />
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="mt-0.5 h-7 w-full justify-start gap-1 text-xs text-muted-foreground"
              onClick={() => setIsAddingCategory(true)}
            >
              <Plus className="size-3" />
              Add Category
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
