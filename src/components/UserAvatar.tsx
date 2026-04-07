import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

// Deterministic color from name string
const COLORS = [
  "bg-emerald-600", "bg-blue-600", "bg-violet-600", "bg-amber-600",
  "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-orange-600",
];

function getColor(name?: string | null): string {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function UserAvatar({ name, avatarUrl, className, fallbackClassName }: UserAvatarProps) {
  return (
    <Avatar className={cn("h-10 w-10", className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name || "User"} />}
      <AvatarFallback className={cn("text-white font-semibold text-sm", getColor(name), fallbackClassName)}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
