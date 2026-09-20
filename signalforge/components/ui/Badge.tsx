import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "good" | "info" | "warn" | "bad";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-2 border-line-strong",
  accent: "bg-accent-soft text-accent-ink border-[rgba(244,88,26,0.35)]",
  good: "bg-[rgba(47,191,113,0.12)] text-good-ink border-[rgba(47,191,113,0.35)]",
  info: "bg-[rgba(79,143,247,0.12)] text-info-ink border-[rgba(79,143,247,0.35)]",
  warn: "bg-[rgba(231,169,59,0.12)] text-warn-ink border-[rgba(231,169,59,0.35)]",
  bad: "bg-[rgba(229,72,77,0.12)] text-bad-ink border-[rgba(229,72,77,0.35)]",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[0.68rem] uppercase tracking-[0.08em] leading-5",
        tones[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
