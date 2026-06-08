import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { COUNTRY_CODES, findByDialCode } from "@/lib/country-codes";

interface Props {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}

export function CountryCodeCombobox({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const selected = findByDialCode(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-[130px] shrink-0 justify-between px-3 min-h-[44px] font-normal",
            className,
          )}
        >
          <span className="truncate">
            {selected ? `${selected.flag} ${selected.code}` : value || "Select"}
          </span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            // itemValue is "country|+code|iso2" — match any substring
            return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search country or code…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {COUNTRY_CODES.map((c) => (
                <CommandItem
                  key={c.iso2}
                  value={`${c.country}|${c.code}|${c.iso2}`}
                  onSelect={() => {
                    onChange(c.code);
                    setOpen(false);
                  }}
                  className="min-h-[40px]"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === c.code && selected?.iso2 === c.iso2
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="mr-2 text-base">{c.flag}</span>
                  <span className="flex-1 truncate">{c.country}</span>
                  <span className="ml-2 text-muted-foreground">{c.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
