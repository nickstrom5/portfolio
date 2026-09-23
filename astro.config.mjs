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
      filter: (page) => !page.includes('/thanks'),
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
  // Self-hosted Inter (latin variable subset, SIL OFL) instead of Google Fonts.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      fallbacks: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      options: {
        variants: [{ src: ['./src/assets/fonts/inter-latin-var.woff2'], weight: '100 900', style: 'normal' }],
      },
    },
  ],
  build: { format: 'directory', inlineStylesheets: 'always' },
});
