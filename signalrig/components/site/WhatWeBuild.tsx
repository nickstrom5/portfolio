import engagementJson from "@/data/engagement.json";
import { Section } from "@/components/ui/Section";

const SYSTEMS = [
  {
    id: "enrichment",
    name: "Enrichment pipeline",
    line: "Domain in, qualified contactable record out. Qualify before you buy the email.",
    io: "domains → scored records",
    outcome: "60–80% fewer enrichment credits",
  },
  {
    id: "scoring",
    name: "Scoring model",
    line: "Weighted timing signals with decay. Fit says who could buy; timing says who is buying now.",
    io: "records + signals → ranked list",
    outcome: "reps work the top 20% only",
  },
  {
    id: "routing",
    name: "Reply routing",
    line: "Classify every inbound reply, update the CRM, page the owner. Minutes, not mornings.",
    io: "replies → CRM + Slack",
    outcome: "first response under 5 minutes",
  },
  {
    id: "signals",
    name: "Signal detection",
    line: "Daily watch on job boards, funding, exec moves and ad libraries. Accounts fire; lists stop going stale.",
    io: "feeds → fired accounts",
    outcome: "outbound timed to real events",
  },
  {
    id: "reporting",
    name: "Reporting layer",
    line: "Reply, interested, meeting and pipeline by segment × persona. The aggregate hides the two cells that carry everything.",
    io: "activity → segment × persona",
    outcome: "know what to double down on",
  },
];

export function WhatWeBuild() {
  return (
    <Section
      id="what"
      eyebrow="What we build"
      title="Five systems, in this order."
      lede="The order is the point. Each system consumes what the one before it produces, so building reporting before enrichment measures garbage precisely. Every card links to a working demo."
    >
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {SYSTEMS.map((s, i) => {
          const order = engagementJson.buildOrder[i];
          return (
            <li key={s.id} className="card group relative flex flex-col p-5 transition-colors hover:border-line-strong">
              <a href={`#demo-${s.id}`} className="absolute inset-0 rounded-[var(--radius)]" aria-label={`Open the ${s.name} demo`} />
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-[2rem] font-semibold leading-none text-accent-ink">{order.step}</span>
                <span className="font-mono text-[0.66rem] text-ink-3 transition-colors group-hover:text-accent-ink">demo →</span>
              </div>
              <h3 className="font-display text-[1.1rem] font-semibold leading-tight text-ink">{s.name}</h3>
              <p className="mt-2 flex-1 text-[0.85rem] leading-relaxed text-ink-2">{s.line}</p>
              <p className="mt-4 font-mono text-[0.68rem] text-ink-3">{s.io}</p>
              <p className="mt-2 border-t border-line pt-2 text-[0.78rem] text-ink-2">
                <span className="text-ink-3">Why {order.step === 1 ? "first" : `#${order.step}`}: </span>
                {order.why}
              </p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
