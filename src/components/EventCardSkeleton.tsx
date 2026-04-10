import { Skeleton } from "@/components/ui/skeleton";

export default function EventCardSkeleton() {
  return (
    <div className="animate-fade-in rounded-lg border border-border bg-card overflow-hidden">
      {/* Cover photo skeleton */}
      <Skeleton className="w-full h-40" />

      <div className="p-4 space-y-3">
        {/* Type badge */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        {/* Title */}
        <Skeleton className="h-6 w-3/4" />

        {/* Description */}
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {/* Date & time */}
        <div className="flex gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Action button */}
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    </div>
  );
}
