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
    kicker: 'Sales and marketing',
    tileBlurb: `Every new lead answered in seconds and followed up until they book or say no: ${count(ghl)} workflows for three sample businesses.`,
    title: 'GoHighLevel: every lead answered, every stage followed up.',
    intro: `GoHighLevel keeps a small business’s contacts, landing pages, texts, emails and calendar in one place. I set it up for three sample businesses with ${count(ghl)} workflows, each a set of automatic steps: answer a new lead in seconds, text back a missed call, remind people of their appointment, follow up on a quote, hand a won job to the crew and ask for a review. On the full page you can try every one yourself.`,
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
    kicker: 'Connects your apps, like Zapier',
    tileBlurb: `The busywork between your apps, done for you: inquiries, orders and job applications handled by ${count(n8n)} workflows for three sample businesses.`,
    title: 'n8n: the work between your apps, done for you.',
    intro: `n8n, like Zapier or Make, connects the apps a business already uses and does the busywork between them. I built ${count(n8n)} workflows for three sample businesses: a wholesale inquiry is scored and answered in seconds, a paid order lands in the right queue, an AI step reads each job application so the candidate hears back the same day, and when something breaks, a person is told. On the full page you can run each one step by step.`,
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
    kicker: 'Project management',
    tileBlurb: `Requests, deadlines and hand-offs that move on their own: ${count(clickup)} processes run by ${clickupAutomations} automations for three sample teams.`,
    title: 'ClickUp: the work that runs itself between people.',
    intro: `ClickUp is where a team keeps its tasks, projects and request forms. I set it up for three sample teams with ${count(clickup)} processes run by ${clickupAutomations} automations: a new request gets an owner and a due date, late work is flagged, and a finished step hands off to the next person without anyone chasing it. On the full page you can watch each one run on sample tasks.`,
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
    kicker: 'Project management',
    tileBlurb: `Requests that route themselves, and status that leadership can read at a glance: ${count(asana)} automations for three sample organizations.`,
    title: 'Asana: work that routes itself, and reporting nobody has to ask for.',
    intro: `Asana is where many teams plan and track their work. I set it up for three sample organizations, each with a request form, its projects, an overview for leadership and ${count(asana)} automations between them: a new request gets an owner, a deadline and a checklist, approvals go to the right person, and anything stuck is flagged before it slips. On the full page you can submit a request and watch what happens.`,
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
    kicker: 'Database and spreadsheet',
    tileBlurb: `One connected database instead of scattered spreadsheets, with ${count(airtable)} automations that send the right email when something changes.`,
    title: 'Airtable: one linked base, and the follow-up done for you.',
    intro: `Airtable looks like a spreadsheet but works like a database: its tables are linked, so each record stays connected to the people and details that belong to it. I built one for each of three sample businesses, with ${count(airtable)} automations between them: form entries matched to the right records, the right email sent when a stage changes, and scheduled checks that only speak up when a person is needed. On the full page you can run every one and see what it changes.`,
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
