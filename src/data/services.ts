export interface Service {
  title: string;
  description: string;
  bullets: string[];
}

export const services: Service[] = [
  {
    title: 'Project & operations management',
    description:
      'Planning, tracking, delegation and reporting across teams of any size, from a single executive to a full department.',
    bullets: ['Scoping, timelines and milestones', 'Weekly reporting and async updates', 'Process design and documentation'],
  },
  {
    title: 'Systems & tools',
    description:
      'I have worked in almost every major platform. Whatever your stack is, I already know it or will master it fast.',
    bullets: ['Asana, ClickUp, Monday, Jira, Trello', 'Notion, Airtable, Confluence', 'Microsoft 365: Planner, Teams, SharePoint'],
  },
  {
    title: 'CRM & automation',
    description:
      'Lead tracking, funnels and workflow automation that remove the manual steps between a lead arriving and a deal closing.',
    bullets: ['GoHighLevel, HubSpot, Salesforce, Zoho', 'Zapier and Power Automate', 'AI-assisted workflows and reporting'],
  },
  {
    title: 'Executive support',
    description:
      'Calendar, inbox, expense reporting, research, hiring support and customer service, handled so you never think about them.',
    bullets: ['Inbox and calendar ownership', 'Hiring pipelines and onboarding', 'Vendor and customer follow-up'],
  },
  {
    title: 'Events & media',
    description:
      'Zoom webinars for 200+ attendees, livestream production and the video and design work that goes with them.',
    bullets: ['Zoom, OBS and livestream production', 'Premiere Pro, After Effects, Final Cut', 'Photoshop, Illustrator, InDesign'],
  },
  {
    title: 'Web, e-commerce & apps',
    description:
      'Content and updates on WordPress, Wix and Shopify, plus mobile and web apps when a client needs something built.',
    bullets: ['WordPress, Wix, Shopify', 'Landing pages and storefront updates', 'Mobile and web app builds'],
  },
];
