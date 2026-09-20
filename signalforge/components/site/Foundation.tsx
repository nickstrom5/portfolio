"use client";

import { useState } from "react";
import foundationJson from "@/data/foundation.json";
import { Section } from "@/components/ui/Section";
import { Slider } from "@/components/ui/Slider";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { int, money } from "@/lib/format";

export function Foundation() {
  return (
    <Section
      id="foundation"
      eyebrow="Commercial foundation"
      title="The judgement under the systems."
      lede="Automation multiplies whatever it is pointed at. These three things decide whether it multiplies pipeline or spam: how deep the ICP goes, whether the funnel maths supports the plan, and whether the mail lands."
      wide
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <IcpDepth />
        <Deliverability />
      </div>
      <div className="mt-8">
        <FunnelMaths />
      </div>
    </Section>
  );
}

function IcpDepth() {
  return (
    <div>
      <h3 className="font-display text-[1.3rem] font-semibold">ICP depth</h3>
      <p className="mt-1 mb-4 text-[0.88rem] text-ink-2">Most ICPs stop at layer one. Reply rates live in layers three and four.</p>
      <ol className="card divide-y divide-line">
        {foundationJson.icpLayers.map((l, i) => (
          <li key={l.layer} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 p-4">
            <span className={cn("font-display text-[1.3rem] font-semibold leading-none", i >= 2 ? "text-accent-ink" : "text-ink-3")}>{i + 1}</span>
            <div>
              <p className="text-[0.95rem] font-medium text-ink">{l.layer}</p>
              <p className="font-mono text-[0.7rem] text-ink-3">{l.examples}</p>
              <p className="mt-1.5 text-[0.82rem] text-ink-2">{l.depth}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Deliverability() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const total = foundationJson.deliverability.length;
  const count = Object.values(done).filter(Boolean).length;
  const criticalMissing = foundationJson.deliverability.filter((d) => d.critical && !done[d.id]).length;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[1.3rem] font-semibold">Deliverability checklist</h3>
        <span className="font-mono text-[0.72rem] text-ink-3 tabular">
          {count}/{total}
        </span>
      </div>
      <p className="mt-1 mb-4 text-[0.88rem] text-ink-2">Tick what you have. Anything marked critical that is missing means the rest of this page is not worth building yet.</p>
      <ul className="card divide-y divide-line">
        {foundationJson.deliverability.map((d) => {
          const on = !!done[d.id];
          return (
            <li key={d.id}>
              <label className="flex cursor-pointer items-start gap-3 p-4 hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => setDone((s) => ({ ...s, [d.id]: e.target.checked }))}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-[0.92rem] font-medium", on ? "text-ink-3 line-through" : "text-ink")}>{d.label}</span>
                    {d.critical && <Badge tone={on ? "neutral" : "bad"}>critical</Badge>}
                  </span>
                  <span className="mt-0.5 block text-[0.8rem] text-ink-2">{d.detail}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[0.8rem] text-ink-2" aria-live="polite">
        {criticalMissing === 0 ? (
          <span className="text-good-ink">Critical items covered. Volume can scale.</span>
        ) : (
          <span className="text-warn-ink">
            {criticalMissing} critical item{criticalMissing === 1 ? "" : "s"} missing. Fix before any campaign runs.
          </span>
        )}
      </p>
    </div>
  );
}

function FunnelMaths() {
  const f = foundationJson.funnel;
  const [reps, setReps] = useState(2);
  const [sends, setSends] = useState(f.sendsPerRepPerMonth);
  const [reply, setReply] = useState(Math.round(f.replyRate * 1000) / 10);
  const [positive, setPositive] = useState(Math.round(f.positiveShare * 100));
  const [meeting, setMeeting] = useState(Math.round(f.meetingFromPositive * 100));
  const [opp, setOpp] = useState(Math.round(f.oppFromMeeting * 100));
  const [close, setClose] = useState(Math.round(f.closeFromOpp * 100));
  const [acv, setAcv] = useState(f.acv);

  const totalSends = reps * sends;
  const replies = totalSends * (reply / 100);
  const positives = replies * (positive / 100);
  const meetings = positives * (meeting / 100);
  const opps = meetings * (opp / 100);
  const won = opps * (close / 100);
  const pipeline = opps * acv;
  const revenue = won * acv;

  const stages = [
    { label: "Sends", v: totalSends },
    { label: "Replies", v: replies },
    { label: "Positive", v: positives },
    { label: "Meetings", v: meetings },
    { label: "Opps", v: opps },
    { label: "Won", v: won },
  ];
  const maxStage = stages[0].v;

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line p-5 md:p-6">
        <h3 className="font-display text-[1.3rem] font-semibold">Funnel maths</h3>
        <p className="mt-1 text-[0.88rem] text-ink-2">
          Before building anything, check that the plan closes. Move any number and the rest recompute. {f.note}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid grid-cols-1 gap-5 border-b border-line p-5 sm:grid-cols-2 md:p-6 lg:border-r lg:border-b-0">
          <Slider id="f-reps" label="Reps (or rep-equivalents of automation)" value={reps} min={1} max={10} onChange={setReps} />
          <Slider id="f-sends" label="Cold sends per rep per month" value={sends} min={300} max={4000} step={100} onChange={setSends} format={int} />
          <Slider id="f-reply" label="Reply rate" value={reply} min={0.5} max={12} step={0.1} onChange={setReply} format={(v) => `${v.toFixed(1)}%`} />
          <Slider id="f-positive" label="Positive share of replies" value={positive} min={5} max={60} onChange={setPositive} format={(v) => `${v}%`} />
          <Slider id="f-meeting" label="Meeting from positive" value={meeting} min={20} max={95} onChange={setMeeting} format={(v) => `${v}%`} />
          <Slider id="f-opp" label="Opportunity from meeting" value={opp} min={10} max={90} onChange={setOpp} format={(v) => `${v}%`} />
          <Slider id="f-close" label="Close from opportunity" value={close} min={5} max={60} onChange={setClose} format={(v) => `${v}%`} />
          <Slider id="f-acv" label="ACV" value={acv} min={5000} max={250000} step={1000} onChange={setAcv} format={money} />
        </div>
        <div className="p-5 md:p-6">
          <ol className="flex flex-col gap-2" aria-label="Funnel stages per month">
            {stages.map((s, i) => (
              <li key={s.label} className="grid grid-cols-[5rem_minmax(0,1fr)_5rem] items-center gap-3">
                <span className="text-[0.8rem] text-ink-2">{s.label}</span>
                <span className="h-4 w-full">
                  <span
                    className="bar-grow block h-4 rounded-r-[4px]"
                    style={{
                      width: `${Math.max(1.5, Math.sqrt(s.v / maxStage) * 100)}%`,
                      background: i === stages.length - 1 ? "var(--accent)" : "var(--ramp-2)",
                    }}
                  />
                </span>
                <span className="text-right font-mono text-[0.8rem] text-ink tabular">{s.v >= 100 ? int(Math.round(s.v)) : s.v.toFixed(1)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-1 text-[0.68rem] text-ink-3">Bars are square-root scaled so the small stages stay visible. Values are per month.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="card-2 p-4">
              <p className="text-[0.72rem] text-ink-3">Pipeline created / month</p>
              <p className="num-swap mt-1 font-display text-[1.7rem] font-semibold leading-none text-ink tabular">{money(pipeline)}</p>
            </div>
            <div className="card-2 p-4">
              <p className="text-[0.72rem] text-ink-3">Closed-won / month</p>
              <p className="num-swap mt-1 font-display text-[1.7rem] font-semibold leading-none text-accent-ink tabular">{money(revenue)}</p>
            </div>
          </div>
          <p className="mt-4 text-[0.82rem] text-ink-2">
            {meetings < 8 ? (
              <>
                Under 8 meetings a month. Before adding reps, fix reply rate (ICP depth, signals) or positive share (offer). Volume on a weak funnel is the expensive fix.
              </>
            ) : (
              <>
                {Math.round(meetings)} meetings a month at {int(totalSends)} sends. Each 1-point gain in reply rate is worth {money(((totalSends * 0.01 * (positive / 100) * (meeting / 100) * (opp / 100)) * acv))} of monthly
                pipeline at these ratios.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
