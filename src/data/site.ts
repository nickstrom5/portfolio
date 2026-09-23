/**
 * Single source of truth for identity, links and copy that appears on every page.
 * Edit this file first when personalizing the site.
 */
export const site = {
  name: 'Nick Soderstrom',
  firstName: 'Nick',
  role: 'Senior project manager & operations lead',
  tagline:
    'I take ownership of the moving parts, projects, timelines, tools, people and processes, so you can stay focused on growth.',
  /** Canonical URL. Update once the domain is registered and DNS is live. */
  url: 'https://work-with-nick.com',
  location: 'Chicago, IL · Remote worldwide',
  email: 'hello@work-with-nick.com',
  /** Replace with your real profile URLs. */
  links: {
    upwork: 'https://www.upwork.com/freelancers/~01f494a703078d9515',
    linkedin: 'https://www.linkedin.com/in/nick-soderstrom/',
    github: 'https://github.com/nickstrom5',
    appStoreDeveloper: '',
    playStoreDeveloper: '',
  },
  /** Headline numbers shown in the hero. Taken from the Upwork profile, September 2026. */
  stats: [
    { value: '300+', label: 'Client contracts', note: '257 on Upwork' },
    { value: '18,000+', label: 'Hours billed' },
    { value: '100%', label: 'Job success score' },
    { value: 'Top 1%', label: 'Top Rated Plus on Upwork' },
  ],
  badges: ['Top Rated Plus', '100% Job Success', 'Freelance since 2015'],
  availability: 'Open for work',
  /** Path under /public. */
  photo: '/nick-soderstrom.jpg',
  /** Path under /public. Regenerate with `npm run resume:pdf` after editing experience.ts. */
  resumePdf: '/Nick-Soderstrom-Resume.pdf',
  /**
   * Contact form endpoint (e.g. a Formspree or Basin URL). Leave empty to
   * fall back to a plain email link. Nothing is posted anywhere until you set it.
   */
  contactEndpoint: 'https://formspree.io/f/xvkggbvq',
} as const;

export const footerNav = [
  { href: '/work', label: 'Work' },
  { href: '/clients', label: 'Clients' },
  { href: '/apps', label: 'AI/Projects' },
  { href: '/ghl', label: 'GoHighLevel automations' },
  { href: '/resume', label: 'Resume' },
  { href: '/about', label: 'About' },
] as const;

/** Header/nav only. Resume and the GHL showcase stay in the footer, not the top nav. */
export const nav = footerNav.filter((item) => item.href !== '/resume' && item.href !== '/ghl');
