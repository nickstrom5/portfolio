# yetour.info

An unofficial, sourced archive of the 2026 **Ye Live Concert Tour** — every announced date,
the stage, the setlists, the discography and the people around it.

Static Astro site. No tracking, no analytics, no third-party requests until a visitor
asks for one (the Spotify player and the YouTube embeds both load on click).

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # astro check + static build to ./dist
npm run preview
npm run qa         # full audit against ./dist — see below
npm run covers     # refresh album cover URLs from Spotify into src/data/covers.ts
```

## Deploying to Cloudflare Pages

The domain is registered in Cloudflare, so Pages is the shortest path. In the dashboard,
**Workers & Pages → Create → Pages → Connect to Git**, pick this repository, then:

| Setting | Value |
| --- | --- |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `yetour` |

Node comes from the committed `.node-version` (22), so there is nothing to set under
Environment variables. A clean `npm ci && npm run build` takes about ten seconds.

Then **Custom domains → Set up a custom domain → `yetour.info`**, and add `www.yetour.info`
as a second custom domain if you want the redirect. Cloudflare writes the DNS records itself
because the zone is already in the account.

Branches other than the production one get their own preview URL automatically, which is the
way to check that the Spotify cover art and the YouTube stills resolve before any of it is
pointed at the real domain.

`SITE_URL` can be set as a build variable to override the canonical host; leaving it unset
means every page canonicalises to yetour.info, which keeps preview deploys out of search
results.

`public/_headers` sets the security headers and immutable caching for hashed assets; Pages
picks it up automatically. `SITE_URL` can be set as a build variable to override the canonical
host on a preview branch.

## QA

`npm run qa` runs the audit in `scripts/qa.mjs` against the built site: every page at five
viewports from 320px up, in both colour schemes, checking JS errors, horizontal overflow,
heading outline, alt text, duplicate ids, broken links and anchors, phone tap targets, tiny
text, and text contrast against whatever is actually painted behind it — plus the SEO pass
(title and description length and uniqueness, canonical, robots, Open Graph, JSON-LD nodes,
sitemap coverage, outbound `rel` hygiene) and ten interaction checks covering the date
filters, the countdown, the discography player and its theme swap, deep links, the video
facades and the full prev/next chain across all twenty dates.

Playwright is deliberately not a dependency of this project — installing it pulls
browser binaries, which would land in every deploy build for no reason. Install it when
you want to run the audit:

```bash
npm i -D playwright && npx playwright install chromium
npm run build && npm run qa
```

If Chromium already lives somewhere else in your environment, point at it instead:

```bash
PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chrome npm run qa
```

## Editing the data

Everything the pages render comes from `src/data/`, one file per subject:

| File | What it holds |
| --- | --- |
| `tour.ts` | The twenty dates, legs, songs, the reference set, and per-show sources |
| `globe.ts` | The stage, its eight states, and the verified video ids |
| `discography.ts` | The albums, their palettes and their verified Spotify ids |
| `credits.ts` | Guest verses, production for others, and non-music ventures |
| `donda.ts` | Donda West, and the house on South Shore Drive |
| `andre.ts` | André Troutman, the talk box, and the Troutman lineage |
| `site.ts` | Domain, title, byline |

Each show record carries its own `sources` array, and setlists are tagged `reported`,
`partial` or `reference` so a page can never imply more certainty than the sourcing supports.
Add a date by appending to `shows` in `tour.ts`; the grid, the map, the route table, the
pager, the sitemap and the JSON-LD all follow from it.

## House rules

- **Photography only from the rights holder's own host.** Album covers are resolved from
  Spotify's public oEmbed endpoint and served from their CDN, unaltered and linked back to
  each record, as their terms require. The stage photographs on the globe page are frames
  YouTube serves from the two full-length Istanbul uploads, each linked to its video.
  Nothing is copied into this repository and nothing is re-hosted.
- **Everything else is drawn.** Posters, stage plots, crowd fields, the Donda memorial plate
  and the house elevation are original vector work generated from the data. They are labelled
  as drawings and never presented as photographs.
- **Nothing unsourced is stated as fact.** Editorial writing is clearly editorial; numbers,
  dates, venues and guests are footnoted on the page they appear on.
- **Playback is the rights holder's.** Albums play through Spotify's own embed and shows
  through YouTube's; no audio or video is hosted here.
