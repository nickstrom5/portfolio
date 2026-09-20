"use client";

import { useState } from "react";
import promptsJson from "@/data/prompts.json";
import { Section } from "@/components/ui/Section";
import { Segmented } from "@/components/ui/Segmented";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type Side = "bad" | "good";

export function PromptLab() {
  const [side, setSide] = useState<Side>("good");
  const p = promptsJson[side];

  return (
    <Section
      id="prompt-lab"
      eyebrow="Prompt lab"
      title="How we write prompts that hold at volume."
      lede="A prompt that works on ten companies is a demo. A prompt that gives the same answer on ten thousand, cites its evidence and refuses to invent is a system. The difference is mostly discipline."
      wide
    >
      {/* Bad vs good */}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="md:hidden">
            <Segmented
              label="Prompt version"
              value={side}
              onChange={setSide}
              options={[
                { value: "bad", label: "Vague" },
                { value: "good", label: "Holds at volume" },
              ]}
            />
          </div>
          <p className="text-[0.85rem] text-ink-2">Same task: score a company against an ICP.</p>
          <Badge tone="neutral">ICP scoring prompt</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2">
          {(["bad", "good"] as Side[]).map((s) => {
            const pr = promptsJson[s];
            const good = s === "good";
            return (
              <div key={s} className={cn("flex flex-col", s !== side && "hidden md:flex", good ? "" : "border-b border-line md:border-r md:border-b-0")}>
                <div className="flex items-center gap-2 border-b border-line px-5 py-3">
                  <Badge tone={good ? "good" : "bad"} dot>
                    {pr.title}
                  </Badge>
                  <span className="text-[0.78rem] text-ink-3">{pr.verdict}</span>
                </div>
                <pre className="code scroll-thin max-h-[420px] overflow-auto px-5 py-4 text-ink-2" tabIndex={0} aria-label={`${pr.title} prompt text`}>{pr.text}</pre>
                <ul className="flex flex-col gap-1.5 border-t border-line px-5 py-4">
                  {(good ? promptsJson.good.wins : promptsJson.bad.problems).map((line) => (
                    <li key={line} className="flex gap-2 text-[0.82rem] text-ink-2">
                      <span className={good ? "text-good-ink" : "text-bad-ink"} aria-hidden>
                        {good ? "✓" : "✕"}
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <p className="sr-only">Currently showing the {p.title} version on small screens.</p>

      {/* Symptom → fix */}
      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <h3 className="font-display text-[1.3rem] font-semibold">Symptom → fix</h3>
          <p className="mt-1 mb-4 text-[0.88rem] text-ink-2">What a scoring prompt does wrong in production, and the change that fixes it.</p>
          <div className="card divide-y divide-line">
            {promptsJson.symptoms.map((s) => (
              <details key={s.symptom} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-[0.92rem] font-medium text-ink hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                  {s.symptom}
                  <span className="font-mono text-[0.7rem] text-ink-3 transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <div className="grid grid-cols-1 gap-3 px-5 pb-4 text-[0.85rem] sm:grid-cols-2">
                  <p>
                    <span className="block font-mono text-[0.66rem] uppercase tracking-[0.08em] text-ink-3">Cause</span>
                    <span className="text-ink-2">{s.cause}</span>
                  </p>
                  <p>
                    <span className="block font-mono text-[0.66rem] uppercase tracking-[0.08em] text-accent-ink">Fix</span>
                    <span className="text-ink-2">{s.fix}</span>
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>

        <RoutingDiagram />
      </div>
    </Section>
  );
}

function RoutingDiagram() {
  const r = promptsJson.routing;
  const saved = Math.round((1 - r.costRouted / r.costNaive) * 100);
  return (
    <div>
      <h3 className="font-display text-[1.3rem] font-semibold">Cheap-model-first routing</h3>
      <p className="mt-1 mb-4 text-[0.88rem] text-ink-2">A small model culls, the frontier model scores survivors. Same output quality on the records that matter.</p>
      <div className="card p-5">
        <ol className="flex flex-col">
          {r.stages.map((s, i) => {
            const last = i === r.stages.length - 1;
            const frontier = s.id === "frontier";
            return (
              <li key={s.id} className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border font-mono text-[0.68rem]",
                      frontier ? "border-accent bg-accent text-[#0a0b0d]" : "border-line-strong bg-surface-2 text-ink-2",
                    )}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  {!last && (
                    <svg width="2" height="28" className="my-0.5" aria-hidden>
                      <line x1="1" y1="0" x2="1" y2="28" stroke="var(--line-strong)" strokeWidth="2" className="flow-line" />
                    </svg>
                  )}
                </div>
                <div className={cn("min-w-0 flex-1", !last && "pb-3")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[0.92rem] font-medium text-ink">{s.label}</span>
                    <span className="font-mono text-[0.7rem] text-ink-3 tabular">{Math.round(s.share * 100)}% of records</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-surface-3" aria-hidden>
                    <div className="bar-grow h-1.5 rounded-full" style={{ width: `${s.share * 100}%`, background: frontier ? "var(--accent)" : "var(--ramp-2)" }} />
                  </div>
                  <p className="mt-1 text-[0.78rem] text-ink-3">{s.note}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
          <div>
            <p className="text-[0.72rem] text-ink-3">Frontier on everything</p>
            <p className="font-display text-[1.4rem] font-semibold text-ink-3 line-through decoration-ink-3/60 tabular">${r.costNaive}</p>
          </div>
          <div>
            <p className="text-[0.72rem] text-ink-3">Routed · {saved}% less</p>
            <p className="font-display text-[1.4rem] font-semibold text-accent-ink tabular">${r.costRouted}</p>
          </div>
        </div>
        <p className="mt-2 text-[0.72rem] text-ink-3">Per 10,000 records, illustrative list prices. The qualified set is identical because the small model only applies disqualifiers it can verify.</p>
      </div>
    </div>
  );
}
