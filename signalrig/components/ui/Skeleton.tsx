import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3" style={{ width: `${88 - i * 14}%` }} />
      ))}
    </div>
  );
}
