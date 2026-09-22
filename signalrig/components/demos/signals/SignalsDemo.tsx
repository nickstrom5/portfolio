"use client";

import { useMemo, useState } from "react";
import signalsJson from "@/data/signals.json";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { ago, daysBetween } from "@/lib/format";

type FeedId = "ats" | "funding" | "exec" | "ads";
type Item = { account: string; domain: string; detail: string; date: string; meta: string; contentMatch: boolean };
type Feed = { id: FeedId; label: string; sources: string[]; items: Item[] };
type Rule = { id: string; feed: FeedId; label: string; short: string; weight: number; windowDays: number };

const data = signalsJson as {
  schedule: { cadence: string; time: string; lastRun: string; durationSec: number };
  rules: Rule[];
  feeds: Feed[];
};

const AS_OF = data.schedule.lastRun.slice(0, 10);

type Evaluated = Item & { feed: FeedId; rule: Rule; inWindow: boolean; fired: boolean; ageDays: number };

function evaluate(): Evaluated[] {
  return data.feeds.flatMap((f) => {
    const rule = data.rules.find((r) => r.feed === f.id)!;
    return f.items.map((it) => {
      const ageDays = daysBetween(it.date, AS_OF);
      const inWindow = ageDays <= rule.windowDays;
      return { ...it, feed: f.id, rule, inWindow, ageDays, fired: inWindow && it.contentMatch };
    });
  });
}

export function SignalsDemo() {
  const reduced = usePrefersReducedMotion();
  const [feed, setFeed] = useState<FeedId>("ats");
  const [scanning, setScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const items = useMemo(() => evaluate(), []);
  const fired = useMemo(() => {
    const byAccount = new Map<string, { account: string; domain: string; hits: Evaluated[]; score: number }>();
    items
      .filter((i) => i.fired)
      .forEach((i) => {
        const cur = byAccount.get(i.domain) ?? { account: i.account, domain: i.domain, hits: [], score: 0 };
        cur.hits.push(i);
        cur.score += i.rule.weight;
        byAccount.set(i.domain, cur);
      });
    return [...byAccount.values()].sort((a, b) => b.score - a.score);
  }, [items]);

  function scan() {
    if (reduced) {
      setScanCount((c) => c + 1);
      return;
    }
    setScanning(true);
    window.setTimeout(() => {
      setScanning(false);
      setScanCount((c) => c + 1);
    }, 1300);
  }

  const activeFeed = data.feeds.find((f) => f.id === feed)!;
  const feedItems = items.filter((i) => i.feed === feed).sort((a, b) => a.ageDays - b.ageDays);
  const visible = selectedAccount ? feedItems.filter((i) => i.domain === selectedAccount) : feedItems;

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-line p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" dot>
            {data.schedule.cadence}
          </Badge>
          <span className="font-mono text-[0.72rem] text-ink-3">
            {data.schedule.time} · last run {AS_OF} · {data.schedule.durationSec}s · {items.length} items checked
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={scan} disabled={scanning}>
          {scanning ? "Scanning feeds…" : scanCount ? "Run again" : "Run scan now"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="border-b border-line lg:border-r lg:border-b-0">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-3 py-2" role="tablist" aria-label="Feeds">
            {data.feeds.map((f) => {
              const active = f.id === feed;
              const n = items.filter((i) => i.feed === f.id && i.fired).length;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFeed(f.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 pointer-coarse:min-h-10 text-[0.82rem] whitespace-nowrap transition-colors",
                    active ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  {f.label}
                  <span className={cn("rounded-full px-1.5 font-mono text-[0.7rem] tabular", n ? "bg-accent text-[#0a0b0d]" : "bg-surface-3 text-ink-3")}>{n}</span>
                </button>
              );
            })}
          </div>
          <div className="px-5 pt-4 md:px-6">
            <p className="text-[0.8rem] text-ink-2">
              <span className="text-ink">Rule:</span> {data.rules.find((r) => r.feed === feed)?.label}. <span className="text-ink-3">Sources: {activeFeed.sources.join(", ")}.</span>
            </p>
            {selectedAccount && (
              <button type="button" onClick={() => setSelectedAccount(null)} className="mt-2 text-[0.78rem] text-accent-ink underline underline-offset-4">
                Showing {selectedAccount} only · clear
              </button>
            )}
          </div>
          <div role="tabpanel" aria-label={`${activeFeed.label} items`}>
          <ul className="p-5 md:p-6">
            {scanning
              ? Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="mb-2 flex items-center gap-3 rounded-[8px] border border-line p-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="mb-2 h-3 w-2/5" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </li>
                ))
              : visible.map((it, idx) => (
                  <li
                    key={`${it.domain}-${it.date}-${scanCount}`}
                    className={cn("rise mb-2 rounded-[8px] border p-3 last:mb-0", it.fired ? "border-accent/40 bg-accent-soft/40" : "border-line")}
                    style={{ animationDelay: reduced ? undefined : `${idx * 60}ms` }}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[0.88rem] font-medium text-ink">{it.account}</span>
                      <span className="font-mono text-[0.7rem] text-ink-3">{ago(it.date, AS_OF)}</span>
                      <span className="ml-auto flex gap-1">
                        <Badge tone={it.contentMatch ? "good" : "neutral"}>{it.contentMatch ? "content ✓" : "content ✕"}</Badge>
                        <Badge tone={it.inWindow ? "good" : "neutral"}>{it.inWindow ? `≤ ${it.rule.windowDays}d ✓` : `> ${it.rule.windowDays}d`}</Badge>
                        {it.fired && <Badge tone="accent">fired</Badge>}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.82rem] text-ink-2">{it.detail}</p>
                    <p className="mt-0.5 font-mono text-[0.7rem] text-ink-3">{it.meta}</p>
                  </li>
                ))}
            {!scanning && visible.length === 0 && <li className="text-[0.8rem] text-ink-3">Nothing from {selectedAccount} in this feed.</li>}
          </ul>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[0.8rem] font-medium uppercase tracking-[0.1em] text-ink-3">Accounts that fired</h4>
            <span className="font-mono text-[0.7rem] text-ink-3 tabular">{fired.length} accounts</span>
          </div>
          {scanning ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : (
            <ol className="flex flex-col gap-2">
              {fired.map((f, i) => (
                <li key={`${f.domain}-${scanCount}`} className="rise" style={{ animationDelay: reduced ? undefined : `${i * 70}ms` }}>
                  <button
                    type="button"
                    onClick={() => setSelectedAccount((s) => (s === f.domain ? null : f.domain))}
                    aria-pressed={selectedAccount === f.domain}
                    className={cn(
                      "card-2 w-full p-3 text-left transition-colors hover:border-line-strong",
                      selectedAccount === f.domain && "border-accent/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[0.9rem] font-medium text-ink">{f.account}</span>
                      <span className="font-mono text-[0.8rem] text-accent-ink tabular">+{f.score}</span>
                    </div>
                    <ul className="mt-1.5 flex flex-wrap gap-1">
                      {f.hits.map((h) => (
                        <li key={h.rule.id}>
                          <Badge tone="neutral">{h.rule.short}</Badge>
                        </li>
                      ))}
                    </ul>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 text-[0.78rem] text-ink-3">
            Each fired account is pushed to the scoring model with the rule id and date, so the timing score above updates before anyone writes a message. Accounts that fire two rules
            in the same week go to a human first.
          </p>
        </div>
      </div>
    </div>
  );
}
