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
import { cases as clickupCases } from './clickup';
import { cases as asanaCases } from './asana';
import { cases as airtableCases } from './airtable';
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
// ClickUp cases are Workspaces with processes; the tile lists the processes.
const clickup = toCases(clickupCases.map((c) => ({ business: c.workspace, automations: c.processes })));
const clickupAutomations = clickupCases.reduce((n, c) => n + c.processes.reduce((m, p) => m + p.automations.length, 0), 0);
// Asana cases are organizations, not businesses; the same fields under other names.
const asana = toCases(asanaCases.map((c) => ({ business: { ...c.org, area: c.org.size }, automations: c.automations })));
const airtable = toCases(airtableCases);
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
    tileBlurb: `Three sample businesses, ${count(n8n)} n8n workflows: forms, Shopify, Calendly, an AI résumé reader and an error workflow.`,
    title: 'n8n: the work between your apps, done for you.',
    intro: `Three sample businesses and ${count(n8n)} n8n workflows: webhooks and forms in, Shopify, Calendly and the rest of the stack wired together, an AI step that reads job applications, and an error workflow that catches what fails. On the full page you can run each one node by node in your browser.`,
    unit: 'workflows',
    href: '/n8n/',
    cta: 'Open the n8n case studies →',
    bg: surface,
    fg: '#b8325a',
    bgDark: surfaceDark,
    fgDark: '#ff8fb0',
    cases: n8n,
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    kicker: 'ClickUp · Lists, Automations and Forms',
    tileBlurb: `Three sample teams run in ClickUp: ${count(clickup)} processes and ${clickupAutomations} Automations, from client delivery to sprints.`,
    title: 'ClickUp: the work that runs itself between people.',
    intro: `Three sample teams, each a ClickUp Workspace with a working Form and ${count(clickup)} processes between them: client reviews, maintenance requests, unit turnovers, recurring inspections, bug triage, sprints and launches, run by ${clickupAutomations} Automations. On the full page you can run each process on sample tasks in your browser.`,
    unit: 'processes',
    href: '/clickup/',
    cta: 'Open the ClickUp case studies →',
    bg: surface,
    fg: '#0f766e',
    bgDark: surfaceDark,
    fgDark: '#5fd3c4',
    cases: clickup,
  },
  {
    id: 'asana',
    name: 'Asana',
    kicker: 'Asana · automations, forms and portfolios',
    tileBlurb: `Three sample organizations set up in Asana: intake forms, projects in every view, portfolios, goals and ${count(asana)} automations.`,
    title: 'Asana: work that routes itself, and reporting nobody has to ask for.',
    intro: `A marketing team, an accounting firm and a nonprofit program, each with a working intake form, its projects in List, Board, Timeline and Calendar, a portfolio and goals, and ${count(asana)} automations between them: triage, gates, approvals, reminders and escalations. On the full page you can submit a request and run each automation step by step in your browser.`,
    unit: 'automations',
    href: '/asana/',
    cta: 'Open the Asana case studies →',
    bg: surface,
    fg: '#c2410c',
    bgDark: surfaceDark,
    fgDark: '#fb923c',
    cases: asana,
  },
  {
    id: 'airtable',
    name: 'Airtable',
    kicker: 'Airtable · bases, interfaces and automations',
    tileBlurb: `Three sample businesses, each a linked Airtable base with ${count(airtable)} automations between them: forms, scripts, conditional and repeating groups.`,
    title: 'Airtable: one linked base, and the follow-up done for you.',
    intro: `Three sample businesses, each an Airtable base with linked tables, lookups, rollups, views and interfaces, and ${count(airtable)} automations between them: form submissions matched to the right records, stage changes that send the right email, and scheduled checks that stay quiet until something needs a person. On the full page you can run every automation step by step in your browser and watch what it writes to the base.`,
    unit: 'automations',
    href: '/airtable/',
    cta: 'Open the Airtable case studies →',
    bg: surface,
    fg: '#1f63c6',
    bgDark: surfaceDark,
    fgDark: '#8ab8ff',
    cases: airtable,
  },
];
