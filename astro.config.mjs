// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { createHash } from 'node:crypto';
import { site } from './src/data/site';
import { themeInit } from './src/lib/theme-init.mjs';
import { lastCommit, projectSources } from './src/lib/git-date.mjs';

// Source files behind each page, so the sitemap's <lastmod> is the date of the
// last commit that changed that page's content. Needs full git history in CI.
/** @type {Record<string, string[]>} */
const pageSources = {
  '/': ['src/pages/index.astro', 'src/data/site.ts', 'src/data/services.ts', 'src/data/apps.json', 'src/data/testimonials.json', 'src/content/projects', 'src/components'],
  '/about/': ['src/pages/about.astro', 'src/data/personal.json', 'src/data/site.ts'],
  '/apps/': ['src/pages/apps.astro', 'src/data/showcase.ts', 'src/components/showcase'],
  '/clients/': ['src/pages/clients.astro', 'src/data/clients.json', 'src/data/testimonials.json'],
  '/contact/': ['src/pages/contact.astro'],
  '/ghl/': ['src/pages/ghl', 'src/components/ghl', 'src/lib/ghl', 'src/styles/ghl.css', 'src/data/ghl/index.ts', 'src/data/ghl/roofing.ts', 'src/data/ghl/business.ts', 'src/data/ghl/landing.ts', 'src/data/ghl/automations'],
  '/ghl/saas/': ['src/pages/ghl', 'src/components/ghl', 'src/lib/ghl', 'src/data/ghl/saas'],
  '/ghl/coaching/': ['src/pages/ghl', 'src/components/ghl', 'src/lib/ghl', 'src/data/ghl/coaching'],
  '/resume/': ['src/pages/resume.astro', 'src/data/experience.ts', 'src/data/services.ts'],
  '/work/': ['src/pages/work/index.astro', 'src/content/projects', 'src/data/contracts.json', 'src/data/experience.ts'],
};

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/thanks'),
      serialize(item) {
        const path = new URL(item.url).pathname;
        const m = path.match(/^\/work\/([^/]+)\/$/);
        const src = m ? projectSources(m[1]) : pageSources[path];
        // A new page needs an entry above, or its <lastmod> would quietly go missing.
        if (!src) throw new Error(`sitemap: add ${path} to pageSources in astro.config.mjs`);
        const lastmod = lastCommit(src);
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
  // No code blocks in the content, and Shiki's inline styles would need a CSP exception.
  markdown: { syntaxHighlight: false },
  // Content-Security-Policy as a <meta> tag (GitHub Pages cannot send headers).
  // Astro hashes bundled scripts and styles itself. The inline theme script
  // (src/lib/theme-init.mjs) runs before the meta tag, which a meta policy
  // does not govern; its hash is listed anyway, computed from the same text,
  // in case Astro ever moves the tag earlier.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' https://formspree.io",
        // The contact form sends in the background and stays on the page if that fails.
        "connect-src 'self' https://formspree.io",
      ],
      scriptDirective: {
        hashes: [/** @type {`sha256-${string}`} */ (`sha256-${createHash('sha256').update(themeInit).digest('base64')}`)],
      },
      styleDirective: { resources: [{ resource: "'unsafe-inline'", kind: 'attribute' }] },
    },
  },
});
