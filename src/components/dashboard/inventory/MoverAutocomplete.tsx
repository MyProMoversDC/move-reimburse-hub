import { useMemo, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export interface MoverOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface Props {
  movers: MoverOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabledIds?: string[];
  placeholder?: string;
}

const fullName = (m: MoverOption) => `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "(no name)";

const MoverAutocomplete = ({ movers, selectedIds, onChange, disabledIds = [], placeholder = "Type a mover's name..." }: Props) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const byId = useMemo(() => Object.fromEntries(movers.map(m => [m.id, m])), [movers]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movers
      .filter(m => !selectedIds.includes(m.id))
      .filter(m => !q || fullName(m).toLowerCase().includes(q))
      .slice(0, 25);
  }, [movers, selectedIds, query]);

  const add = (id: string) => {
    if (disabledIds.includes(id) || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
  };
  const remove = (id: string) => onChange(selectedIds.filter(x => x !== id));

  return (
    <div className="space-y-2">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map(id => {
            const m = byId[id];
            const locked = disabledIds.includes(id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {m ? fullName(m) : id.slice(0, 8)}
                {!locked && (
                  <button type="button" onClick={() => remove(id)} className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5" aria-label="Remove">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Command shouldFilter={false} className="border rounded-md overflow-visible">
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={(v) => { setQuery(v); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && (
            <CommandList className="max-h-56">
              {suggestions.length === 0 ? (
                <CommandEmpty>No movers found</CommandEmpty>
              ) : (
                <CommandGroup>
                  {suggestions.map(m => (
                    <CommandItem
                      key={m.id}
                      value={fullName(m)}
                      onMouseDown={(e) => e.preventDefault()}
                      onSelect={() => add(m.id)}
                    >
                      {fullName(m)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          )}
        </Command>
      </div>
    </div>
  );
};

export default MoverAutocomplete;
