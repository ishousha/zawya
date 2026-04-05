import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, ChevronsUpDown, Check, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Venue {
  id: string;
  name: string;
  address: string | null;
}

interface VenueSelectorProps {
  value: string | null;
  onChange: (venueId: string | null, name: string, address: string) => void;
}

export default function VenueSelector({ value, onChange }: VenueSelectorProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Venue[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .insert({ name: newName, address: newAddress || null })
        .select()
        .single();
      if (error) throw error;
      return data as Venue;
    },
    onSuccess: (venue) => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      onChange(venue.id, venue.name, venue.address ?? "");
      setAddOpen(false);
      setNewName("");
      setNewAddress("");
      toast.success(`Venue "${venue.name}" created`);
    },
    onError: () => toast.error("Failed to create venue"),
  });

  const selected = venues.find((v) => v.id === value);
  const filtered = venues.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Label className="flex items-center gap-1.5 mb-1.5">
        <Building2 className="h-3.5 w-3.5 text-primary" />
        Venue
      </Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal h-10"
          >
            {selected ? selected.name : "Select venue…"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="p-2">
            <Input
              placeholder="Search venues…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length > 0 ? (
              filtered.map((venue) => (
                <button
                  key={venue.id}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left",
                    value === venue.id && "bg-accent"
                  )}
                  onClick={() => {
                    onChange(venue.id, venue.name, venue.address ?? "");
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === venue.id ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{venue.name}</p>
                    {venue.address && (
                      <p className="text-xs text-muted-foreground truncate">{venue.address}</p>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <p className="py-3 text-center text-sm text-muted-foreground">No venues found</p>
            )}
          </div>

          {/* Clear selection */}
          {value && (
            <button
              className="w-full border-t px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors text-left"
              onClick={() => {
                onChange(null, "", "");
                setOpen(false);
              }}
            >
              Clear selection
            </button>
          )}

          {/* Add new venue */}
          <button
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm font-medium text-primary hover:bg-accent transition-colors"
            onClick={() => {
              setOpen(false);
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add New Venue
          </button>
        </PopoverContent>
      </Popover>

      {/* Add Venue Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Venue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="venue-name">Venue Name</Label>
              <Input
                id="venue-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Br Aleem's House"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="venue-address">Address / Maps Link</Label>
              <Input
                id="venue-address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Full address or Google Maps link"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!newName.trim() || addMutation.isPending}
              className="w-full"
            >
              {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Venue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
