# Nick Soderstrom — portfolio

Static portfolio site built with [Astro](https://astro.build). No database, no
runtime: every page is prerendered HTML, so it hosts for free on GitHub Pages,
Cloudflare Pages, Netlify or Vercel.

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

### Social preview image

Add a 1200×630 PNG at `public/og.png`. Until then link previews on LinkedIn
and Upwork messages will show no image.

## Deploying

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and publishes
to GitHub Pages on every push to `main`.

1. In the repo: **Settings → Pages → Source: GitHub Actions**.
2. Merge this branch to `main`. The first run publishes to
   `https://<user>.github.io/portfolio/`.
3. For that temporary URL to work, set two repository variables under
   **Settings → Secrets and variables → Actions → Variables**:
   `SITE_URL = https://<user>.github.io` and `BASE_PATH = /portfolio`.
   Delete both once the custom domain is live.

## Custom domain

The site is configured for `https://nicksoderstrom.com` in `src/data/site.ts`
and `public/robots.txt`. Change both if you register a different name.

1. Register the domain. Cloudflare Registrar and Porkbun sell `.com` at cost
   (roughly $10–11/yr); Namecheap and Google-successor Squarespace are fine too.
2. Add a `public/CNAME` file containing just the domain, e.g.
   `nicksoderstrom.com`, and commit it.
3. At the registrar, add DNS records:
   - `A` records for `@` → `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`
   - `CNAME` for `www` → `<user>.github.io`
4. In **Settings → Pages**, enter the domain, wait for the DNS check, then tick
   **Enforce HTTPS**.

If you would rather use Cloudflare Pages, Netlify or Vercel, connect the repo,
set the build command to `npm run build` and the output directory to `dist`;
each of them handles the domain and certificate from their dashboard.
