import siteJson from "@/data/site.json";
import { Button } from "@/components/ui/Button";

const DEFS = [
  { role: "SDR", does: "sends the messages", verb: "Volume from people." },
  { role: "RevOps", does: "keeps the CRM honest", verb: "Process and reporting." },
  { role: "GTM engineering", does: "builds the machine that does both", verb: "Volume from systems.", accent: true },
];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-16 pb-14 md:pt-28 md:pb-24">
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute top-[-20%] left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(244,88,26,0.16),transparent)]" aria-hidden />
      <div className="wrap relative">
        <p className="eyebrow mb-5">GTM engineering · Chicago · remote</p>
        <h1 className="h-display max-w-4xl text-[2.6rem] md:text-[4.4rem]">
          GTM systems that <span className="text-accent-ink">compound.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-[1.1rem] leading-relaxed text-ink-2 md:text-[1.25rem]">
          GTM engineering, delivered as working systems. We build the pipeline that replaces manual SDR and RevOps volume: enrichment, scoring, routing, outbound, signals and reporting, wired together and
          measurable. Every system below is a working demo, not a slide.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" href={siteJson.cta.primary.href}>
            {siteJson.cta.primary.label}
          </Button>
          <Button size="lg" variant="secondary" href="#demos">
            See the demos
          </Button>
        </div>

        <dl className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius)] border border-line bg-line md:grid-cols-3">
          {DEFS.map((d) => (
            <div key={d.role} className={d.accent ? "bg-surface p-5 ring-1 ring-inset ring-accent/40" : "bg-surface p-5"}>
              <dt className={d.accent ? "font-display text-[1.05rem] font-semibold text-accent-ink" : "font-display text-[1.05rem] font-semibold text-ink"}>{d.role}</dt>
              <dd className="mt-1 text-[0.92rem] text-ink-2">
                {d.does}. <span className="text-ink-3">{d.verb}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[0.8rem] text-ink-3">
          One sentence: GTM engineering is the discipline of building the automated systems that find, qualify, contact and route buyers, so a small team runs at a large team&apos;s volume without
          the headcount.
        </p>
      </div>
    </section>
  );
}
