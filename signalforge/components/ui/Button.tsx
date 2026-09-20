import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-ctl)] font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-[#0a0b0d] hover:bg-[#ff6a2b] shadow-[0_0_0_1px_rgba(244,88,26,0.4),0_8px_24px_-8px_rgba(244,88,26,0.55)]",
  secondary: "bg-surface-2 text-ink border border-line-strong hover:border-[rgba(255,255,255,0.28)] hover:bg-surface-3",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8rem]",
  md: "h-10 px-4 text-[0.9rem]",
  lg: "h-12 px-5 text-[0.95rem]",
};

type Props = {
  variant?: Variant;
  size?: Size;
  href?: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"button">, "className" | "children">;

export function Button({ variant = "primary", size = "md", href, className, children, ...rest }: Props) {
  const cls = cn(base, variants[variant], sizes[size], className);
  if (href) {
    const external = href.startsWith("http") || href.startsWith("mailto:");
    return external ? (
      <a href={href} className={cls} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
        {children}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
