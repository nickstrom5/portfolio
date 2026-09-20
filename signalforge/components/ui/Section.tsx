import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  className,
  wide,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn("scroll-mt-20 py-20 md:py-28", className)}>
      <div className="wrap">
        <div className={cn("mb-10 md:mb-14", wide ? "max-w-3xl" : "max-w-2xl")}>
          <p className="eyebrow mb-3">{eyebrow}</p>
          <h2 id={`${id}-heading`} className="h-section text-[2rem] md:text-[2.6rem]">
            {title}
          </h2>
          {lede && <div className="mt-4 text-[1.05rem] leading-relaxed text-ink-2">{lede}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}
