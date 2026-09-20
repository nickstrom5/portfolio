"use client";

import { useEffect, useRef, useState } from "react";

/** True when the user asked the OS for reduced motion. Timed demos become instant. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Advances `step` from 0 to `total` on a timer while `running`. Reduced motion
 * jumps straight to the end. Returns the current step and a reset.
 */
export function useSequence(total: number, running: boolean, intervalMs: number, onDone?: () => void) {
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!running) return;
    let i = 0;
    let id = 0;
    const delay = reduced ? 0 : intervalMs;
    const advance = () => {
      i = reduced ? total : i + 1;
      setStep(i);
      if (i >= total) {
        doneRef.current?.();
        return;
      }
      id = window.setTimeout(advance, delay);
    };
    id = window.setTimeout(advance, delay);
    return () => window.clearTimeout(id);
  }, [running, total, intervalMs, reduced]);

  return { step, reset: () => setStep(0) };
}

/** Which of the given section ids is currently most visible. Used by sticky nav. */
export function useActiveSection(ids: string[], rootMargin = "-40% 0px -55% 0px"): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin, threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids, rootMargin]);
  return active;
}

/** Animates a number toward `value`. Reduced motion snaps. */
export function useAnimatedNumber(value: number, durationMs = 500): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    if (reduced) return;
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (value - from) * eased;
      setDisplay(next);
      fromRef.current = next;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, reduced]);
  return reduced ? value : display;
}
