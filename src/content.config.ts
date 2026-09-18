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
    client: z.string(),
    summary: z.string().max(200),
    category: z.enum(['mobile', 'web', 'backend', 'automation', 'other']),
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
    /** Marks starter content that must be replaced before launch. */
    placeholder: z.boolean().default(false),
  }),
});

export const collections = { projects };
