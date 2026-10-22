# work-with-nick.com

Source for **[work-with-nick.com](https://work-with-nick.com)**, the portfolio of
Nick Soderstrom, a senior project manager and operations lead in Chicago.

It's a static [Astro](https://astro.build) site. There's no database and no
server: every page is prerendered HTML, built and published to GitHub Pages by
GitHub Actions on every push to `main`.

## What's in this repo

| Path | What it is |
| --- | --- |
| `src/`, `public/` | The portfolio site |
| `src/data/ghl/`, `src/lib/ghl/` | The [GoHighLevel case studies](#gohighlevel-case-studies-ghl): workflows with an in-browser simulator |
| `scripts/` | Build-time checks and tools: QA audit, photo-metadata guard, résumé PDF, GHL scenario runner |
| `.githooks/` | Pre-commit hook that blocks photos still carrying metadata |
| `.claude/agents/` | The read-only `site-auditor` agent ([below](#qa-and-seo-audit)) |
| `signalrig/` | A separate Next.js app: the [SignalRig GTM showcase](#signalrig-gtm-engineering-showcase), deployed to Vercel |
| `yetour/` | A separate Astro site: [yetour.info](#yetourinfo), an unofficial archive of a 2026 concert tour |

`signalrig/` and `yetour/` each have their own `package.json` and don't share
code or dependencies with the portfolio.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # type-checks, then outputs ./dist
npm run preview  # serves ./dist
```

## Where the content lives

Everything visible is data. Nothing is hard-coded in the pages.

| What                     | File                              |
| ------------------------ | --------------------------------- |
| Name, tagline, links, hero stats, email | `src/data/site.ts`      |
| Services                 | `src/data/services.ts`            |
| Case studies             | `src/content/projects/*.md`       |
| Mobile apps              | `src/data/apps.json`              |
| Client list              | `src/data/clients.json`           |
| Testimonials             | `src/data/testimonials.json`      |
| Skills list              | `src/pages/about.astro` (top of file) |
| Colors, fonts, spacing   | `src/styles/global.css` (`:root` tokens) |

### Adding content

1. **Case studies**: copy any file in `src/content/projects/` and rename it
   (the file name becomes the URL). The schema in `src/content.config.ts`
   validates the frontmatter, and a bad field fails the build with a clear
   message. `featured: true` puts a case study on the home page.
2. **Apps**: one object per app in `src/data/apps.json`. The App Store and Play
   Store buttons appear once `appStore` / `playStore` are set. `projectSlug`
   links an app to its case study.
3. **Testimonials**: `src/data/testimonials.json`, with `source` saying where
   each one came from.
4. **Clients**: names and industries in `src/data/clients.json`. Logos are
   optional.

Any entry can carry `placeholder: true` to mark it as sample content. In
`npm run dev` it shows a yellow **Sample** badge, which never appears in a
production build.

### Contact form

The form posts to `site.contactEndpoint` in `src/data/site.ts`. It is empty by
default, which makes the form open the visitor's email client instead. To get
submissions in your inbox without a backend, create a free form at
[Formspree](https://formspree.io) or [Basin](https://usebasin.com), paste the
endpoint URL into `contactEndpoint`, and rebuild. The `_gotcha` honeypot field
is already wired for Formspree's spam filter.

### Social preview image

Add a 1200×630 PNG at `public/og.png`. Until then link previews on LinkedIn
and Upwork messages will show no image.

## Personal photos (About page)

Drop photos in `public/personal/` (create the folder) and list them in
`src/data/personal.json`, for example
`{ "src": "/personal/cats-01.jpg", "alt": "Two cats asleep on a laptop", "caption": "Quality control." }`.
Keep each JPEG under about 400 KB (about 1600px on the long side). The section on
the About page appears once the list is non-empty.

## Food photos (`/food/` page)

`/food/` is a food portfolio Nick shares by link; the only link on the site is the
"cook" line on the About page. It is `noindex` and left out of the sitemap, so it
stays out of search results. It is not private: this repo is public.

Add photos with `npm run food:add -- photo.jpg --name "Cacio e pepe" --date none`.
The script strips GPS and other metadata, fixes rotation and saves the photo to
`src/assets/food/`; every photo there appears on the page. Titles, one-line notes,
alt text and the order live in `src/data/food.json` (see `src/assets/food/README.md`).
The build and every commit fail if any image in the repo still carries metadata
(`npm run photos:check`; the pre-commit hook is in `.githooks/`), so never copy a
photo in by hand.

## Deploying

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and publishes
to GitHub Pages on every push to `main`.

Pages is set to **Source: GitHub Actions**. To preview a fork at
`https://<user>.github.io/portfolio/` before it has a custom domain, set the
repository variables `SITE_URL = https://<user>.github.io` and
`BASE_PATH = /portfolio`.

## Custom domain

The site is configured for `https://work-with-nick.com`, registered with
Cloudflare Registrar. `src/data/site.ts`, `public/robots.txt` and
`public/CNAME` all carry the domain; change all three if it ever moves.

DNS lives in the Cloudflare dashboard (**work-with-nick.com → DNS → Records**).
Add these, with the proxy toggle set to **DNS only** (grey cloud) so GitHub can
issue the certificate:

| Type  | Name | Content              |
| ----- | ---- | -------------------- |
| A     | @    | 185.199.108.153      |
| A     | @    | 185.199.109.153      |
| A     | @    | 185.199.110.153      |
| A     | @    | 185.199.111.153      |
| CNAME | www  | nickstrom5.github.io |

Then in the repo: **Settings → Pages → Custom domain**, enter
`work-with-nick.com`, wait for the DNS check to pass, and tick
**Enforce HTTPS**. Once HTTPS is enforced you can switch the records back to
proxied if you want Cloudflare's caching in front of the site.

If you would rather use Cloudflare Pages, Netlify or Vercel, connect the repo,
set the build command to `npm run build` and the output directory to `dist`;
each of them handles the domain and certificate from their dashboard.

## QA and SEO audit

`npm run build && npm run qa` checks every built page at phone, tablet and
desktop widths in both themes: JavaScript errors, horizontal overflow,
heading outline, alt text, form labels, tap targets, tiny text, internal
links and anchors, plus an SEO audit (title and description length,
canonical, robots, Open Graph image, JSON-LD validity, sitemap coverage) and
the interactive flows (menu, theme toggle, work filters, Apps tiles, contact
form). It exits non-zero with a findings list. Needs Playwright with
Chromium, or `PLAYWRIGHT_MODULE` pointing at an existing install.
A weekly routine runs this and reports.

For the judgment calls the checks can't make, ask Claude Code to run the
**site-auditor** agent (`.claude/agents/site-auditor.md`). It reads the site
as a recruiter, a hiring manager and a business owner would, checks search
visibility (including a web search for Nick's name), and returns a scorecard
and ranked fixes with evidence. It is read-only.

## GoHighLevel case studies (`/ghl/`)

Three switchable case studies of GoHighLevel builds, each a fictional
business with its own sample sub-account, a working landing page and a set
of connected workflows:

- **Harbor & Pine Roofing** (small local business): speed to lead,
  missed-call text-back, inspection reminders, estimate follow-up, job
  hand-off, reviews and referrals, database reactivation.
- **Crewlo** (B2B SaaS): demo routing, trial onboarding from product events
  over Inbound Webhooks, product-qualified lead alerts, trial ending,
  closed-won hand-off, NPS routing.
- **Trailhead Career Coaching** (online coach): workshop registration and
  reminders, checkout recovery, course onboarding, failed payments,
  coaching applications, completion and testimonials.

Each workflow renders as a GHL-builder-style canvas and runs in an
in-browser simulator on sample test contacts, or on whoever fills in that
case's landing-page form. Nothing is sent anywhere.

| What | Where |
| --- | --- |
| The three cases, in page order | `src/data/ghl/index.ts` |
| A case's sub-account (team, pipeline, custom values, field labels) | `src/data/ghl/<case>/business.ts` (roofing: `src/data/ghl/business.ts`) |
| A case's landing page (copy, fields, consent, post-submit choices) | `src/data/ghl/<case>/landing.ts` (roofing: `src/data/ghl/landing.ts`) |
| One file per workflow | `src/data/ghl/<case>/automations/*.ts` (roofing: `src/data/ghl/automations/`) |
| Data model (triggers, steps, settings, scenarios) | `src/lib/ghl/types.ts` |
| The simulator (waits, branches, goals, DND, time windows) | `src/lib/ghl/engine.ts` |
| Case view, canvas, simulator panel, landing demo | `src/components/ghl/` |
| Page, compliance and troubleshooting copy | `src/pages/ghl.astro` |
| Styles | `src/styles/ghl.css` |

After editing a workflow, run:

```bash
npm run ghl:check                                          # every case
npm run ghl:check -- src/data/ghl/saas/automations/pql-alert.ts   # one file
```

It runs every test scenario through the simulator and fails if a run ends
differently than its `expect` block says, a step or branch is never reached,
a message has an unresolved `{{merge_field}}`, an SMS is longer than two
segments or contains characters that force UCS-2 encoding, a workflow breaks
a builder rule (steps after an If/Else, a Go To that is not the last step of
its branch, more than one Goal Event), or a landing page points at a
workflow or scenario that does not exist. The full run also plays each
landing-page choice at every hour of the week, with the SMS box ticked and
not, the way a visitor's own run works.

Deep links: `/ghl/#saas` opens a case, `/ghl/#saas-pql-alert` opens one
of its workflows and `/ghl/#coaching-demo` jumps to a landing page. To
attach proof of a live build (a Loom or screenshots of a real sub-account),
add a `proof` array to that workflow's file. The page is linked from its
AI Projects tile and the Work page, not from the nav or footer; to add it,
put it in `footerNav` in `src/data/site.ts`.

## SignalRig (GTM engineering showcase)

`signalrig/` is a separate Next.js app: a client-facing showcase with
working demos of enrichment, scoring, reply routing, signal detection and
reporting systems. It has its own `package.json` and deploys to Vercel from
that directory. See [`signalrig/README.md`](signalrig/README.md).

## yetour.info

`yetour/` is a separate static Astro site: an unofficial, sourced archive of the
2026 Ye Live Concert Tour (dates, stage, setlists and discography). It has its
own `package.json`, QA script and Cloudflare Pages deploy. See
[`yetour/README.md`](yetour/README.md).
