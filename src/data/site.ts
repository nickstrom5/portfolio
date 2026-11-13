/**
 * Single source of truth for identity, links and copy that appears on every page.
 * Edit this file first when personalizing the site.
 */
/** Completed contracts on Upwork (the profile's "Total jobs"), quoted across the site. */
const upworkJobs = 258;

export const site = {
  name: 'Nick Soderstrom',
  firstName: 'Nick',
  role: 'Senior project manager & operations lead',
  tagline:
    'I take ownership of the moving parts, projects, timelines, tools, people and processes, so you can stay focused on growth.',
  /** Canonical URL. Update once the domain is registered and DNS is live. */
  url: 'https://work-with-nick.com',
  location: 'Chicago, IL · Remote (US) or onsite Chicago',
  email: 'hello@work-with-nick.com',
  /** Replace with your real profile URLs. */
  links: {
    upwork: 'https://www.upwork.com/freelancers/~01f494a703078d9515',
    linkedin: 'https://www.linkedin.com/in/nick-soderstrom/',
    github: 'https://github.com/nickstrom5',
    calendly: 'https://calendly.com/nickstrom5',
    appStoreDeveloper: 'https://apps.apple.com/us/developer/nicholas-d-soderstrom/id6814555256',
    playStoreDeveloper: '',
  },
  upworkJobs,
  /** Headline numbers shown in the hero. Taken from the Upwork profile, November 2026. */
  stats: [
    { value: '300+', label: 'Client contracts', note: `${upworkJobs} on Upwork` },
    { value: '18,000+', label: 'Freelance hours billed' },
    { value: '100%', label: 'Job success score' },
    { value: 'Top 1%', label: 'Top Rated Plus on Upwork' },
  ],
  availability: 'Open to full-time and freelance roles',
  /** Path under /public, for structured data and link previews. The page portraits use the
      copy at src/assets/nick-soderstrom.jpg, served resized; replace both together. */
  photo: '/nick-soderstrom.jpg',
  /** Path under /public. Regenerate with `npm run resume:pdf` after editing experience.ts. */
  resumePdf: '/Nick-Soderstrom-Resume.pdf',
  /**
   * Contact form endpoint (e.g. a Formspree or Basin URL). Leave empty to
   * fall back to a plain email link. Nothing is posted anywhere until you set it.
   */
  contactEndpoint: 'https://formspree.io/f/xvkggbvq',
} as const;

/**
 * Footer links. The top nav is the same list minus the footer-only ones below.
 * Work is the Clients page (/clients); the full case-study list at /work is
 * linked from there, the home page and the case studies, and the platform
 * pages (GHL, n8n…) from Case studies.
 */
export const footerNav = [
  { href: '/clients', label: 'Work' },
  { href: '/case-studies', label: 'Case studies' },
  { href: '/apps', label: 'AI Projects' },
  { href: '/resume', label: 'Resume' },
  { href: '/about', label: 'About' },
] as const;

/**
 * Header/nav: the footer links minus Case studies, which stays in the footer
 * only and is reached from the home page and its card on AI Projects. Resume is
 * in the header so a recruiter landing on any page is one click from it; the
 * header also carries a Hire me button (Nav.astro).
 */
const footerOnly: string[] = ['/case-studies'];
export const nav = footerNav.filter((item) => !footerOnly.includes(item.href));
