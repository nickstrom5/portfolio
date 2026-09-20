import engagementJson from "@/data/engagement.json";
import siteJson from "@/data/site.json";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function Engagement() {
  return (
    <Section
      id="engage"
      eyebrow="Engagement options"
      title="Three ways to work with us."
      lede="Start with the teardown if you are unsure. It is the fastest way to find out whether your problem is list quality, timing, response speed or reporting, and each of those has a different fix."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {engagementJson.options.map((o, i) => {
          const cta = o.cta === "primary" ? siteJson.cta.primary : siteJson.cta.secondary;
          const featured = i === 0;
          return (
            <article key={o.id} className={cn("card flex flex-col p-6", featured && "ring-1 ring-inset ring-accent/40")}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-[1.25rem] font-semibold text-ink">{o.name}</h3>
                <span className="font-mono text-[0.68rem] text-ink-3">{o.duration}</span>
              </div>
              <p className="mt-0.5 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-accent-ink">{o.format}</p>
              <p className="mt-3 text-[0.85rem] text-ink-2">{o.who}</p>
              <ul className="mt-4 flex flex-1 flex-col gap-2">
                {o.get.map((g) => (
                  <li key={g} className="flex gap-2 text-[0.85rem] text-ink-2">
                    <span className="text-accent-ink" aria-hidden>
                      →
                    </span>
                    {g}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button href={cta.href} variant={featured ? "primary" : "secondary"} className="w-full">
                  {cta.label}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="card mt-8 flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-[1.15rem] font-semibold">Not sure which? Send a sample ICP.</p>
          <p className="mt-1 text-[0.88rem] text-ink-2">We reply with a scored sample list, the disqualifiers you are missing, and a build order. No deck.</p>
        </div>
        <Button href={siteJson.cta.secondary.href} variant="secondary" size="lg">
          {siteJson.cta.secondary.label}
        </Button>
      </div>
    </Section>
  );
}
