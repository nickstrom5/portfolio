"use client";

import { cn } from "@/lib/cn";

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 select-none">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-200",
          checked ? "bg-accent border-accent" : "bg-surface-3 border-line-strong",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-ink transition-transform duration-200",
            checked ? "translate-x-5 bg-[#0a0b0d]" : "translate-x-0",
          )}
        />
      </button>
      <span className="flex flex-col">
        <span className="text-[0.9rem] font-medium text-ink">{label}</span>
        {hint && <span className="text-[0.8rem] text-ink-3">{hint}</span>}
      </span>
    </label>
  );
}
