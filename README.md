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
| `src/data/n8n/`, `src/lib/n8n/` | The [n8n case studies](#n8n-case-studies-n8n): the same idea for n8n, with its own simulator |
| `scripts/` | Build-time checks and tools: QA audit, photo-metadata guard, résumé PDF, GHL and n8n scenario runners |
| `.githooks/` | Pre-commit hook that blocks photos still carrying metadata |
| `.claude/agents/` | The read-only `site-auditor` agent ([below](#qa-and-seo-audit)) |
| `signalrig/` | A separate Next.js app: the [SignalRig GTM showcase](#signalrig-gtm-engineering-showcase), deployed to Vercel |
| `yetour/` | A separate Astro site: [yetour.info](#yetourinfo), an unofficial archive of a 2026 concert tour |

`signalrig/` and `yetour/` each have their own `package.json` and don't share
code or dependencies with the portfolio.

## Run it

```bash
npm install      # Node 22 (see .nvmrc)
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

With an endpoint set, a small script on `/contact/` sends the form in the
background. Success goes to `/thanks/`. If Formspree is down or the visitor is
offline, they stay on the page with their message intact and an error box
with an email link. If Formspree rejects the post itself (its spam check,
say), the browser falls back to a normal post so Formspree can explain why.
Without JavaScript it is a normal post. The Content-Security-Policy allows the
background request with `connect-src https://formspree.io` in
`astro.config.mjs`.

### Social preview images

Every indexable page has a 1200×630 share card, the picture LinkedIn, Slack and
email show for a link:

- `public/og.png` is the home page's card and the fallback for every other
  page. It is made by hand; no script writes it.
- `public/og/<path>.jpg` is a page's own card, with slashes as hyphens
  (`public/og/work-barbri-video-production.jpg`). `src/lib/share-card.ts`
  picks it up at build time. `npm run og` (`scripts/make-og.mjs`) renders them
  from the built pages in `og.png`'s layout: the page's eyebrow and heading,
  the name and role, the round photo and the domain. After changing a
  heading or adding a page, run `npm run build && npm run og && npm run build`.
- Case studies with a cover screenshot share the top of that screenshot
  instead, cropped to 1200×630 at build time. Their `cover` must be a file in
  `src/assets/showcase/`, written `/showcase/<file>`.

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
to GitHub Pages on every push to `main`. Every pull request first runs
`.github/workflows/ci.yml`: the build, `ghl:check`, `n8n:check` and the full
browser QA (`npm run qa`).

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

## n8n case studies (`/n8n/`)

The same format as `/ghl/`, for n8n: three switchable case studies of
fictional businesses, each a sample n8n instance with a test form and
three workflows:

- **Copperleaf Coffee Roasters** (Shopify store and wholesale): wholesale
  inquiries from an n8n Form, paid orders split into roast tickets, a
  morning stock check against reorder points.
- **Ledgerline Bookkeeping** (professional services, self-hosted): client
  onboarding from a webhook, a document chase that waits days for a click,
  and the error workflow every other workflow names.
- **Slotwise** (SaaS, queue mode): AI support triage with a Text Classifier,
  a nightly Postgres-to-HubSpot sync in batches, failed-payment follow-up
  from Stripe.

The simulator follows n8n's rules rather than GoHighLevel's: nodes pass
items, an If or Switch can send items down several outputs in one run, v1
execution order finishes each branch before the next, a node with no
input items does not run, branches can meet at a Merge, Retry On Fail and
error outputs behave as configured, and a failed production execution
starts the case's error workflow. The canvas is drawn top to bottom
(n8n's runs left to right) and shares its layout styles with `/ghl/`.

| What | Where |
| --- | --- |
| The three cases, in page order | `src/data/n8n/index.ts` |
| A case's instance (team, hosting, stack, shared values) | `src/data/n8n/<case>/business.ts` |
| A case's test form (fields, the item it becomes, outcomes to pick) | `src/data/n8n/<case>/demo.ts` |
| One file per workflow | `src/data/n8n/<case>/automations/*.ts` |
| Data model (nodes, splits, settings, test events) | `src/lib/n8n/types.ts` |
| The simulator | `src/lib/n8n/engine.ts` |
| Case view, canvas, simulator panel, test form | `src/components/n8n/` |
| Page, reliability and troubleshooting copy | `src/pages/n8n.astro` |
| Styles (on top of `ghl.css`) | `src/styles/n8n.css` |

After editing a workflow, run:

```bash
npm run n8n:check
```

It runs every test event through the simulator and fails if a run ends
differently than its `expect` block says (status, nodes reached, item
counts, the error workflow), a node or output is never reached, a message
has an unresolved `{{ expression }}`, or a workflow breaks a rule the page
relies on: duplicate node names, an If without true and false outputs,
branches that rejoin without a Merge, Retry On Fail outside n8n's limits or
combined with a Continue setting, a credential the data model does not
list, or an error workflow without an Error Trigger. It also submits each
case's test form once per outcome.

The cases are made up to show the skill; none is client work. Deep links
work as on `/ghl/`: `/n8n/#saas`, `/n8n/#saas-usage-sync`, `/n8n/#coffee-demo`.

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
