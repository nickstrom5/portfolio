"use client";

import { useMemo } from "react";
import { DemoFrame, LiveBadge } from "@/components/ui/DemoFrame";
import { EnrichmentDemo } from "@/components/demos/enrichment/EnrichmentDemo";
import { ScoringDemo } from "@/components/demos/scoring/ScoringDemo";
import { RoutingDemo } from "@/components/demos/routing/RoutingDemo";
import { SignalsDemo } from "@/components/demos/signals/SignalsDemo";
import { ReportingDemo } from "@/components/demos/reporting/ReportingDemo";
import { useActiveSection } from "@/lib/hooks";
import { cn } from "@/lib/cn";

const DEMOS = [
  {
    id: "demo-enrichment",
    short: "Enrichment",
    title: "Enrichment pipeline",
    lede: "Enter a domain. Watch it move from a broad source through a scrape, an evidence-only description and a scored ICP test, to the threshold. Email credits are spent only after it qualifies.",
    status: <LiveBadge>client-side · no calls made</LiveBadge>,
    Component: EnrichmentDemo,
  },
  {
    id: "demo-scoring",
    short: "Scoring",
    title: "Scoring model: timing, not just fit",
    lede: "Eight accounts, five signal types, explicit weights. Flip between ranking by fit and by timing, toggle decay on year-old signals, and see why three fresh signals beat a perfect firmographic match.",
    Component: ScoringDemo,
  },
  {
    id: "demo-routing",
    short: "Routing",
    title: "Reply routing",
    lede: "Simulated replies are classified, written to the CRM and posted to the owner's channel as a webhook chain. Then drag the response-time slider to see what slow follow-up costs.",
    Component: RoutingDemo,
  },
  {
    id: "demo-signals",
    short: "Signals",
    title: "Signal detection",
    lede: "A daily watchboard over ATS job boards, funding, exec changes and ad libraries. Each rule has a content test and a time window; accounts that pass both fire into the scoring model.",
    Component: SignalsDemo,
  },
  {
    id: "demo-reporting",
    short: "Reporting",
    title: "Reporting layer",
    lede: "The same 90 days of outbound, two ways. The aggregate looks fine. Split it by segment × persona and two cells are carrying sixteen.",
    Component: ReportingDemo,
  },
];

export function DemoShowcase() {
  const ids = useMemo(() => DEMOS.map((d) => d.id), []);
  const active = useActiveSection(ids);

  return (
    <section id="demos" aria-labelledby="demos-heading" className="scroll-mt-16 py-20 md:py-28">
      <div className="wrap">
        <div className="mb-8 max-w-2xl md:mb-10">
          <p className="eyebrow mb-3">Interactive demos</p>
          <h2 id="demos-heading" className="h-section text-[2rem] md:text-[2.6rem]">
            The systems, running.
          </h2>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-ink-2">
            Everything below runs in your browser on labelled sample data. No API calls, no tracking. The logic is the same shape we ship into Clay, HubSpot, Salesforce and n8n; the
            data is invented so nothing here is a client claim.
          </p>
        </div>
      </div>

      <div className="sticky top-16 z-40 border-y border-line bg-[rgba(10,11,13,0.85)] backdrop-blur-md">
        <nav aria-label="Demo sections" className="wrap flex gap-1 overflow-x-auto py-2">
          {DEMOS.map((d, i) => {
            const on = active === d.id;
            return (
              <a
                key={d.id}
                href={`#${d.id}`}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-[6px] px-3 py-1.5 text-[0.82rem] transition-colors",
                  on ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2",
                )}
              >
                <span className={cn("font-mono text-[0.7rem]", on ? "text-accent-ink" : "text-ink-3")}>0{i + 1}</span>
                {d.short}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="wrap mt-10 flex flex-col gap-20 md:gap-28">
        {DEMOS.map((d, i) => (
          <DemoFrame key={d.id} id={d.id} index={i + 1} title={d.title} lede={d.lede} status={d.status}>
            <d.Component />
          </DemoFrame>
        ))}
      </div>
    </section>
  );
}
