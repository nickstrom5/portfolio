"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import accountsJson from "@/data/accounts.json";
import { Badge } from "@/components/ui/Badge";
import { Segmented } from "@/components/ui/Segmented";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import { useAnimatedNumber, usePrefersReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { ago } from "@/lib/format";
import { FIT_SHARE, TIMING_SHARE, scoreAccount, type Account, type ScoredAccount, type SignalType } from "./model";

const data = accountsJson as { asOf: string; decayMonths: number; decayFactor: number; signalTypes: SignalType[]; accounts: Account[] };

type Mode = "fit" | "timing";

export function ScoringDemo() {
  const [mode, setMode] = useState<Mode>("timing");
  const [decay, setDecay] = useState(true);
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(data.signalTypes.map((t) => [t.id, t.weight])));
  const [selected, setSelected] = useState<string>("kestrel");
  const [tuning, setTuning] = useState(false);

  const scored = useMemo(() => {
    const list = data.accounts.map((a) =>
      scoreAccount(a, weights, { asOf: data.asOf, decay, decayMonths: data.decayMonths, decayFactor: data.decayFactor }),
    );
    return list.sort((a, b) => (mode === "fit" ? b.fit - a.fit : b.total - a.total));
  }, [weights, decay, mode]);

  const topFit = useMemo(() => [...scored].sort((a, b) => b.fit - a.fit)[0], [scored]);
  const topTiming = useMemo(() => [...scored].sort((a, b) => b.total - a.total)[0], [scored]);
  const current = scored.find((a) => a.id === selected) ?? scored[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="border-b border-line lg:border-r lg:border-b-0">
        <div className="flex flex-col gap-4 border-b border-line p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <Segmented
            label="Rank accounts by"
            value={mode}
            onChange={setMode}
            options={[
              { value: "fit", label: "Rank by fit" },
              { value: "timing", label: "Rank by timing score" },
            ]}
          />
          <Toggle id="decay-toggle" checked={decay} onChange={setDecay} label={`Signals older than ${data.decayMonths} months decay`} hint={`Weight × ${data.decayFactor}`} />
        </div>

        <RankedList accounts={scored} mode={mode} selected={current.id} onSelect={setSelected} />

        <div className="border-t border-line p-5 md:p-6">
          <button
            type="button"
            onClick={() => setTuning((t) => !t)}
            aria-expanded={tuning}
            className="text-[0.85rem] text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink"
          >
            {tuning ? "Hide weights" : "Tune signal weights"}
          </button>
          {tuning && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {data.signalTypes.map((t) => (
                <Slider
                  key={t.id}
                  id={`w-${t.id}`}
                  label={t.label}
                  value={weights[t.id]}
                  min={0}
                  max={40}
                  onChange={(v) => setWeights((w) => ({ ...w, [t.id]: v }))}
                  format={(v) => `${v} pts`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="border-b border-line p-5 md:p-6">
          <h4 className="mb-3 text-[0.8rem] font-medium uppercase tracking-[0.1em] text-ink-3">Why this rank</h4>
          <AccountDetail account={current} />
        </div>
        <div className="p-5 md:p-6">
          <h4 className="mb-3 text-[0.8rem] font-medium uppercase tracking-[0.1em] text-ink-3">The lesson</h4>
          <Lesson topFit={topFit} topTiming={topTiming} decay={decay} />
        </div>
      </div>
    </div>
  );
}

function RankedList({
  accounts,
  mode,
  selected,
  onSelect,
}: {
  accounts: ScoredAccount[];
  mode: Mode;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const prevRects = useRef(new Map<string, DOMRect>());

  // FLIP: measure previous positions, then animate rows to their new slot.
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    rowRefs.current.forEach((el, id) => next.set(id, el.getBoundingClientRect()));
    if (!reduced) {
      next.forEach((rect, id) => {
        const prev = prevRects.current.get(id);
        const el = rowRefs.current.get(id);
        if (!prev || !el) return;
        const dy = prev.top - rect.top;
        if (Math.abs(dy) < 1) return;
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], {
          duration: 450,
          easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
        });
      });
    }
    prevRects.current = next;
  }, [accounts, reduced]);

  return (
    <ol className="flex flex-col" aria-label="Ranked accounts">
      <li className="grid grid-cols-[1.25rem_minmax(0,1fr)_2.5rem_2.75rem_3.25rem] items-center gap-2 border-b border-line px-4 py-2 sm:grid-cols-[2rem_minmax(0,1fr)_4rem_4rem_4.5rem] sm:px-5 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-ink-3 md:px-6">
        <span>#</span>
        <span>Account</span>
        <span className="text-right">Fit</span>
        <span className="text-right">Timing</span>
        <span className="text-right">Total</span>
      </li>
      {accounts.map((a, i) => {
        const active = a.id === selected;
        return (
          <li
            key={a.id}
            ref={(el) => {
              if (el) rowRefs.current.set(a.id, el);
              else rowRefs.current.delete(a.id);
            }}
            className="border-b border-line last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onSelect(a.id)}
              aria-pressed={active}
              className={cn(
                "grid w-full grid-cols-[1.25rem_minmax(0,1fr)_2.5rem_2.75rem_3.25rem] items-center gap-2 px-4 py-3 text-left transition-colors sm:grid-cols-[2rem_minmax(0,1fr)_4rem_4rem_4.5rem] sm:px-5 md:px-6",
                active ? "bg-accent-soft" : "hover:bg-surface-2",
              )}
            >
              <span className="font-mono text-[0.75rem] text-ink-3 tabular">{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-[0.92rem] font-medium text-ink">{a.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  <span className="text-[0.72rem] text-ink-3">{a.segment}</span>
                  {a.signals.length > 0 && (
                    <span className="hidden font-mono text-[0.66rem] text-ink-3 sm:inline">
                      · {a.fresh} fresh{a.signals.length - a.fresh > 0 ? ` / ${a.signals.length - a.fresh} stale` : ""}
                    </span>
                  )}
                </span>
              </span>
              <ScoreCell value={a.fit} emphasis={mode === "fit"} />
              <ScoreCell value={a.timing} emphasis={mode === "timing"} />
              <ScoreCell value={a.total} emphasis={mode === "timing"} bar />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ScoreCell({ value, emphasis, bar }: { value: number; emphasis: boolean; bar?: boolean }) {
  const v = useAnimatedNumber(value);
  return (
    <span className="flex flex-col items-end gap-1">
      <span className={cn("num-swap font-mono text-[0.85rem] tabular", emphasis ? "text-ink" : "text-ink-3")}>{Math.round(v)}</span>
      {bar && (
        <span className="h-1 w-full rounded-full bg-surface-3" aria-hidden>
          <span className="bar-grow block h-1 rounded-full bg-accent" style={{ width: `${Math.max(2, v)}%` }} />
        </span>
      )}
    </span>
  );
}

function AccountDetail({ account }: { account: ScoredAccount }) {
  return (
    <div className="rise" key={account.id}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[1rem] font-medium text-ink">{account.name}</p>
          <p className="font-mono text-[0.72rem] text-ink-3">{account.domain}</p>
        </div>
        <p className="font-mono text-[0.75rem] text-ink-3 tabular">
          {FIT_SHARE * 100}% × fit {account.fit} + {TIMING_SHARE * 100}% × timing {Math.round(account.timing)} ={" "}
          <span className="text-ink">{Math.round(account.total)}</span>
        </p>
      </div>
      {account.scored.length === 0 ? (
        <div className="card-2 mt-4 p-4 text-[0.85rem] text-ink-2">
          No timing signals in the last two years. High fit, no reason to reach out this week. It stays in the watchlist; when a signal fires, it moves.
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {account.scored.map((s) => {
            const def = data.signalTypes.find((t) => t.id === s.type);
            return (
              <li key={`${s.type}-${s.date}`} className={cn("card-2 flex items-start gap-3 p-3", s.decayed && "opacity-70")}>
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: s.decayed ? "var(--neutral)" : "var(--accent)" }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[0.85rem] font-medium text-ink">{def?.label}</span>
                    <span className="font-mono text-[0.68rem] text-ink-3">{ago(s.date, data.asOf)}</span>
                    {s.decayed && <Badge tone="neutral">decayed</Badge>}
                  </div>
                  <p className="text-[0.8rem] text-ink-2">{s.detail}</p>
                  <p className="mt-1 text-[0.72rem] text-ink-3">{def?.why}</p>
                </div>
                <span className="font-mono text-[0.8rem] text-ink tabular">
                  +{s.contribution % 1 === 0 ? s.contribution : s.contribution.toFixed(2)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Lesson({ topFit, topTiming, decay }: { topFit: ScoredAccount; topTiming: ScoredAccount; decay: boolean }) {
  const same = topFit.id === topTiming.id;
  return (
    <div className="text-[0.88rem] leading-relaxed text-ink-2">
      {same ? (
        <p>
          With these weights, <span className="text-ink">{topTiming.name}</span> leads on both fit and timing. Nudge the weights or turn decay off and watch the fit-only leader
          overtake it: that is the moment a rep would have emailed the wrong account.
        </p>
      ) : (
        <>
          <p>
            <span className="text-ink">{topFit.name}</span> is the best fit on paper ({topFit.fit}/100) but has {topFit.fresh === 0 ? "no fresh signal" : `${topFit.fresh} fresh signal${topFit.fresh === 1 ? "" : "s"}`}. <span className="text-ink">{topTiming.name}</span> fits less well ({topTiming.fit}/100) but{" "}
            {topTiming.fresh} things changed there recently, so it outranks on total score.
          </p>
          <p className="mt-3">
            Fit tells you who could buy. Timing tells you who is buying this quarter. A rep working the fit-only list sends {topFit.name} a message nobody asked for.{" "}
            {decay ? "Decay keeps two-year-old funding rounds from pretending to be news." : "With decay off, two-year-old signals count as if they happened yesterday; turn it back on."}
          </p>
        </>
      )}
    </div>
  );
}
