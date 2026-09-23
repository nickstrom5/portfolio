/**
 * Identity for yetour.info. Single source of truth for anything that appears
 * on every page.
 */
export const site = {
  name: 'YE TOUR',
  domain: 'yetour.info',
  url: 'https://yetour.info',
  title: 'YE — Live Concert Tour 2026',
  tagline: 'An unofficial, sourced archive of every date on the 2026 Ye Live Concert Tour.',
  /** Who built it, for the byline and the JSON-LD publisher node. */
  author: 'Nick Soderstrom',
  authorUrl: 'https://work-with-nick.com',
  /** The official tour site the header button points at. */
  official: 'https://tour.yeezy.com/ye-tour',
  /** Shown in the footer so readers know how fresh the data is. */
  compiled: '20 September 2026',
} as const;
