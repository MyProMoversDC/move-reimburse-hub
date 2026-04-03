import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MentionUser {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface MentionDropdownProps {
  users: MentionUser[];
  filter: string;
  onSelect: (user: MentionUser) => void;
  selectedIndex: number;
  visible: boolean;
}

const MentionDropdown = ({ users, filter, onSelect, selectedIndex, visible }: MentionDropdownProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = users.filter(u => {
    const name = `${u.first_name} ${u.last_name}`.toLowerCase();
    return name.includes(filter.toLowerCase());
  });

  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
      <div className="bg-popover border rounded-lg shadow-lg max-h-[200px] overflow-hidden">
        <ScrollArea className="max-h-[200px]">
          <div ref={listRef} className="p-1">
            {filtered.map((user, i) => {
              const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase();
              return (
                <button
                  key={user.id}
                  data-selected={i === selectedIndex}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                    i === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(user);
                  }}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span>{user.first_name} {user.last_name}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default MentionDropdown;
export type { MentionUser };
