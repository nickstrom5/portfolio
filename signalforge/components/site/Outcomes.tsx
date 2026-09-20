import outcomesJson from "@/data/outcomes.json";
import { Badge } from "@/components/ui/Badge";

export function Outcomes() {
  return (
    <section id="outcomes" aria-labelledby="outcomes-heading" className="border-y border-line bg-surface/40 py-16 md:py-20">
      <div className="wrap">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">Outcome patterns</p>
            <h2 id="outcomes-heading" className="h-section text-[1.7rem] md:text-[2.1rem]">
              What these systems tend to produce.
            </h2>
          </div>
          <Badge tone="warn">Industry patterns · not client claims</Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {outcomesJson.cards.map((c) => (
            <article key={c.id} className="card flex flex-col p-5">
              <h3 className="font-display text-[1.1rem] font-semibold text-ink">{c.title}</h3>
              <p className="mt-2 text-[0.85rem] leading-relaxed text-ink-2">{c.pattern}</p>
              <p className="mt-5 font-display text-[2.2rem] font-semibold leading-none tracking-tight text-accent-ink">{c.metric}</p>
              <p className="mt-1 text-[0.78rem] text-ink-3">{c.metricLabel}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {c.mechanism.map((m) => (
                  <li key={m}>
                    <Badge tone="neutral">{m}</Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-[0.78rem] text-ink-3">
                <span className="text-warn-ink">Caveat: </span>
                {c.caveat}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-[0.78rem] text-ink-3">{outcomesJson.disclaimer}</p>
      </div>
    </section>
  );
}
