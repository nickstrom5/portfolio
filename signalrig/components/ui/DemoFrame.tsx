import type { ReactNode } from "react";
import { Badge } from "./Badge";

/**
 * Frame around every demo: title bar, demo-data label, optional status slot.
 * Demos themselves stay self-contained so they can be lifted out later.
 */
export function DemoFrame({
  id,
  index,
  title,
  lede,
  status,
  children,
}: {
  id: string;
  index: number;
  title: string;
  lede: string;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-3">
            <span className="font-mono text-[0.72rem] text-ink-3">0{index}</span>
            <span className="demo-tag">Demo data</span>
          </div>
          <h3 id={`${id}-title`} className="h-section text-[1.55rem] md:text-[1.9rem]">
            {title}
          </h3>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{lede}</p>
        </div>
        {status && <div className="flex shrink-0 items-center gap-2">{status}</div>}
      </div>
      <div className="card overflow-hidden">{children}</div>
    </section>
  );
}

export function LiveBadge({ children }: { children: ReactNode }) {
  return (
    <Badge tone="accent">
      <span aria-hidden className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </Badge>
  );
}
