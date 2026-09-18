/**
 * Single source of truth for identity, links and copy that appears on every page.
 * Edit this file first when personalizing the site.
 */
export const site = {
  name: 'Nick Soderstrom',
  firstName: 'Nick',
  role: 'Freelance software & mobile app developer',
  tagline: 'I ship web and mobile products for clients who need them done right, on time.',
  /** Canonical URL. Update once the domain is registered and DNS is live. */
  url: 'https://nicksoderstrom.com',
  location: 'Greater Chicago Area · Remote worldwide',
  email: 'nicholas.soderstrom@insidesuccess.com',
  /** Replace with your real profile URLs. */
  links: {
    upwork: 'https://www.upwork.com/freelancers/~REPLACE_WITH_YOUR_ID',
    linkedin: 'https://www.linkedin.com/in/REPLACE_WITH_YOUR_HANDLE',
    github: '',
    appStoreDeveloper: '',
    playStoreDeveloper: '',
  },
  /** Headline numbers shown in the hero. Pull the real figures from your Upwork profile. */
  stats: [
    { value: '8+', label: 'Years freelancing' },
    { value: '100+', label: 'Client projects' },
    { value: '20+', label: 'Mobile apps shipped' },
    { value: '100%', label: 'Job success on Upwork' },
  ],
  availability: 'Available for new projects',
  /**
   * Contact form endpoint (e.g. a Formspree or Basin URL). Leave empty to
   * fall back to a plain email link. Nothing is posted anywhere until you set it.
   */
  contactEndpoint: '',
} as const;

export const nav = [
  { href: '/work', label: 'Work' },
  { href: '/apps', label: 'Apps' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;
