// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/data/site';

// SITE_URL lets CI (GitHub Pages) override the canonical URL until the custom
// domain is live. Once the domain is pointed, keep `site.url` as the source of truth.
const siteUrl = process.env.SITE_URL || site.url;
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: siteUrl,
  base,
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.includes('/thanks') })],
  build: { format: 'directory' },
});
