// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/data/site';

// SITE_URL lets a preview deploy override the canonical host before DNS is
// pointed at yetour.info. BASE_PATH is only needed if this is ever served from
// a subdirectory; on Cloudflare Pages it stays '/'.
const siteUrl = process.env.SITE_URL || site.url;
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: siteUrl,
  base,
  trailingSlash: 'always',
  integrations: [sitemap()],
  build: { format: 'directory' },
});
