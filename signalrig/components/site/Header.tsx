"use client";

import { useEffect, useState } from "react";
import siteJson from "@/data/site.json";
import { Button } from "@/components/ui/Button";
import { Logo } from "./Logo";
import { cn } from "@/lib/cn";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled || open ? "border-line bg-[rgba(10,11,13,0.82)] backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2.5" aria-label="SignalRig, back to top">
          <Logo />
          <span className="font-display text-[1.05rem] font-semibold tracking-tight">{siteJson.name}</span>
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {siteJson.nav.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="rounded-[6px] px-3 py-1.5 text-[0.88rem] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:block">
          <Button size="sm" href={siteJson.cta.primary.href}>
            {siteJson.cta.primary.label}
          </Button>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-line text-ink-2 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            {open ? <path d="M3 3l12 12M15 3L3 15" /> : <path d="M2 4.5h14M2 9h14M2 13.5h14" />}
          </svg>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Primary mobile" className="wrap flex flex-col gap-1 border-t border-line py-3 md:hidden">
          {siteJson.nav.map((n) => (
            <a key={n.id} href={`#${n.id}`} onClick={() => setOpen(false)} className="rounded-[6px] px-3 py-2 text-[0.95rem] text-ink-2 hover:bg-surface-2 hover:text-ink">
              {n.label}
            </a>
          ))}
          <div className="mt-2 px-1">
            <Button href={siteJson.cta.primary.href} className="w-full">
              {siteJson.cta.primary.label}
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
