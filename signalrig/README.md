# SignalRig

A single-purpose marketing and demo site that proves GTM engineering capability:
five working, client-side demos (enrichment → scoring → routing → signals →
reporting), a prompt lab, the commercial foundation (ICP depth, funnel maths,
deliverability) and engagement options.

Built with Next.js (App Router), TypeScript and Tailwind v4. No backend, no
secrets, no analytics. Every demo runs on labelled sample data in `data/`.

## Run locally

```bash
cd signalrig
npm install
npm run dev        # http://localhost:3000
npm run build      # production build, also type-checks
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

Node 20 or newer.

## Deploy to Vercel

The app lives in the `signalrig/` subdirectory of the portfolio repo, so
point Vercel at that directory:

```bash
cd signalrig
npx vercel --prod
```

When Vercel asks for settings, accept the Next.js defaults. If you connect the
GitHub repo through the Vercel dashboard instead, set **Root Directory** to
`signalrig` in the project settings. Nothing else is required: fonts are
bundled from npm, the OG image is rendered at build time, and there are no
environment variables.

After deploying, update `url` in `data/site.json` to the live domain so the
canonical URL, sitemap and Open Graph tags point at it.

## Where things live

| What | Where |
| --- | --- |
| Name, tagline, owner, CTAs, nav | `data/site.json` |
| ICP definition used by the enrichment demo | `data/icp.json` |
| Sample companies for the enrichment demo | `data/companies.json` |
| Accounts and signal weights for the scoring demo | `data/accounts.json` |
| Inbound replies, owners, response curve | `data/replies.json` |
| Watchboard feeds and rules | `data/signals.json` |
| Segment × persona metrics | `data/reporting.json` |
| Bad/good prompts, symptom map, routing costs | `data/prompts.json` |
| Outcome pattern cards | `data/outcomes.json` |
| ICP layers, funnel defaults, deliverability checklist | `data/foundation.json` |
| Engagement options and build order | `data/engagement.json` |
| Design tokens (colors, radii, motion) | `app/globals.css` |
| Fonts | `app/fonts.ts` |
| Demos (each self-contained) | `components/demos/<name>/` |
| Page sections | `components/site/` |
| Shared UI primitives | `components/ui/` |

Each demo folder imports only from `data/`, `components/ui/` and `lib/`, so a
demo can be lifted into another project by copying its folder plus its JSON.

## Swap the sample ICP for a real client's

1. **Define the ICP** in `data/icp.json`. Keep every test binary with a
   written pass condition and an explicit weight. Weights should sum to 100.
   List disqualifiers as plain sentences. Leave `rules` in place; they are the
   "never invent" and "unknown scores zero" guardrails the prompt lab
   explains.
2. **Add companies** to `data/companies.json`. For each domain fill in
   `source`, `scrape`, `description`, `icp.tests` (one entry per test id in
   the ICP, with `pass` and a short `evidence` quote), `icp.disqualifiers`,
   `icp.score`, `icp.reason`, and, for qualified records only, `waterfall`
   and `contact`. Set `contact: null` and `waterfall: []` on anything below
   the threshold. Include at least one disqualified company so the
   waterfall gate is visible.
3. **Update the credit model** in the same file with the client's provider
   rate card, and `defaultQualifyRate` with the rate you measured on their
   list.
4. **Mirror the segments** in `data/accounts.json`, `data/replies.json`,
   `data/signals.json` and `data/reporting.json` so the five demos tell one
   story about one ICP. Account `segment` strings should match the segment
   labels used in reporting.
5. **Change the prompt** in `data/prompts.json` (`good.text`) so the numbered
   tests match the ICP tests. The bad prompt can stay as is.
6. Run `npm run build`. JSON is type-checked at import, so a missing field
   fails the build with a path to the problem.

Everything the visitor sees is still labelled "demo data". If you replace
samples with real client data, remove the `demo-tag` badges in
`components/ui/DemoFrame.tsx` and the disclaimer in `components/site/Footer.tsx`
only once you have permission to show it.

## Search engines

- `data/site.json` → `seo.googleSiteVerification`: paste the token from
  Google Search Console's "HTML tag" method (only the content value, not the
  whole tag) and redeploy. Leave it empty to render no tag.
- `seo.updated` is the sitemap's `lastmod`; bump it when the content changes.
- Structured data (WebSite, WebPage, SoftwareSourceCode, Person) is rendered
  by `components/site/StructuredData.tsx` from `site.json`.
- Canonical URL, Open Graph image, robots, sitemap, manifest and Apple icon
  are all generated from `app/` route files and `site.json`.

## Accessibility and motion

- All interactive demo controls are native buttons, inputs and switches with
  labels; the page is fully keyboard operable.
- `prefers-reduced-motion` disables timed sequences (pipelines complete
  instantly), animated numbers and list reordering.
- Colors were validated for contrast and colour-vision separation against the
  dark surface; status is never conveyed by colour alone.
