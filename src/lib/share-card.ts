import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The share card scripts/make-og.mjs rendered for a page (public/og/<path>.jpg),
 * or the site-wide default card. All of them are 1200×630.
 */
export function shareCard(pathname: string): string {
  const slug = pathname.replace(/(index)?\.html$/, '').replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
  return slug && existsSync(join(process.cwd(), 'public/og', `${slug}.jpg`)) ? `/og/${slug}.jpg` : '/og.png';
}
