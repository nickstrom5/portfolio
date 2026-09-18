/** Prefixes an internal path with the configured base (needed for project-page GitHub Pages deploys). */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (!path.startsWith('/')) return `${base}/${path}`;
  return `${base}${path}` || '/';
}
