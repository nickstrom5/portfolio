// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The canonical host, the same as `site.url` in src/data/site.ts. It is written
// out here rather than imported: importing a .ts file makes Astro compile this
// config through Vite, which then reads the portfolio's tsconfig one folder up
// and fails on a fresh clone where the portfolio's dependencies are not
// installed, as on a Cloudflare Pages build.
//
// SITE_URL lets a preview deploy override the canonical host before DNS is
// pointed at yetour.info. BASE_PATH is only needed if this is ever served from
// a subdirectory; on Cloudflare Pages it stays '/'.
const siteUrl = process.env.SITE_URL || 'https://yetour.info';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: siteUrl,
  base,
  trailingSlash: 'always',
  integrations: [sitemap()],
  build: { format: 'directory' },
  // Vite's resolver looks for a tsconfig per file and would otherwise climb
  // to the portfolio's, one folder up (see the note on siteUrl).
  vite: { tsconfig: 'tsconfig.json' },
});
