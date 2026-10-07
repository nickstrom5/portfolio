import { execFileSync } from 'node:child_process';

/**
 * Date of the last commit that touched any of `paths`, as ISO 8601, or
 * undefined outside a git checkout. The sitemap's <lastmod> and each case
 * study's dateModified both come from here, so they always agree. Needs
 * full git history in CI (fetch-depth: 0).
 * @param {string[]} paths
 * @returns {string | undefined}
 */
export function lastCommit(paths) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', ...paths], { encoding: 'utf8' }).trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Files behind a case study's page: its write-up plus the template, card and
 * feedback it renders. The sitemap and the page's dateModified both use this.
 * @param {string} id
 */
export const projectSources = (id) => [`src/content/projects/${id}.md`, 'src/pages/work/[slug].astro', 'src/components/ProjectCard.astro', 'src/data/testimonials.json'];
