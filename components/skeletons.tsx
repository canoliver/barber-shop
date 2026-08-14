'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('glass rounded-xl p-6 space-y-4', className)}>
      <Skeleton className="h-4 w-1/3 bg-muted/50" />
      <Skeleton className="h-8 w-2/3 bg-muted/50" />
      <Skeleton className="h-4 w-1/2 bg-muted/50" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 bg-muted/50" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-8 bg-muted/50" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-xl p-6 space-y-4">
          <Skeleton className="h-32 w-full bg-muted/50 rounded-lg" />
          <Skeleton className="h-4 w-3/4 bg-muted/50" />
          <Skeleton className="h-4 w-1/2 bg-muted/50" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-xl p-4 flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full bg-muted/50" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3 bg-muted/50" />
            <Skeleton className="h-3 w-1/2 bg-muted/50" />
          </div>
          <Skeleton className="h-8 w-20 bg-muted/50 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
