import { cn } from "@/lib/cn";

export function Stat({
  label,
  value,
  note,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "default" | "accent" | "good" | "bad";
  className?: string;
}) {
  const color =
    tone === "accent" ? "text-accent-ink" : tone === "good" ? "text-good-ink" : tone === "bad" ? "text-bad-ink" : "text-ink";
  return (
    <div className={cn("card-2 flex flex-col gap-1 p-4", className)}>
      <span className="text-[0.75rem] text-ink-3">{label}</span>
      <span className={cn("num-swap font-display text-[1.6rem] font-semibold leading-none tracking-tight", color)}>{value}</span>
      {note && <span className="text-[0.75rem] text-ink-3">{note}</span>}
    </div>
  );
}
