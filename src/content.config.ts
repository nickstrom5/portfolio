import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * Case studies. One markdown file per project in src/content/projects/.
 * Frontmatter is validated here so a typo fails the build instead of
 * rendering a broken card.
 */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    /** Short version for the browser tab and search results (≤ 45 chars). */
    shortTitle: z.string().max(45).optional(),
    client: z.string(),
    summary: z.string().max(200),
    category: z.enum(['consulting', 'operations', 'admin', 'video', 'development', 'mobile', 'web', 'backend', 'automation', 'other']),
    platforms: z.array(z.string()).default([]),
    stack: z.array(z.string()).default([]),
    year: z.number().int().min(2000).max(2100),
    featured: z.boolean().default(false),
    source: z.enum(['upwork', 'direct', 'personal']).default('upwork'),
    links: z
      .object({
        live: z.url().optional(),
        appStore: z.url().optional(),
        playStore: z.url().optional(),
        repo: z.url().optional(),
      })
      .default({}),
    /** Optional path under /public, e.g. /work/acme-cover.png */
    cover: z.string().optional(),
    /** Date this write-up was first published on the site (not the engagement date). */
    published: z.coerce.date().optional(),
    /** Date of the last substantive edit to the write-up, if any. */
    updated: z.coerce.date().optional(),
    /** Marks starter content that must be replaced before launch. */
    placeholder: z.boolean().default(false),
  }),
});

export const collections = { projects };
