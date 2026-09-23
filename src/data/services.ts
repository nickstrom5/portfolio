export interface Service {
  title: string;
  description: string;
  bullets: string[];
  /** Case studies or pages that show this service, linked from the home page card. */
  links?: { href: string; label: string }[];
}

export const services: Service[] = [
  {
    title: 'Project & operations management',
    description:
      'Planning, tracking, delegation and reporting across teams of any size, from a single executive to a full department.',
    bullets: ['Scoping, timelines and milestones', 'Weekly reporting and async updates', 'Process design and documentation'],
    links: [{ href: '/work/symplicity-design-projects', label: 'Project management at Symplicity' }],
  },
  {
    title: 'Systems & tools',
    description:
      'I have worked in almost every major platform. Whatever your stack is, I already know it or will master it fast.',
    bullets: ['Asana, ClickUp, Monday, Jira, Trello', 'Notion, Airtable, Confluence', 'Microsoft 365: Planner, Teams, SharePoint'],
    links: [{ href: '/work/zoho-one-admin-association-chapter', label: 'Zoho One administration case study' }],
  },
  {
    title: 'CRM & automation',
    description:
      'Lead tracking, funnels and workflow automation that remove the manual steps between a lead arriving and a deal closing.',
    bullets: ['GoHighLevel, HubSpot, Salesforce, Zoho', 'Zapier and Power Automate', 'AI-assisted workflows and reporting'],
    links: [
      { href: '/ghl', label: 'GoHighLevel automation case studies' },
      { href: '/work/sales-org-zapier-hubspot-automation', label: 'Zapier and HubSpot automation case study' },
    ],
  },
  {
    title: 'Executive assistant support',
    description:
      'Calendar, inbox, expense reporting, research, hiring support and customer service, handled so you never think about them.',
    bullets: ['Inbox and calendar ownership', 'Hiring pipelines and onboarding', 'Vendor and customer follow-up'],
    links: [{ href: '/work/data-trust-ceo-executive-assistant', label: 'Executive assistant case study' }],
  },
  {
    title: 'Webinars, events & video',
    description:
      'Zoom webinars for 200+ attendees, livestream production and the video and design work that goes with them.',
    bullets: ['Zoom, OBS and livestream production', 'Premiere Pro, After Effects, Final Cut', 'Photoshop, Illustrator, InDesign'],
    links: [{ href: '/work/association-president-webinars-support', label: 'Webinar production case study' }],
  },
  {
    title: 'AI-directed builds, web & apps',
    description:
      'Websites, tools and iPhone apps built by directing Claude and Grok from a clear brief, plus content and updates on WordPress, Wix and Shopify.',
    bullets: ['Claude Code & Grok, prompt to production', 'Astro sites, SwiftUI apps, GitHub Pages', 'WordPress, Wix, Shopify updates'],
    links: [{ href: '/apps', label: 'Apps and sites built with AI' }],
  },
];
