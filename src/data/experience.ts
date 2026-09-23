/** Work history, newest first. Mirrors the LinkedIn experience section. */
export interface Role {
  title: string;
  company: string;
  start: string;
  end: string;
  location: string;
  summary: string;
  /** Optional case-study slug under /work. */
  slug?: string;
}

export const experience: Role[] = [
  {
    title: 'Operations & Project Manager · Chief of Staff',
    company: 'Freelance',
    start: '2015',
    end: 'Present',
    location: 'Chicago, IL · Remote',
    summary: 'Independent operations and project work for clients across many industries, mostly through Upwork.',
  },
  {
    title: 'Digital Coordinator',
    company: 'SPARC.science',
    start: '2022',
    end: '2026',
    location: 'Bethesda, MD · Remote',
    summary: 'Four years and 3,700+ hours supporting the SPARC Portal, an open neuroscience research platform.',
    slug: 'sparc-portal-digital-coordinator',
  },
  {
    title: 'Account Manager',
    company: 'OFFX · Office Experience Company',
    start: '2024',
    end: '2025',
    location: 'California · Remote',
    summary: 'Managed client relationships and kept orders on track from placement through delivery.',
    slug: 'offx-account-management',
  },
  {
    title: 'Jr. Marketing Manager',
    company: 'Blackdove Art',
    start: '2022',
    end: '2024',
    location: 'Miami, FL · Remote',
    summary: 'Guided clients from first touch through the sales and onboarding journey for a digital art platform.',
    slug: 'blackdove-client-journey',
  },
  {
    title: 'Project Manager · Video Production',
    company: 'BARBRI',
    start: '2023',
    end: '2024',
    location: 'Dallas, TX · Remote',
    summary: 'Tracked post-production on hundreds of video courses, managing timelines with professors and creatives.',
    slug: 'barbri-video-production',
  },
  {
    title: 'Project Manager',
    company: 'Symplicity',
    start: '2018',
    end: '2022',
    location: 'Virginia · Remote',
    summary: 'Coordinated with many colleges and internal groups to keep design projects on track for nearly four years.',
    slug: 'symplicity-design-projects',
  },
  {
    title: 'Executive Assistant',
    company: 'Rippling',
    start: '2019',
    end: '2020',
    location: 'California · Remote',
    summary: 'Scheduling and project coordination for multiple executives.',
    slug: 'rippling-executive-support',
  },
  {
    title: 'Restaurant Manager',
    company: 'Pizzeria Bebu',
    start: '2017',
    end: '2018',
    location: 'Chicago, IL',
    summary: 'Opening-day team of a restaurant that went on to earn a Michelin Bib Gourmand.',
  },
];

/** Roles other than the umbrella freelance entry, newest end date first. */
export const roles: Role[] = experience
  .filter((r) => r.company !== 'Freelance')
  .sort((a, b) => {
    const endA = a.end === 'Present' ? 9999 : Number(a.end);
    const endB = b.end === 'Present' ? 9999 : Number(b.end);
    return endB - endA || Number(b.start) - Number(a.start);
  });

export const education = [
  { school: 'DePaul University', location: 'Chicago, IL', url: 'https://www.depaul.edu/', sameAs: 'https://en.wikipedia.org/wiki/DePaul_University' },
];
