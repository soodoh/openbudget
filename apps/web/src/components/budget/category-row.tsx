import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fromMinorUnits } from "@/lib/currency";
import type { GridCategory } from "@/lib/services/budget-grid-service";
import { cn } from "@/lib/utils";

interface CategoryRowProps {
  category: GridCategory;
  currency: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

function formatCurrency(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(fromMinorUnits(minorUnits, currency));
}

function availableColor(amount: number): string {
  if (amount > 0) return "text-green-600 dark:text-green-400";
  if (amount < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

export function CategoryRow({
  category,
  currency,
  isSelected,
  onSelect,
  onRename,
}: CategoryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(category.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridTemplateColumns: "1fr 90px 90px 90px",
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditValue(category.name);
    setIsEditing(true);
  }

  function commitRename() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== category.name) {
      onRename(category.id, trimmed);
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      commitRename();
    } else if (e.key === "Escape") {
      setEditValue(category.name);
      setIsEditing(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50",
        isSelected && "bg-muted",
        isDragging && "opacity-50",
        category.isHidden && "opacity-50",
      )}
      onClick={() => onSelect(category.id)}
    >
      <div className="flex min-w-0 items-center gap-1">
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="h-6 py-0 text-sm"
          />
        ) : (
          <span className="truncate text-sm" onDoubleClick={handleDoubleClick}>
            {category.name}
          </span>
        )}
      </div>
      <span className="text-right text-sm tabular-nums">
        {formatCurrency(category.assigned, currency)}
      </span>
      <span className="text-right text-sm tabular-nums text-muted-foreground">
        {formatCurrency(category.activity, currency)}
      </span>
      <span
        className={cn(
          "text-right text-sm tabular-nums font-medium",
          availableColor(category.available),
        )}
      >
        {formatCurrency(category.available, currency)}
      </span>
    </div>
  );
}
