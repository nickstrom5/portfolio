// @ts-check
import { execFileSync } from 'node:child_process';
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/data/site';

// SITE_URL lets CI (GitHub Pages) override the canonical URL until the custom
// domain is live. Once the domain is pointed, keep `site.url` as the source of truth.
const siteUrl = process.env.SITE_URL || site.url;
const base = process.env.BASE_PATH || '/';

// Source files behind each page, so the sitemap's <lastmod> is the date of the
// last commit that changed that page's content. Needs full git history in CI.
/** @type {Record<string, string[]>} */
const pageSources = {
  '/': ['src/pages/index.astro', 'src/data/services.ts', 'src/data/apps.json', 'src/data/testimonials.json'],
  '/about/': ['src/pages/about.astro', 'src/data/personal.json', 'src/data/site.ts'],
  '/apps/': ['src/pages/apps.astro', 'src/data/showcase.ts'],
  '/clients/': ['src/pages/clients.astro', 'src/data/clients.json', 'src/data/testimonials.json'],
  '/contact/': ['src/pages/contact.astro'],
  '/ghl/': ['src/pages/ghl.astro', 'src/components/ghl', 'src/data/ghl'],
  '/resume/': ['src/pages/resume.astro', 'src/data/experience.ts', 'src/data/services.ts'],
  '/work/': ['src/pages/work/index.astro', 'src/content/projects', 'src/data/contracts.json', 'src/data/experience.ts'],
};
/** @param {string[]} paths */
const lastCommit = (paths) => {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', ...paths], { encoding: 'utf8' }).trim() || undefined;
  } catch {
    return undefined;
  }
};

export default defineConfig({
  site: siteUrl,
  base,
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // /thanks/ and the unlisted /food/ page stay out of the sitemap.
      filter: (page) => !page.includes('/thanks') && !page.includes('/food/'),
      serialize(item) {
        const path = new URL(item.url).pathname;
        const m = path.match(/^\/work\/([^/]+)\/$/);
        const src = m ? [`src/content/projects/${m[1]}.md`] : pageSources[path];
        const lastmod = src && lastCommit(src);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
  ],
  // Self-hosted Inter (latin variable subset, weights 400-800, SIL OFL) instead of Google Fonts.
  // display 'optional' avoids the layout shift of a late font swap; the preload makes it land in time.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      display: 'optional',
      fallbacks: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      options: {
        variants: [{ src: ['./src/assets/fonts/inter-latin-var.woff2'], weight: '400 800', style: 'normal' }],
      },
    },
  ],
  build: { format: 'directory', inlineStylesheets: 'always' },
  // Content-Security-Policy as a <meta> tag (GitHub Pages cannot send headers).
  // Astro hashes bundled scripts and styles itself; the two is:inline theme
  // scripts are hashed below. If either is edited, recompute its hash: the
  // browser then logs a CSP console error, which `npm run qa` reports.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' https://formspree.io",
      ],
      scriptDirective: {
        hashes: [
          'sha256-htx73Zx4L46jpbHrcdh+/riOTxDnEic9o6+JZKf+PU8=', // Base.astro theme script
          'sha256-7+7AWq7XfGD2rwhSmmyfxI/cWjETO1iSmENMs3kgPng=', // resume.astro theme script
        ],
      },
      styleDirective: { resources: [{ resource: "'unsafe-inline'", kind: 'attribute' }] },
    },
  },
});
