"use client";

import { useMemo, useState, type FormEvent } from "react";
import companiesJson from "@/data/companies.json";
import icpJson from "@/data/icp.json";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton, SkeletonLines } from "@/components/ui/Skeleton";
import { Slider } from "@/components/ui/Slider";
import { useSequence } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { int } from "@/lib/format";
import type { CompanyRecord, CreditModel, Icp } from "./types";

const icp = icpJson as Icp;
const companies = companiesJson.companies as CompanyRecord[];
const unknown = companiesJson.unknown as CompanyRecord;
const credits = companiesJson.creditModel as CreditModel;

const STEPS = [
  { id: "source", label: "Broad source", note: "Firmographic lookup" },
  { id: "scrape", label: "Site scrape", note: "4 pages, summarised" },
  { id: "describe", label: "AI description", note: "From evidence only" },
  { id: "score", label: "ICP score", note: "Tests + disqualifiers" },
  { id: "threshold", label: "Threshold cut", note: `Qualify at ≥ ${icp.threshold}` },
  { id: "waterfall", label: "Email waterfall", note: "Only after qualify" },
] as const;

type StepState = "idle" | "running" | "done" | "skipped";

function normaliseDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

export function EnrichmentDemo() {
  const [input, setInput] = useState("kestrelhq.com");
  const [domain, setDomain] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runKey, setRunKey] = useState(0);

  const record = useMemo<CompanyRecord | null>(() => {
    if (!domain) return null;
    const found = companies.find((c) => c.domain === domain);
    return found ?? { ...unknown, domain, name: domain };
  }, [domain]);

  const qualified = !!record && record.icp.score >= icp.threshold;
  const { step, reset } = useSequence(STEPS.length, running, 750, () => setRunning(false));

  function stateOf(i: number): StepState {
    if (!domain) return "idle";
    if (i === 5 && step > 4 && !qualified) return "skipped";
    if (step > i) return "done";
    if (step === i && running) return "running";
    return "idle";
  }

  const finished = !!domain && !running && step >= STEPS.length;

  function submit(e: FormEvent) {
    e.preventDefault();
    const d = normaliseDomain(input);
    if (!d) return;
    reset();
    setDomain(d);
    setRunKey((k) => k + 1);
    setRunning(true);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Left: input + pipeline */}
      <div className="border-b border-line p-5 md:p-6 lg:border-r lg:border-b-0">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="enrich-domain" className="sr-only">
              Company domain
            </label>
            <input
              id="enrich-domain"
              list="enrich-domains"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="company domain, e.g. kestrelhq.com"
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full rounded-[var(--radius-ctl)] border border-line-strong bg-surface-2 px-3 font-mono text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
            <datalist id="enrich-domains">
              {companies.map((c) => (
                <option key={c.domain} value={c.domain} />
              ))}
            </datalist>
          </div>
          <Button type="submit" size="lg" disabled={running} className="sm:w-auto">
            {running ? "Running…" : "Run pipeline"}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {companies.map((c) => (
            <button
              key={c.domain}
              type="button"
              onClick={() => setInput(c.domain!)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[0.72rem] transition-colors pointer-coarse:min-h-9 pointer-coarse:px-3",
                input === c.domain ? "border-accent text-accent-ink" : "border-line text-ink-3 hover:text-ink-2 hover:border-line-strong",
              )}
            >
              {c.domain}
            </button>
          ))}
        </div>

        <ol className="mt-6 flex flex-col" aria-label="Pipeline steps" key={runKey}>
          {STEPS.map((s, i) => {
            const st = stateOf(i);
            const last = i === STEPS.length - 1;
            return (
              <li key={s.id} className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <StepDot state={st} index={i + 1} />
                  {!last && (
                    <div
                      className={cn(
                        "w-px flex-1 transition-colors duration-500",
                        st === "done" ? "bg-accent/60" : "bg-line-strong",
                      )}
                    />
                  )}
                </div>
                <div className={cn("min-w-0 flex-1", last ? "pb-1" : "pb-5")}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className={cn("text-[0.95rem] font-medium", st === "idle" ? "text-ink-3" : "text-ink")}>{s.label}</span>
                    <span className="font-mono text-[0.7rem] text-ink-3">{s.note}</span>
                    {st === "skipped" && <Badge tone="warn">skipped · 0 credits</Badge>}
                  </div>
                  <div className="mt-2">
                    <StepBody id={s.id} state={st} record={record} qualified={qualified} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Right: output + credit burn */}
      <div className="flex flex-col">
        <div className="border-b border-line p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[0.8rem] font-medium uppercase tracking-[0.1em] text-ink-3">Output record</h4>
            {finished && record && (
              <Badge tone={qualified ? "good" : "bad"} dot>
                {qualified ? "Qualified · contactable" : "Disqualified"}
              </Badge>
            )}
          </div>
          <RecordCard record={finished ? record : null} pending={!!domain && !finished} qualified={qualified} />
        </div>
        <CreditBurn />
      </div>
    </div>
  );
}

function StepDot({ state, index }: { state: StepState; index: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[0.7rem] transition-all duration-300",
        state === "done" && "border-accent bg-accent text-[#0a0b0d]",
        state === "running" && "border-accent bg-accent-soft text-accent-ink pulse-dot",
        state === "idle" && "border-line-strong bg-surface-2 text-ink-3",
        state === "skipped" && "border-warn/60 bg-surface-2 text-warn-ink",
      )}
    >
      {state === "done" ? "✓" : state === "skipped" ? "–" : index}
    </span>
  );
}

function StepBody({ id, state, record, qualified }: { id: string; state: StepState; record: CompanyRecord | null; qualified: boolean }) {
  if (state === "idle") return <p className="text-[0.82rem] text-ink-3">Waiting.</p>;
  if (state === "running") return <SkeletonLines lines={id === "score" ? 4 : 2} />;
  if (!record) return null;

  if (state === "skipped") {
    return (
      <p className="text-[0.85rem] text-ink-2">
        Score {record.icp.score} is below {icp.threshold}. No waterfall runs, no email credits are spent. The record is stored with its reason so it is not re-bought next month.
      </p>
    );
  }

  switch (id) {
    case "source":
      return (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.82rem] sm:grid-cols-3">
          <Field k="HQ" v={record.source.hq} />
          <Field k="Employees" v={record.source.employees ? int(record.source.employees) : "unknown"} />
          <Field k="Founded" v={record.source.founded ? String(record.source.founded) : "unknown"} />
          <Field k="Industry" v={record.source.industry} />
          <Field k="Last round" v={record.source.lastRound} className="col-span-2" />
        </dl>
      );
    case "scrape":
      return (
        <div className="text-[0.85rem] text-ink-2">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {record.scrape.pages.map((p) => (
              <code key={p} className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[0.7rem] text-ink-2">
                {p}
              </code>
            ))}
          </div>
          <p>{record.scrape.summary}</p>
        </div>
      );
    case "describe":
      return <p className="text-[0.85rem] text-ink-2 italic">“{record.description}”</p>;
    case "score":
      return (
        <div className="card-2 p-3">
          <div className="flex items-center gap-3">
            <ScoreRing score={record.icp.score} threshold={icp.threshold} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.85rem] text-ink">{record.icp.reason}</p>
            </div>
          </div>
          {record.icp.tests.length > 0 && (
            <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {record.icp.tests.map((t) => {
                const def = icp.tests.find((x) => x.id === t.id);
                return (
                  <li key={t.id} className="flex items-start gap-2 text-[0.78rem]">
                    <span className={cn("mt-[3px] h-2 w-2 shrink-0 rounded-full", t.pass ? "bg-good" : "bg-neutral")} aria-hidden />
                    <span className="text-ink-2">
                      <span className="text-ink">{def?.label.split(" (")[0]}</span>
                      <span className="text-ink-3"> · {t.evidence}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {record.icp.disqualifiers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {record.icp.disqualifiers.map((d) => (
                <Badge key={d} tone="bad">
                  ✕ {d}
                </Badge>
              ))}
            </div>
          )}
        </div>
      );
    case "threshold":
      return (
        <p className="text-[0.85rem] text-ink-2">
          {qualified ? (
            <>
              <span className="text-good-ink">Pass.</span> {record.icp.score} ≥ {icp.threshold}. Record proceeds to contact enrichment.
            </>
          ) : (
            <>
              <span className="text-bad-ink">Cut.</span> {record.icp.score} &lt; {icp.threshold}. Record is parked with its reason. Nothing downstream spends money on it.
            </>
          )}
        </p>
      );
    case "waterfall":
      return (
        <ol className="flex flex-col gap-1.5">
          {record.waterfall.map((hop, i) => (
            <li key={hop.provider} className="flex items-center gap-3 text-[0.82rem]">
              <span className="font-mono text-[0.7rem] text-ink-3">{i + 1}</span>
              <span className="text-ink">{hop.provider}</span>
              <span className="font-mono text-[0.7rem] text-ink-3">{hop.latencyMs} ms</span>
              {hop.result === "hit" ? (
                <Badge tone="good">hit · {Math.round((hop.confidence ?? 0) * 100)}%</Badge>
              ) : (
                <Badge tone="neutral">miss</Badge>
              )}
            </li>
          ))}
          <li className="mt-1 text-[0.78rem] text-ink-3">
            Waterfall stops at the first verified hit. {record.waterfall.length} provider{record.waterfall.length === 1 ? "" : "s"} called,{" "}
            {record.waterfall.length} credit{record.waterfall.length === 1 ? "" : "s"} spent.
          </li>
        </ol>
      );
    default:
      return null;
  }
}

function Field({ k, v, className }: { k: string; v: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[0.7rem] text-ink-3">{k}</dt>
      <dd className="truncate text-ink">{v}</dd>
    </div>
  );
}

function ScoreRing({ score, threshold }: { score: number; threshold: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pass = score >= threshold;
  return (
    <div className="relative h-14 w-14 shrink-0" role="img" aria-label={`ICP score ${score} of 100`}>
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={pass ? "var(--accent)" : "var(--neutral)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[1.05rem] font-semibold tabular">{score}</span>
    </div>
  );
}

function RecordCard({ record, pending, qualified }: { record: CompanyRecord | null; pending: boolean; qualified: boolean }) {
  if (pending) {
    return (
      <div className="card-2 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="mb-2 h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <SkeletonLines lines={3} className="mt-4" />
      </div>
    );
  }
  if (!record) {
    return (
      <div className="card-2 flex flex-col items-center justify-center gap-2 p-8 text-center">
        <span aria-hidden className="text-2xl">⌁</span>
        <p className="text-[0.85rem] text-ink-2">No record yet. Enter a domain and run the pipeline.</p>
        <p className="text-[0.75rem] text-ink-3">Try a qualified one and a disqualified one to see the waterfall gate.</p>
      </div>
    );
  }
  if (!qualified || !record.contact) {
    return (
      <div className="card-2 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={record.name ?? record.domain ?? "?"} muted />
          <div>
            <p className="text-[0.95rem] font-medium text-ink">{record.name ?? record.domain}</p>
            <p className="font-mono text-[0.72rem] text-ink-3">{record.domain}</p>
          </div>
        </div>
        <p className="mt-3 text-[0.85rem] text-ink-2">{record.icp.reason}</p>
        <p className="mt-2 text-[0.75rem] text-ink-3">Stored with score {record.icp.score}. No contact bought. Re-check in 90 days if a timing signal fires.</p>
      </div>
    );
  }
  const c = record.contact;
  return (
    <div className="card-2 rise p-4">
      <div className="flex items-center gap-3">
        <Avatar name={c.name} />
        <div className="min-w-0">
          <p className="truncate text-[0.95rem] font-medium text-ink">{c.name}</p>
          <p className="truncate text-[0.8rem] text-ink-2">
            {c.title} · {record.name}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.82rem]">
        <Field k="Email" v={c.email} className="col-span-2" />
        <Field k="Verification" v={c.verified ? "Verified deliverable" : "Unverified"} />
        <Field k="Persona" v={c.persona} />
        <Field k="ICP score" v={`${record.icp.score} / 100`} />
        <Field k="Segment" v={record.source.industry.split("·").pop()?.trim() ?? ""} />
      </dl>
      <div className="mt-4 rounded-[6px] border border-line bg-surface p-3">
        <p className="mb-1 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">Cited reason (goes to CRM)</p>
        <p className="text-[0.82rem] text-ink-2">{record.icp.reason}</p>
      </div>
    </div>
  );
}

function Avatar({ name, muted }: { name: string; muted?: boolean }) {
  const initials = name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-[0.85rem] font-semibold",
        muted ? "bg-surface-3 text-ink-3" : "bg-accent text-[#0a0b0d]",
      )}
    >
      {initials}
    </span>
  );
}

function CreditBurn() {
  const [batch, setBatch] = useState(credits.defaultBatch);
  const [rate, setRate] = useState(Math.round(credits.defaultQualifyRate * 100));

  const perRecordQualify = credits.sourceLookup + credits.scrapeAndClassify;
  const enrichFirst = batch * credits.waterfallAverage + batch * perRecordQualify;
  const qualifyFirst = batch * perRecordQualify + batch * (rate / 100) * credits.waterfallAverage;
  const saved = enrichFirst - qualifyFirst;
  const savedPct = saved / enrichFirst;
  const max = Math.max(enrichFirst, qualifyFirst);

  return (
    <div className="flex flex-1 flex-col p-5 md:p-6">
      <h4 className="mb-1 text-[0.8rem] font-medium uppercase tracking-[0.1em] text-ink-3">Credit burn</h4>
      <p className="mb-4 text-[0.85rem] text-ink-2">
        Same batch, two orders of operations. Email waterfalls cost roughly {credits.waterfallAverage} credits a record; a scrape and a small-model
        classification cost about {perRecordQualify.toFixed(2)}.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Slider id="burn-batch" label="Domains in batch" value={batch} min={200} max={10000} step={100} onChange={setBatch} format={int} />
        <Slider id="burn-rate" label="Qualify rate" value={rate} min={5} max={60} step={1} onChange={setRate} format={(v) => `${v}%`} />
      </div>
      <div className="mt-5 flex flex-col gap-3" role="img" aria-label={`Enrich then filter costs ${int(Math.round(enrichFirst))} credits. Qualify then enrich costs ${int(Math.round(qualifyFirst))} credits.`}>
        <BurnBar label="Enrich, then filter" value={enrichFirst} max={max} tone="muted" />
        <BurnBar label="Qualify, then enrich" value={qualifyFirst} max={max} tone="accent" />
      </div>
      <p className="mt-4 text-[0.85rem] text-ink-2">
        <span className="font-display text-[1.3rem] font-semibold text-accent-ink tabular">{Math.round(savedPct * 100)}%</span> fewer credits, or{" "}
        <span className="text-ink tabular">{int(Math.round(saved))}</span> credits saved on this batch. The saving is the disqualify rate; it grows with a stricter ICP.
      </p>
      <p className="mt-2 text-[0.72rem] text-ink-3">{credits.note}</p>
    </div>
  );
}

function BurnBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "muted" | "accent" }) {
  const w = Math.max(2, (value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[0.8rem]">
        <span className="text-ink-2">{label}</span>
        <span className="font-mono text-ink tabular">{int(Math.round(value))} cr</span>
      </div>
      <div className="h-5 w-full rounded-[4px] bg-surface-3">
        <div
          className={cn("bar-grow h-5 rounded-r-[4px]", tone === "accent" ? "bg-accent" : "bg-neutral")}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}
