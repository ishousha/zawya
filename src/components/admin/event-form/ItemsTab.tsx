import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowUp, ArrowDown, PackagePlus, GripVertical } from "lucide-react";

export interface SignUpItem {
  id?: number; // existing DB id, undefined for new
  item_name: string;
  quantity_limit: number; // 0 = no limit
  order_index: number;
}

interface ItemsTabProps {
  items: SignUpItem[];
  onChange: (items: SignUpItem[]) => void;
}

export default function ItemsTab({ items, onChange }: ItemsTabProps) {
  const [newName, setNewName] = useState("");

  const addItem = () => {
    const name = newName.trim();
    if (!name) return;
    const next: SignUpItem = {
      item_name: name,
      quantity_limit: 0,
      order_index: items.length,
    };
    onChange([...items, next]);
    setNewName("");
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      order_index: i,
    }));
    onChange(updated);
  };

  const updateItem = (index: number, patch: Partial<SignUpItem>) => {
    const updated = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(updated);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const updated = [...items];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated.map((item, i) => ({ ...item, order_index: i })));
  };

  return (
    <div className="space-y-4 py-4">
      {/* Add new item */}
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Add Sign-Up Item</Label>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Arabic Coffee, Water Carton, Karak"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
          />
          <Button
            type="button"
            onClick={addItem}
            disabled={!newName.trim()}
            size="icon"
            className="h-10 w-10 shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Item list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <PackagePlus className="h-10 w-10 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            No items yet. Add items members can sign up to bring.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={`${item.id ?? "new"}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
            >
              {/* Reorder buttons — large tap targets */}
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-muted transition-colors active:scale-95"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-muted transition-colors active:scale-95"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              {/* Item name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.item_name}
                </p>
              </div>

              {/* Limit controls */}
              <div className="flex items-center gap-2 shrink-0">
                {item.quantity_limit === 0 ? (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">No limit</span>
                ) : (
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity_limit}
                    onChange={(e) =>
                      updateItem(index, {
                        quantity_limit: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="h-8 w-16 text-center text-xs"
                  />
                )}
                <Switch
                  checked={item.quantity_limit > 0}
                  onCheckedChange={(checked) =>
                    updateItem(index, { quantity_limit: checked ? 5 : 0 })
                  }
                  aria-label="Toggle limit"
                />
              </div>

              {/* Delete */}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
