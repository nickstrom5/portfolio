// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { site } from './src/data/site';
import { themeInit } from './src/lib/theme-init.mjs';
import { lastCommit, projectSources } from './src/lib/git-date.mjs';

// Source files behind each page, so the sitemap's <lastmod> is the date of the
// last commit that changed that page's content. Needs full git history in CI.
/** @type {Record<string, string[]>} */
const pageSources = {
  '/': ['src/pages/index.astro', 'src/data/site.ts', 'src/data/services.ts', 'src/data/apps.json', 'src/data/testimonials.json', 'src/content/projects'],
  '/about/': ['src/pages/about.astro', 'src/data/personal.json', 'src/data/site.ts'],
  '/apps/': ['src/pages/apps.astro', 'src/data/showcase.ts', 'src/assets/showcase'],
  '/clients/': ['src/pages/clients.astro', 'src/data/clients.json', 'src/data/testimonials.json'],
  '/contact/': ['src/pages/contact.astro', 'src/data/site.ts'],
  '/ghl/': ['src/pages/ghl', 'src/components/ghl', 'src/lib/ghl', 'src/styles/ghl.css', 'src/data/ghl'],
  '/ghl/saas/': ['src/pages/ghl', 'src/components/ghl', 'src/lib/ghl', 'src/styles/ghl.css', 'src/data/ghl/index.ts', 'src/data/ghl/saas'],
  '/ghl/coaching/': ['src/pages/ghl', 'src/components/ghl', 'src/lib/ghl', 'src/styles/ghl.css', 'src/data/ghl/index.ts', 'src/data/ghl/coaching'],
  '/resume/': ['src/pages/resume.astro', 'src/data/experience.ts', 'src/data/services.ts', 'src/data/site.ts'],
  '/work/': ['src/pages/work/index.astro', 'src/content/projects', 'src/data/contracts.json', 'src/data/experience.ts'],
};

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // /thanks/ and the noindex /food/ page stay out of the sitemap.
      filter: (page) => !page.includes('/thanks') && !page.includes('/food/'),
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
    // @astrojs/sitemap logs an error from serialize() and skips the sitemap, but the
    // build still succeeds. This makes the missing sitemap fail the build instead.
    {
      name: 'sitemap-required',
      hooks: {
        'astro:build:done': ({ dir }) => {
          if (!existsSync(new URL('sitemap-index.xml', dir))) throw new Error('sitemap-index.xml was not written; see the @astrojs/sitemap error above.');
        },
      },
    },
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
  // (src/lib/theme-init.mjs, used by Base.astro and resume.astro) sits early in
  // <head>, before the <meta> policy, on purpose: moved below it (into <body>) a
  // slow connection could paint the light theme first. It is static first-party
  // code, so being outside a meta policy costs nothing; QA allows exactly this
  // script and fails on any other before the policy. Its hash is listed anyway,
  // computed from src/lib/theme-init.mjs, so it can never fall out of step.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' https://formspree.io",
        // The contact form sends in the background and stays on the page if that fails;
        // Cloudflare Web Analytics reports page views to cloudflareinsights.com (src/components/Analytics.astro).
        "connect-src 'self' https://formspree.io https://cloudflareinsights.com",
      ],
      scriptDirective: {
        resources: ["'self'", 'https://static.cloudflareinsights.com'],
        hashes: [/** @type {`sha256-${string}`} */ (`sha256-${createHash('sha256').update(themeInit).digest('base64')}`)],
      },
      styleDirective: { resources: [{ resource: "'unsafe-inline'", kind: 'attribute' }] },
    },
  },
});
