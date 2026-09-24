/**
 * JSON-LD builders shared by Base.astro and the standalone /resume/ page, so
 * every indexable page describes the same WebSite and Person entities.
 */
import { site } from '@/data/site';
import { education } from '@/data/experience';

export const ids = {
  website: `${site.url}/#website`,
  person: `${site.url}/#person`,
  profile: `${site.url}/about/#webpage`,
};

export const sameAs = Object.values(site.links).filter((l) => l && !l.includes('REPLACE'));

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': ids.website,
    url: `${site.url}/`,
    name: site.name,
    alternateName: ['Work with Nick', 'work-with-nick.com'],
    description: site.tagline,
    inLanguage: 'en-US',
    publisher: { '@id': ids.person },
  };
}

export function personNode() {
  return {
    '@type': 'Person',
    '@id': ids.person,
    name: site.name,
    alternateName: ['Nicholas Soderstrom', 'Nick S.'],
    givenName: 'Nick',
    familyName: 'Soderstrom',
    jobTitle: `Freelance ${site.role.toLowerCase()}`,
    description: `${site.name} is a freelance ${site.role.toLowerCase()} based in Chicago. Freelance since 2015, 300+ client contracts, Top Rated Plus on Upwork with 100% Job Success.`,
    url: `${site.url}/`,
    mainEntityOfPage: { '@id': ids.profile },
    email: `mailto:${site.email}`,
    image: `${site.url}${site.photo}`,
    address: { '@type': 'PostalAddress', addressLocality: 'Chicago', addressRegion: 'IL', addressCountry: 'US' },
    alumniOf: education.map((e) => ({ '@type': 'CollegeOrUniversity', name: e.school, url: e.url, sameAs: e.sameAs })),
    sameAs,
    knowsAbout: [
      'Project management',
      'Operations management',
      'Executive support',
      'CRM automation',
      'GoHighLevel',
      'HubSpot',
      'Zapier',
      'Zoho One',
      'Microsoft 365',
      'Webinar production',
      'AI-assisted software development',
    ],
  };
}
