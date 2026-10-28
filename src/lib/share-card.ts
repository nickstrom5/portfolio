import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The share card scripts/make-og.mjs rendered for a page (public/og/<path>.jpg),
 * or the site-wide default card, with the base prepended. All of them are 1200×630.
 */
export function shareCard(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = base && pathname.startsWith(base + '/') ? pathname.slice(base.length) : pathname;
  const slug = path.replace(/(index)?\.html$/, '').replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
  const card = slug && existsSync(join(process.cwd(), 'public/og', `${slug}.jpg`)) ? `/og/${slug}.jpg` : '/og.png';
  return base + card;
}
