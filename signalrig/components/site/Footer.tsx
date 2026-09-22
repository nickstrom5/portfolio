import siteJson from "@/data/site.json";
import { Logo } from "./Logo";

export function Footer() {
  const o = siteJson.owner;
  return (
    <footer className="border-t border-line py-10">
      <div className="wrap flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={22} />
          <span className="font-display text-[0.95rem] font-semibold">{siteJson.name}</span>
          <span className="text-[0.8rem] text-ink-3">· {siteJson.tagline}</span>
        </div>
        <div className="flex flex-col gap-1 text-[0.8rem] text-ink-3 md:items-end">
          <p>
            <a href={`mailto:${o.email}`} className="inline-block py-2 text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
              {o.email}
            </a>
          </p>
          <p>
            {o.name} · {o.location} ·{" "}
            <a href={o.site} target="_blank" rel="noreferrer" className="inline-block py-2 underline decoration-line-strong underline-offset-4 hover:text-ink-2">
              {o.siteLabel}
            </a>
          </p>
          <p className="text-[0.72rem]">All demo data is invented. Outcome figures are industry patterns, not client claims.</p>
        </div>
      </div>
    </footer>
  );
}
