"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import repliesJson from "@/data/replies.json";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { minutesLabel } from "@/lib/format";

type Cls = "positive" | "nurture" | "ooo" | "negative";
type Reply = {
  id: string;
  from: string;
  company: string;
  segment: string;
  territory: string;
  subject: string;
  body: string;
  classification: Cls;
  confidence: number;
  intent: string;
  returnDate?: string;
  revisit?: string;
};
type Owner = { id: string; name: string; territory: string; segments: string[] };

const data = repliesJson as {
  channels: Record<Cls, string>;
  owners: Owner[];
  responseCurve: { note: string; points: { minutes: number; multiplier: number }[]; baseCloseRate: number };
  replies: Reply[];
};

const TONE: Record<Cls, "good" | "info" | "neutral" | "bad"> = { positive: "good", nurture: "info", ooo: "neutral", negative: "bad" };
const LABEL: Record<Cls, string> = { positive: "Positive", nurture: "Nurture", ooo: "Out of office", negative: "Negative" };

type Event = { t: number; type: string; payload: string; tone?: "good" | "info" | "neutral" | "bad" | "accent" };
type SlackMsg = { channel: string; owner: Owner; reply: Reply; action: string };

function ownerFor(r: Reply): Owner {
  return data.owners.find((o) => o.territory === r.territory) ?? data.owners.find((o) => o.segments.includes(r.segment)) ?? data.owners[0];
}

function crmAction(r: Reply): string {
  switch (r.classification) {
    case "positive":
      return r.intent === "meeting_request" ? "status=Working·Hot · task 'Reply within SLA' · sequence paused" : "status=Working·Warm · task 'Send one-pager' · sequence paused";
    case "nurture":
      return `status=Nurture · follow-up scheduled ${r.revisit} · sequence stopped`;
    case "ooo":
      return `sequence snoozed until ${r.returnDate} · no status change`;
    case "negative":
      return "status=Closed·Not interested · do-not-contact=true · sequence stopped";
  }
}

function slackText(r: Reply, o: Owner): string {
  switch (r.classification) {
    case "positive":
      return `@${o.name.split(" ")[0].toLowerCase()} positive reply from ${r.from} (${r.company}). ${r.intent === "meeting_request" ? "Wants times. Book it." : "Wants material. Send and propose a call."} SLA: 5 min.`;
    case "nurture":
      return `${r.from} at ${r.company} says later (${r.revisit}). Follow-up task created. No action now.`;
    case "ooo":
      return `Auto-reply from ${r.company}. Sequence resumes ${r.returnDate}.`;
    case "negative":
      return `${r.company} opted out. Suppressed across all sequences.`;
  }
}

export function RoutingDemo() {
  const reduced = usePrefersReducedMotion();
  const [processed, setProcessed] = useState<string[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [slack, setSlack] = useState<SlackMsg[]>([]);
  const [running, setRunning] = useState(false);
  const [channel, setChannel] = useState<Cls>("positive");
  const [ttfr, setTtfr] = useState(30);
  const queue = useRef<string[]>([]);
  const logRef = useRef<HTMLOListElement>(null);

  function processOne(id: string) {
    const r = data.replies.find((x) => x.id === id);
    if (!r) return;
    const o = ownerFor(r);
    const base = Date.now();
    const evs: Event[] = [
      { t: base, type: "reply.received", payload: `from=${r.from} · company=${r.company} · thread=${r.id}` },
      { t: base + 180, type: "reply.classified", payload: `label=${r.classification} · confidence=${r.confidence.toFixed(2)} · intent=${r.intent}`, tone: TONE[r.classification] },
      { t: base + 320, type: "crm.updated", payload: crmAction(r), tone: "info" },
      { t: base + 410, type: "slack.posted", payload: `channel=${data.channels[r.classification]} · owner=${o.name}`, tone: "accent" },
    ];
    setEvents((e) => [...e, ...evs]);
    setSlack((s) => [...s, { channel: data.channels[r.classification], owner: o, reply: r, action: slackText(r, o) }]);
    setProcessed((p) => [...p, id]);
  }

  function runAll() {
    const pending = data.replies.filter((r) => !processed.includes(r.id)).map((r) => r.id);
    if (!pending.length) return;
    if (reduced) {
      pending.forEach(processOne);
      return;
    }
    queue.current = pending;
    setRunning(true);
  }

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const next = queue.current.shift();
      if (next) processOne(next);
      if (!queue.current.length) {
        window.clearInterval(id);
        setRunning(false);
      }
    }, 650);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events]);

  function reset() {
    queue.current = [];
    setRunning(false);
    setProcessed([]);
    setEvents([]);
    setSlack([]);
  }

  const counts = useMemo(() => {
    const c: Record<Cls, number> = { positive: 0, nurture: 0, ooo: 0, negative: 0 };
    processed.forEach((id) => {
      const r = data.replies.find((x) => x.id === id);
      if (r) c[r.classification] += 1;
    });
    return c;
  }, [processed]);

  const remaining = data.replies.length - processed.length;
  const inChannel = slack.filter((m) => m.channel === data.channels[channel]);

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Inbox */}
        <div className="border-b border-line lg:border-r lg:border-b-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 md:px-6">
            <h4 className="whitespace-nowrap text-[0.8rem] font-medium uppercase tracking-[0.1em] text-ink-3">Inbound replies</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={reset} disabled={!processed.length && !running}>
                Reset
              </Button>
              <Button size="sm" onClick={runAll} disabled={running || remaining === 0}>
                {running ? "Processing…" : remaining === 0 ? "Inbox processed" : remaining === data.replies.length ? "Process inbox" : `Process ${remaining} left`}
              </Button>
            </div>
          </div>
          <ul className="scroll-thin max-h-[420px] overflow-y-auto" aria-label="Replies">
            {data.replies.map((r) => {
              const done = processed.includes(r.id);
              return (
                <li key={r.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => !done && !running && processOne(r.id)}
                    disabled={done || running}
                    className={cn("w-full px-5 py-3 text-left transition-colors md:px-6", done ? "bg-surface-2/40" : "hover:bg-surface-2")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-[0.88rem] font-medium", done ? "text-ink-2" : "text-ink")}>
                        {r.from} · {r.company}
                      </span>
                      {done ? <Badge tone={TONE[r.classification]}>{LABEL[r.classification]}</Badge> : <Badge tone="neutral">unread</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-[0.75rem] text-ink-3">{r.subject}</p>
                    <p className="mt-1 line-clamp-2 text-[0.8rem] text-ink-2">{r.body}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Event log */}
        <div className="border-b border-line lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3 md:px-6">
            <h4 className="text-[0.8rem] font-medium uppercase tracking-[0.1em] text-ink-3">Event log</h4>
            <span className="font-mono text-[0.7rem] text-ink-3 tabular">{events.length} events</span>
          </div>
          {events.length === 0 ? (
            <div className="flex h-[200px] flex-col items-center justify-center gap-1 px-6 text-center lg:h-[420px]">
              <p className="text-[0.85rem] text-ink-2">No events yet.</p>
              <p className="text-[0.75rem] text-ink-3">Process a reply and the webhook chain appears here.</p>
            </div>
          ) : (
            <ol ref={logRef} className="scroll-thin max-h-[420px] overflow-y-auto p-4 font-mono text-[0.74rem] leading-relaxed" aria-live="polite">
              {events.map((e, i) => (
                <li key={`${e.t}-${i}`} className="rise mb-2 grid grid-cols-1 gap-x-2 sm:grid-cols-[auto_minmax(0,1fr)]">
                  <span className={cn("whitespace-nowrap", toneText(e.tone))}>{e.type}</span>
                  <span className="break-words pl-3 text-ink-3 sm:pl-0">{e.payload}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Slack */}
        <div>
          <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-3 py-2" role="tablist" aria-label="Channels">
            {(Object.keys(data.channels) as Cls[]).map((c) => {
              const active = c === channel;
              return (
                <button
                  key={c}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setChannel(c)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 pointer-coarse:min-h-10 font-mono text-[0.74rem] whitespace-nowrap transition-colors",
                    active ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  {data.channels[c]}
                  {counts[c] > 0 && <span className="rounded-full bg-accent px-1.5 text-[0.7rem] text-[#0a0b0d] tabular">{counts[c]}</span>}
                </button>
              );
            })}
          </div>
          <div className="scroll-thin max-h-[420px] min-h-[200px] overflow-y-auto p-4 lg:min-h-[420px]" role="tabpanel">
            {inChannel.length === 0 ? (
              <p className="pt-6 text-center text-[0.8rem] text-ink-3">Nothing in {data.channels[channel]} yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {inChannel.map((m, i) => (
                  <li key={`${m.reply.id}-${i}`} className="rise flex gap-2.5">
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-accent font-display text-[0.7rem] font-bold text-[#0a0b0d]">
                      SR
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.8rem]">
                        <span className="font-medium text-ink">SignalRig</span>{" "}
                        <span className="font-mono text-[0.7rem] text-ink-3">bot · owner {m.owner.name} · {m.owner.territory}</span>
                      </p>
                      <p className="text-[0.82rem] text-ink-2">{m.action}</p>
                      <blockquote className="mt-1 border-l-2 border-line-strong pl-2 text-[0.76rem] text-ink-3 line-clamp-2">{m.reply.body}</blockquote>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ResponseTime ttfr={ttfr} setTtfr={setTtfr} positives={counts.positive} />
    </div>
  );
}

function toneText(t?: Event["tone"]): string {
  switch (t) {
    case "good":
      return "text-good-ink";
    case "info":
      return "text-info-ink";
    case "bad":
      return "text-bad-ink";
    case "accent":
      return "text-accent-ink";
    case "neutral":
      return "text-ink-2";
    default:
      return "text-ink";
  }
}

function multiplierFor(minutes: number): number {
  const pts = data.responseCurve.points;
  if (minutes <= pts[0].minutes) return pts[0].multiplier;
  for (let i = 1; i < pts.length; i++) {
    if (minutes <= pts[i].minutes) {
      const a = pts[i - 1];
      const b = pts[i];
      const p = (Math.log(minutes) - Math.log(a.minutes)) / (Math.log(b.minutes) - Math.log(a.minutes));
      return a.multiplier + (b.multiplier - a.multiplier) * p;
    }
  }
  return pts[pts.length - 1].multiplier;
}

const TTFR_STOPS = [5, 15, 30, 60, 120, 240, 480, 1440, 2880, 4320];

function ResponseTime({ ttfr, setTtfr, positives }: { ttfr: number; setTtfr: (v: number) => void; positives: number }) {
  const idx = TTFR_STOPS.indexOf(ttfr);
  const mult = multiplierFor(ttfr);
  const close = data.responseCurve.baseCloseRate * mult;
  const bestClose = data.responseCurve.baseCloseRate;
  const monthlyPositives = 40;
  const lostPerMonth = monthlyPositives * (bestClose - close);

  return (
    <div className="grid grid-cols-1 gap-6 border-t border-line p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:p-6">
      <div>
        <h4 className="mb-1 text-[0.8rem] font-medium uppercase tracking-[0.1em] text-ink-3">Time to first response</h4>
        <p className="mb-4 text-[0.85rem] text-ink-2">
          A positive reply is a hand raised. The routing above exists so a human answers in minutes, not the next morning. Drag to see what waiting costs.
        </p>
        <Slider
          id="ttfr"
          label="Minutes until a human replies to a positive"
          value={idx < 0 ? 2 : idx}
          min={0}
          max={TTFR_STOPS.length - 1}
          onChange={(i) => setTtfr(TTFR_STOPS[i])}
          format={(i) => minutesLabel(TTFR_STOPS[i])}
        />
        <p className="mt-3 text-[0.72rem] text-ink-3">{data.responseCurve.note}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card-2 p-4">
          <p className="text-[0.72rem] text-ink-3">Relative close probability</p>
          <p className={cn("num-swap mt-1 font-display text-[1.8rem] font-semibold leading-none tabular", mult > 0.8 ? "text-good-ink" : mult > 0.5 ? "text-warn-ink" : "text-bad-ink")}>
            {Math.round(mult * 100)}%
          </p>
          <p className="mt-1 text-[0.72rem] text-ink-3">of a 5-minute response</p>
        </div>
        <div className="card-2 p-4">
          <p className="text-[0.72rem] text-ink-3">Close rate on positives</p>
          <p className="num-swap mt-1 font-display text-[1.8rem] font-semibold leading-none text-ink tabular">{(close * 100).toFixed(1)}%</p>
          <p className="mt-1 text-[0.72rem] text-ink-3">base {(bestClose * 100).toFixed(0)}% at 5 min</p>
        </div>
        <div className="card-2 col-span-2 p-4">
          <p className="text-[0.72rem] text-ink-3">Deals lost per month at {monthlyPositives} positive replies</p>
          <p className="num-swap mt-1 font-display text-[1.8rem] font-semibold leading-none text-ink tabular">{lostPerMonth.toFixed(1)}</p>
          <p className="mt-1 text-[0.72rem] text-ink-3">
            {positives > 0 ? `You have routed ${positives} positive${positives === 1 ? "" : "s"} in this session. ` : ""}Each one waits {minutesLabel(ttfr)} at this setting.
          </p>
        </div>
      </div>
    </div>
  );
}
