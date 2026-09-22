import aboutJson from "@/data/about.json";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

export function AboutSite() {
  const a = aboutJson;
  return (
    <Section id="about" eyebrow={a.eyebrow} title={a.title} className="border-t border-line bg-surface/40">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 text-[1.02rem] leading-relaxed text-ink-2">
            {a.what.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          <div>
            <h3 className="font-display text-[1.2rem] font-semibold text-ink">{a.path.title}</h3>
            <ol className="mt-3 flex flex-col divide-y divide-line rounded-[var(--radius)] border border-line">
              {a.path.steps.map((s, i) => (
                <li key={s.href}>
                  <a href={s.href} className="group flex items-start gap-4 p-4 transition-colors hover:bg-surface-2">
                    <span className="font-display text-[1.3rem] font-semibold leading-none text-accent-ink">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-[0.95rem] font-medium text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">
                        {s.label}
                      </span>
                      <span className="block text-[0.82rem] text-ink-3">{s.note}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <h3 className="font-display text-[1.2rem] font-semibold text-ink">{a.built.title}</h3>
            <dl className="mt-3 flex flex-col divide-y divide-line">
              {a.built.facts.map((f) => (
                <div key={f.k} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3 text-[0.88rem]">
                  <dt className="font-mono text-[0.7rem] uppercase tracking-[0.08em] text-ink-3 pt-0.5">{f.k}</dt>
                  <dd className="text-ink-2">{f.v}</dd>
                </div>
              ))}
            </dl>
            <a href={a.hiring.source.href} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-[0.85rem] text-accent-ink underline decoration-line-strong underline-offset-4 hover:text-ink">
              {a.hiring.source.label} →
            </a>
          </div>

          <div className="card p-5 ring-1 ring-inset ring-accent/40">
            <h3 className="font-display text-[1.2rem] font-semibold text-ink">{a.hiring.title}</h3>
            <p className="mt-2 text-[0.9rem] text-ink-2">{a.hiring.body}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button href={a.hiring.primary.href}>{a.hiring.primary.label}</Button>
              <Button href={a.hiring.secondary.href} variant="secondary">
                {a.hiring.secondary.label}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
