/**
 * The Case studies page (/case-studies): one tile per platform, each opening a
 * panel below with that platform's sample businesses and links into its full,
 * interactive page (/ghl/, /n8n/…). Names, blurbs and workflow lists come from
 * each platform's own data, so this page can't drift from the pages it summarizes.
 *
 * To add a platform: build its page and data first, then add one entry here.
 */
import { cases as ghlCases } from './ghl';
import { cases as n8nCases } from './n8n';
import { surface, surfaceDark } from './showcase';

export interface PlatformCase {
  /** The case's id on its platform page; `/ghl/#roofing` opens it. */
  id: string;
  name: string;
  industry: string;
  area: string;
  blurb: string;
  tint: { light: string; dark: string };
  /** Workflow (or automation) names, in the order the platform page shows them. */
  workflows: string[];
}

export interface Platform {
  /** Tile and panel id, and the hash that opens it: /case-studies/#n8n. */
  id: string;
  /** Tile title. */
  name: string;
  kicker: string;
  tileBlurb: string;
  /** Panel heading and intro. */
  title: string;
  intro: string;
  /** What the platform calls a workflow, plural: "workflows", "automations", "rules". */
  unit: string;
  /** Site-relative path of the full page, e.g. /ghl/. */
  href: string;
  /** Label for the link to the full page. */
  cta: string;
  bg: string;
  fg: string;
  bgDark: string;
  fgDark: string;
  cases: PlatformCase[];
}

// A minimal shape both platform data sets share.
type SourceCase = {
  business: Pick<PlatformCase, 'id' | 'name' | 'industry' | 'area' | 'blurb' | 'tint'>;
  automations: { name: string }[];
};
const toCases = (list: SourceCase[]): PlatformCase[] =>
  list
    // A platform page hides a case until it has workflows; so does this page.
    .filter((c) => c.automations.length > 0)
    .map(({ business: b, automations }) => ({
      id: b.id,
      name: b.name,
      industry: b.industry,
      area: b.area,
      blurb: b.blurb,
      tint: b.tint,
      workflows: automations.map((a) => a.name),
    }));

const ghl = toCases(ghlCases);
const n8n = toCases(n8nCases);
const count = (cases: PlatformCase[]) => cases.reduce((n, c) => n + c.workflows.length, 0);

export const platforms: Platform[] = [
  {
    id: 'ghl',
    name: 'GoHighLevel',
    kicker: 'GHL · workflows and funnels',
    tileBlurb: `Automatic follow-up for three sample businesses: ${count(ghl)} GoHighLevel workflows and their landing pages.`,
    title: 'GoHighLevel: every lead answered, every stage followed up.',
    intro: `Three sample businesses, each a GoHighLevel sub-account with a working landing page and ${count(ghl)} workflows between them: speed to lead, missed-call text-back, booking reminders, follow-up, hand-offs and reviews. On the full page you can run every workflow step by step in your browser.`,
    unit: 'workflows',
    href: '/ghl/',
    cta: 'Open the GoHighLevel case studies →',
    bg: surface,
    fg: '#5e56c7',
    bgDark: surfaceDark,
    fgDark: '#a8aaff',
    cases: ghl,
  },
  {
    id: 'n8n',
    name: 'n8n',
    kicker: 'n8n · workflows, webhooks and APIs',
    tileBlurb: `Three sample businesses, ${count(n8n)} n8n workflows: forms, Shopify, Stripe, an AI ticket classifier and an error workflow.`,
    title: 'n8n: the work between your apps, done for you.',
    intro: `Three sample businesses and ${count(n8n)} n8n workflows: webhooks and forms in, Shopify, Stripe and the rest of the stack wired together, an AI step that sorts support tickets, and an error workflow that catches what fails. On the full page you can run each one node by node in your browser.`,
    unit: 'workflows',
    href: '/n8n/',
    cta: 'Open the n8n case studies →',
    bg: surface,
    fg: '#b8325a',
    bgDark: surfaceDark,
    fgDark: '#ff8fb0',
    cases: n8n,
  },
];
