/**
 * Builds an internal href: prefixes the configured base (for project-page
 * GitHub Pages deploys) and normalizes to a trailing slash so links match the
 * canonical URLs and sitemap exactly, avoiding a redirect hop on every click.
 */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let p = path.startsWith('/') ? path : `/${path}`;
  const [pathname, rest] = splitSuffix(p);
  const hasExtension = /\.[a-z0-9]+$/i.test(pathname);
  const normalized = hasExtension || pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${base}${normalized}${rest}` || '/';
}

function splitSuffix(p: string): [string, string] {
  const i = p.search(/[#?]/);
  return i === -1 ? [p, ''] : [p.slice(0, i), p.slice(i)];
}
