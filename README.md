# Nick Soderstrom — portfolio

Static portfolio site built with [Astro](https://astro.build). No database, no
runtime: every page is prerendered HTML, so it hosts for free on GitHub Pages,
Cloudflare Pages, Netlify or Vercel.

## Run it

```bash
npm install      # Node 22.12+ (see .nvmrc)
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

### Replacing the sample content

The site ships with **sample clients, apps, projects and testimonials** so the
layout can be reviewed. Every sample entry carries `"placeholder": true`, and
in `npm run dev` those cards show a yellow **Sample** badge. The badge never
renders in a production build, so replace them before launch:

1. **Projects** — copy any file in `src/content/projects/`, rename it (the file
   name becomes the URL), and fill in the frontmatter. The schema in
   `src/content.config.ts` validates it; a bad field fails the build with a
   clear message. Set `featured: true` on the three you want on the home page.
2. **Apps** — one object per app in `src/data/apps.json`. Paste the App Store
   and Play Store URLs into `appStore` / `playStore`; the buttons appear
   automatically. `projectSlug` links an app to its case study.
3. **Testimonials** — copy feedback from Upwork contracts into
   `src/data/testimonials.json`. Keep `source: "Upwork"` so the site can say
   where it came from.
4. **Clients** — names and industries in `src/data/clients.json`. Logos are
   deliberately not required; most Upwork clients won't supply one.
5. **Links and stats** — `src/data/site.ts`. Replace the two `REPLACE_WITH_…`
   URLs with your Upwork and LinkedIn profile links. Until you do, those
   buttons are hidden rather than pointing at a broken link.

Once every placeholder is gone you can delete the `placeholder` flags; they
are optional.

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
with an email link. If Formspree rejects the post itself, the browser falls
back to a normal post so Formspree can explain why. Without JavaScript it is
a normal post. The Content-Security-Policy allows that background request
with `connect-src 'self' https://formspree.io` in `astro.config.mjs`.

### Social preview images

Each indexable page has a 1200×630 share card, the picture LinkedIn, Slack and
email show for a link:

- `public/og.png` is the home page's card and the fallback for every other
  page. It is made by hand; no script writes it.
- `public/og/<path>.jpg` is a page's own card, with slashes as hyphens
  (`public/og/work-barbri-video-production.jpg`, `public/og/ghl-saas.jpg`).
  `src/lib/share-card.ts` picks it up at build time. `scripts/make-og.mjs`
  renders them from the built pages in `og.png`'s layout: the page's eyebrow
  and heading, the name and role, the round photo and the domain.
- Case studies with a cover screenshot share the top of that screenshot
  instead, cropped to 1200×630 at build time. Their `cover` must be a file in
  `src/assets/showcase/` (`/showcase/<file>`). `/food/` shares its own photo.

Cards are rendered from the built pages, so after changing a page heading run:

```bash
npm run build && npm run og && npm run build
```

The script skips the home page, `noindex` pages and pages with their own
picture, and deletes cards no page uses any more. `npm run qa` warns about an
indexable page still on the fallback card.

### Screenshots of this site

The "This website" story on `/apps/` uses screenshots of the home, Clients
and About pages (`src/assets/showcase/site-*.jpg`). After a visible change to
those pages, retake them from the build at 1440×900, twice the pixels:

```bash
npm run build && npm run shots && npm run build
```

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

1. In the repo: **Settings → Pages → Source: GitHub Actions**.
2. Merge this branch to `main`. The site is built for
   `https://work-with-nick.com` (see Custom domain below).

The deploy also runs `npm run ghl:check`, uses the Node version in `.nvmrc`,
and never cancels a deploy halfway: a newer push waits for the running one.
It publishes hidden files too, so `/.well-known/security.txt` goes live.
Afterwards it pings IndexNow (`scripts/indexnow.sh`) with the URLs in the
sitemap so Bing and others re-crawl; a failed ping never fails the deploy.

`.github/workflows/ci.yml` runs the build, `ghl:check` and the full browser QA
on every pull request, Dependabot's included. Make its `check` job a required
status check on `main`.

Each page's `<lastmod>` in the sitemap is the date of the last commit to the
files that page is built from (`pageSources` in `astro.config.mjs`; case
studies use `src/lib/git-date.mjs`). A new indexable page needs an entry
there, or the build fails and names the page.

## Security

GitHub Pages cannot send response headers, so the Content-Security-Policy is
a `<meta>` tag that Astro generates from `security.csp` in `astro.config.mjs`.
The inline script that applies the saved theme lives in
`src/lib/theme-init.mjs`; it runs early in `<head>` on purpose, and its CSP
hash is computed from that file, so it cannot fall out of step.

`public/.well-known/security.txt` tells researchers where to report a
problem. Its `Expires` date (now 2027-10-01) must be renewed every year.

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
links and anchors, layout shift on load, plus an SEO audit (title and
description length, canonical, robots, Open Graph image in the build with a
1200px width tag, JSON-LD validity, sitemap coverage), page-weight budgets
(gzipped HTML and scripts), the 404 page, `security.txt` and the interactive
flows (menu, theme toggle, work filters, Apps tiles, the `/ghl/` old-link
forward, simulator and landing demo, the contact form and what happens when
sending fails). It exits non-zero with a findings list. Case studies with
little to read and pages still on the fallback share card print as warnings,
not failures. Playwright is a dev dependency: run
`npx playwright install chromium` once, or point `PLAYWRIGHT_MODULE` at an
existing install.
A weekly routine runs this and reports.

For the judgment calls the checks can't make, ask Claude Code to run the
**site-auditor** agent (`.claude/agents/site-auditor.md`). It reads the site
as a recruiter, a hiring manager and a business owner would, checks search
visibility (including a web search for Nick's name), and returns a scorecard
and ranked fixes with evidence. It is read-only.

## GoHighLevel case studies (`/ghl/`)

Three case studies of GoHighLevel builds, each a fictional business with its
own sample sub-account, a working landing page and a set of connected
workflows. Each case has its own page, and each page loads only its own
case's data: `/ghl/` (the overview and the roofer), `/ghl/saas/` and
`/ghl/coaching/`. A switcher links the three.

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
| The three cases, in page order (the first is `/ghl/` itself) | `src/data/ghl/index.ts`, with each case's browser loader in `src/lib/ghl/load-case.ts` |
| A case's sub-account (team, pipeline, custom values, field labels) | `src/data/ghl/<case>/business.ts` (roofing: `src/data/ghl/business.ts`) |
| A case's landing page (copy, fields, consent, post-submit choices) | `src/data/ghl/<case>/landing.ts` (roofing: `src/data/ghl/landing.ts`) |
| One file per workflow | `src/data/ghl/<case>/automations/*.ts` (roofing: `src/data/ghl/automations/`) |
| Data model (triggers, steps, settings, scenarios) | `src/lib/ghl/types.ts` |
| The simulator (waits, branches, goals, DND, time windows) | `src/lib/ghl/engine.ts` |
| Case view, canvas, simulator panel, landing demo | `src/components/ghl/` |
| Page, compliance and troubleshooting copy | `src/components/ghl/GhlPage.astro` (routes in `src/pages/ghl/`) |
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

Deep links: `/ghl/saas/#saas-pql-alert` opens a workflow and
`/ghl/coaching/#coaching-demo` jumps to a landing page. Links in the old
single-page form (`/ghl/#saas`, `/ghl/#saas-pql-alert`, `/ghl/#coaching-demo`)
forward to the right page. To
attach proof of a live build (a Loom or screenshots of a real sub-account),
add a `proof` array to that workflow's file. The page is linked from its
AI Projects tile and the Work page, not from the nav or footer; to add it,
put it in `footerNav` in `src/data/site.ts`.

## SignalRig (GTM engineering showcase)

`signalrig/` is a separate Next.js app: a client-facing showcase with
working demos of enrichment, scoring, reply routing, signal detection and
reporting systems. It has its own `package.json` and deploys to Vercel from
that directory. See [`signalrig/README.md`](signalrig/README.md).
