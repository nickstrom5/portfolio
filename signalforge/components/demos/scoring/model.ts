import { monthsBetween } from "@/lib/format";

export type SignalType = { id: string; label: string; weight: number; why: string };
export type Signal = { type: string; detail: string; date: string };
export type Account = { id: string; name: string; domain: string; segment: string; fit: number; signals: Signal[] };

export type ScoredSignal = Signal & { ageMonths: number; decayed: boolean; weight: number; contribution: number };
export type ScoredAccount = Account & { timing: number; total: number; scored: ScoredSignal[]; fresh: number };

export const FIT_SHARE = 0.35;
export const TIMING_SHARE = 0.65;

export function scoreAccount(
  a: Account,
  weights: Record<string, number>,
  opts: { asOf: string; decay: boolean; decayMonths: number; decayFactor: number },
): ScoredAccount {
  const scored: ScoredSignal[] = a.signals.map((s) => {
    const ageMonths = monthsBetween(s.date, opts.asOf);
    const decayed = opts.decay && ageMonths > opts.decayMonths;
    const weight = weights[s.type] ?? 0;
    return { ...s, ageMonths, decayed, weight, contribution: decayed ? weight * opts.decayFactor : weight };
  });
  const timing = Math.min(100, scored.reduce((sum, s) => sum + s.contribution, 0));
  const total = FIT_SHARE * a.fit + TIMING_SHARE * timing;
  const fresh = scored.filter((s) => !s.decayed).length;
  return { ...a, timing, total, scored, fresh };
}
