"use client";

import { useMemo, useState } from "react";
import reportingJson from "@/data/reporting.json";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { money, pct } from "@/lib/format";

type Cell = { segment: string; persona: string; sent: number; replies: number; interested: number; meetings: number; pipeline: number };
const data = reportingJson as { period: string; personas: string[]; segments: { id: string; label: string }[]; cells: Cell[] };

type Totals = { sent: number; replies: number; interested: number; meetings: number; pipeline: number };
type Metric = "reply" | "interested" | "meeting" | "pipeline";
type View = "aggregate" | "split";

const METRICS: { id: Metric; label: string; short: string }[] = [
  { id: "reply", label: "Reply rate", short: "replies" },
  { id: "interested", label: "Interested rate", short: "interested" },
  { id: "meeting", label: "Meeting rate", short: "meetings" },
  { id: "pipeline", label: "Pipeline", short: "pipeline" },
];

function value(c: { sent: number; replies: number; interested: number; meetings: number; pipeline: number }, m: Metric): number {
  switch (m) {
    case "reply":
      return c.sent ? c.replies / c.sent : 0;
    case "interested":
      return c.sent ? c.interested / c.sent : 0;
    case "meeting":
      return c.sent ? c.meetings / c.sent : 0;
    case "pipeline":
      return c.pipeline;
  }
}

function fmt(v: number, m: Metric): string {
  return m === "pipeline" ? money(v) : pct(v, m === "reply" ? 1 : 2);
}

const RAMP = ["var(--ramp-1)", "var(--ramp-2)", "var(--ramp-3)", "var(--ramp-4)", "var(--ramp-5)"];

export function ReportingDemo() {
  const [metric, setMetric] = useState<Metric>("reply");
  const [view, setView] = useState<View>("aggregate");

  const totals = useMemo(
    () => data.cells.reduce((t, c) => ({ sent: t.sent + c.sent, replies: t.replies + c.replies, interested: t.interested + c.interested, meetings: t.meetings + c.meetings, pipeline: t.pipeline + c.pipeline }), { sent: 0, replies: 0, interested: 0, meetings: 0, pipeline: 0 }),
    [],
  );
  const aggregate = value(totals, metric);

  const ranked = useMemo(
    () =>
      data.cells
        .map((c) => ({ ...c, v: value(c, metric), label: `${data.segments.find((s) => s.id === c.segment)?.label} · ${c.persona}` }))
        .sort((a, b) => b.v - a.v),
    [metric],
  );
  const max = ranked[0]?.v ?? 1;
  const min = ranked[ranked.length - 1]?.v ?? 0;

  const share = useMemo(() => {
    const key = metric === "pipeline" ? "pipeline" : metric === "meeting" ? "meetings" : metric === "interested" ? "interested" : "replies";
    const top2 = ranked.slice(0, 2).reduce((s, c) => s + c[key], 0);
    return totals[key] ? top2 / totals[key] : 0;
  }, [ranked, metric, totals]);

  const belowAggregate = ranked.filter((c) => c.v < aggregate).length;

  function bucket(v: number): number {
    if (max === min) return 2;
    return Math.min(4, Math.floor(((v - min) / (max - min)) * 5));
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-line p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex flex-wrap gap-2">
          <Segmented
            label="Metric"
            size="sm"
            value={metric}
            onChange={setMetric}
            options={METRICS.map((m) => ({ value: m.id, label: m.label }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[0.7rem] text-ink-3">{data.period}</span>
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "aggregate", label: "Aggregate" },
              { value: "split", label: "Split" },
            ]}
          />
        </div>
      </div>

      {view === "aggregate" ? (
        <AggregateView aggregate={aggregate} metric={metric} totals={totals} onSplit={() => setView("split")} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="border-b border-line p-5 md:p-6 lg:border-r lg:border-b-0">
            <h4 className="mb-1 text-[0.8rem] font-medium uppercase tracking-[0.1em] text-ink-3">Segment × persona</h4>
            <p className="mb-4 text-[0.8rem] text-ink-2">{METRICS.find((m) => m.id === metric)?.label}. Darker is lower; the two bright cells are the whole program.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-separate border-spacing-[2px] text-[0.78rem]">
                <caption className="sr-only">
                  {METRICS.find((m) => m.id === metric)?.label} by segment and persona
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="pb-1 text-left font-normal text-ink-3">Segment</th>
                    {data.personas.map((p) => (
                      <th key={p} scope="col" className="pb-1 text-right font-normal text-ink-3">
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.segments.map((s) => (
                    <tr key={s.id}>
                      <th scope="row" className="pr-2 text-left font-normal text-ink-2 whitespace-nowrap">
                        {s.label}
                      </th>
                      {data.personas.map((p) => {
                        const c = data.cells.find((x) => x.segment === s.id && x.persona === p)!;
                        const v = value(c, metric);
                        const b = bucket(v);
                        return (
                          <td
                            key={p}
                            className="rounded-[4px] px-2 py-2.5 text-right font-mono tabular transition-colors duration-300"
                            style={{ background: RAMP[b], color: b >= 3 ? "#0a0b0d" : "#f2f3f5" }}
                            title={`${s.label} · ${p}: ${fmt(v, metric)} (${c.sent} sent, ${c.replies} replies, ${c.meetings} meetings)`}
                          >
                            {fmt(v, metric)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[0.7rem] text-ink-3">
              <span>low</span>
              <span className="flex gap-[2px]" aria-hidden>
                {RAMP.map((r) => (
                  <span key={r} className="h-2.5 w-5 rounded-[2px]" style={{ background: r }} />
                ))}
              </span>
              <span>high</span>
            </div>
          </div>

          <div className="p-5 md:p-6">
            <h4 className="mb-1 text-[0.8rem] font-medium uppercase tracking-[0.1em] text-ink-3">Kill chart</h4>
            <p className="mb-4 text-[0.8rem] text-ink-2">
              Every cell against the aggregate. <span className="text-ink">{belowAggregate} of {ranked.length}</span> cells sit below the average that the aggregate view reports as the program&apos;s
              performance.
            </p>
            <KillChart ranked={ranked} aggregate={aggregate} metric={metric} max={max} />
            <p className="mt-4 text-[0.85rem] text-ink-2">
              The top two cells produce <span className="font-display text-[1.2rem] font-semibold text-accent-ink tabular">{Math.round(share * 100)}%</span> of all {METRICS.find((m) => m.id === metric)?.short}.
              Double the volume there and stop the other sixteen; the aggregate view could never tell you that.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AggregateView({ aggregate, metric, totals, onSplit }: { aggregate: number; metric: Metric; totals: Totals; onSplit: () => void }) {
  const label = METRICS.find((m) => m.id === metric)!;
  return (
    <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:p-6">
      <div>
        <p className="text-[0.75rem] text-ink-3">{label.label}, all segments and personas</p>
        <p className="num-swap mt-1 font-display text-[3.4rem] font-semibold leading-none tracking-tight text-ink tabular">{fmt(aggregate, metric)}</p>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-[0.8rem] sm:grid-cols-4">
          <div>
            <dt className="text-ink-3">Sent</dt>
            <dd className="font-mono text-ink tabular">{totals.sent.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Replies</dt>
            <dd className="font-mono text-ink tabular">{totals.replies}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Meetings</dt>
            <dd className="font-mono text-ink tabular">{totals.meetings}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Pipeline</dt>
            <dd className="font-mono text-ink tabular">{money(totals.pipeline)}</dd>
          </div>
        </dl>
      </div>
      <div className="card-2 flex flex-col justify-between gap-4 p-4">
        <p className="text-[0.88rem] leading-relaxed text-ink-2">
          This is the number in most weekly reports. It looks like a healthy program. It is actually two segment × persona pairs carrying sixteen that are losing money, and the
          aggregate cannot show you which.
        </p>
        <button type="button" onClick={onSplit} className="self-start text-[0.85rem] text-accent-ink underline underline-offset-4">
          Split it →
        </button>
      </div>
    </div>
  );
}

function KillChart({ ranked, aggregate, metric, max }: { ranked: (Cell & { v: number; label: string })[]; aggregate: number; metric: Metric; max: number }) {
  const aggX = (aggregate / max) * 100;
  return (
    <div className="relative" role="img" aria-label={`Bar chart of ${METRICS.find((m) => m.id === metric)?.label} per segment and persona, with the aggregate marked at ${fmt(aggregate, metric)}`}>
      <div className="absolute top-0 bottom-0 z-10 w-px border-l border-dashed border-ink-2" style={{ left: `calc(11rem + (100% - 11rem - 3.5rem) * ${aggX / 100})` }} aria-hidden>
        <span className="absolute -top-4 left-1 whitespace-nowrap font-mono text-[0.62rem] text-ink-2">aggregate {fmt(aggregate, metric)}</span>
      </div>
      <ul className="mt-4 flex flex-col gap-[6px]">
        {ranked.map((c, i) => {
          const w = (c.v / max) * 100;
          const above = c.v >= aggregate;
          return (
            <li key={`${c.segment}-${c.persona}`} className="grid grid-cols-[11rem_minmax(0,1fr)_3.5rem] items-center gap-2" title={`${c.label}: ${fmt(c.v, metric)}`}>
              <span className={cn("truncate text-[0.72rem]", i < 2 ? "text-ink" : "text-ink-3")}>{c.label}</span>
              <span className="h-[14px] w-full">
                <span
                  className="bar-grow block h-[14px] rounded-r-[4px]"
                  style={{ width: `${Math.max(1, w)}%`, background: i < 2 ? "var(--accent)" : above ? "var(--ramp-3)" : "var(--surface-3)" }}
                />
              </span>
              <span className={cn("text-right font-mono text-[0.7rem] tabular", i < 2 ? "text-ink" : "text-ink-3")}>{fmt(c.v, metric)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
