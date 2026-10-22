/** 01 · New pitch: the call-for-speakers form, matched to a speaker record, thanked and posted to Slack. */
import type { Action, Automation, Ctx, Value } from '@/lib/airtable/types';
import { fx } from '@/lib/airtable/engine';

const T = (c: Ctx) => c.trigger!;
const found = (c: Ctx) => c.out('find-speaker').records as string[];
const first = (name: string) => name.trim().split(/\s+/)[0];

const createSpeaker: Action = {
  kind: 'action',
  id: 'create-speaker',
  type: 'Create record',
  title: 'Add the new speaker',
  summary: 'Creates the speaker from the form’s answers, headshot included.',
  params: [
    { k: 'Table', v: 'Speakers' },
    { k: 'Name', v: '{Trigger › Speaker name}' },
    { k: 'Email', v: '{Trigger › Speaker email}' },
    { k: 'Company', v: '{Trigger › Company}' },
    { k: 'Headshot', v: '{Trigger › Headshot}' },
  ],
  run: (c) => ({
    log: `New speaker: ${T(c).text('Speaker name')}`,
    create: [{ table: 'Speakers', fields: { Name: T(c).get('Speaker name'), Email: T(c).get('Speaker email'), Company: T(c).get('Company'), Headshot: T(c).get('Headshot') } }],
  }),
};

const link = (id: string, title: string, from: string, ids: (c: Ctx) => string[]): Action => ({
  kind: 'action',
  id,
  type: 'Update record',
  title,
  summary: 'Links the pitch to its speaker by record ID and moves it into review.',
  params: [
    { k: 'Table', v: 'Sessions' },
    { k: 'Record ID', v: '{Trigger › Airtable record ID}' },
    { k: 'Speaker', v: from },
    { k: 'Status', v: 'In review' },
  ],
  run: (c) => ({ update: [{ table: 'Sessions', id: T(c).id, fields: { Speaker: ids(c), Status: 'In review' } }] }),
});

const thank = (id: string): Action => ({
  kind: 'action',
  id,
  type: 'Send email',
  title: 'Thank the speaker',
  summary: 'A plain note from the program team, with a real person to reply to.',
  params: [
    { k: 'To', v: '{Trigger › Speaker email}' },
    { k: 'From name', v: 'Brightwater Program' },
    { k: 'Reply to', v: 'hannah@brightwatersummits.example' },
    { k: 'Subject', v: 'We have your pitch: “{Trigger › Title}”' },
  ],
  run: (c) => ({
    messages: [
      {
        channel: 'email',
        to: fx.str(T(c).get('Speaker email')),
        subject: `We have your pitch: “${T(c).text('Title')}”`,
        body: `Hi ${first(T(c).text('Speaker name'))},\n\nThanks for pitching “${T(c).text('Title')}” for ${T(c).text('Event')}. Priya and two reviewers read every pitch, and you will hear from us within three weeks either way.\n\nIf anything changes, reply to this email and Hannah will update your pitch.\n\nThe Brightwater program team`,
      },
    ],
  }),
});

const post = (id: string): Action => ({
  kind: 'action',
  id,
  type: 'Send a Slack message',
  title: 'Tell the team',
  summary: 'Posts the pitch to #program with a link to the record.',
  params: [
    { k: 'Slack account', v: 'Brightwater (connected by Marcus)' },
    { k: 'Channel', v: '#program' },
    { k: 'Message', v: 'New pitch for {Trigger › Event}: “{Trigger › Title}” · {Trigger › Format}, {Trigger › Track} · {Trigger › Speaker name}, {Trigger › Company}' },
  ],
  run: (c) => {
    const t = T(c);
    const travel = t.get('Needs travel') as Value;
    return {
      messages: [
        {
          channel: 'slack',
          to: '#program',
          body: `New pitch for ${t.text('Event')}: “${t.text('Title')}”\n${t.text('Format')}, ${t.text('Track')} · ${t.text('Speaker name')}${t.text('Company') ? `, ${t.text('Company')}` : ''}${travel ? ' · needs travel' : ''}\nSpeaker’s pitches so far: ${c.record('Speakers', (t.get('Speaker') as string[])[0]).text('Pitches')}`,
        },
      ],
    };
  },
});

export const newPitch: Automation = {
  id: 'new-pitch',
  number: '01',
  name: 'New pitch',
  kicker: 'Form → matched, thanked, posted',
  tagline: 'Every pitch is tied to one speaker record, answered in a minute, and in front of the team on Slack.',
  problem: 'Pitches came in through a survey tool and sat in a spreadsheet. People who pitched twice showed up as two strangers, nobody knew a pitch had arrived until someone looked, and speakers waited weeks without hearing a word.',
  solution: 'The pitch form is an Airtable form on the Sessions table. When it is sent, the automation looks for the speaker by email. A conditional group then takes one of two branches: for a new speaker it creates the speaker record and links the pitch to it; otherwise it links the pitch to the speaker already there. Either way the pitch moves into review, the speaker is thanked, and the pitch is posted to the team’s #program channel.',
  trigger: {
    type: 'When a form is submitted',
    table: 'Sessions',
    view: 'Call for speakers',
    summary: 'Runs once for each pitch sent through the form. A record typed into the grid by hand does not start it.',
    params: [
      { k: 'Table', v: 'Sessions' },
      { k: 'Form', v: 'Call for speakers' },
    ],
  },
  steps: [
    {
      kind: 'action',
      id: 'find-speaker',
      type: 'Find records',
      title: 'Is this speaker already in the base?',
      summary: 'Looks in Speakers for a record with the email from the form.',
      params: [
        { k: 'Table', v: 'Speakers' },
        { k: 'Find records based on', v: 'Condition' },
        { k: 'Condition', v: 'Email is {Trigger › Speaker email}' },
      ],
      run: (c) => {
        const email = fx.str(T(c).get('Speaker email')).trim().toLowerCase();
        const recs = c.records('Speakers').filter((r) => fx.str(r.get('Email')).trim().toLowerCase() === email);
        return { log: recs.length ? `Found ${recs.length}: ${recs.map((r) => r.name).join(', ')}` : 'No records found', output: { records: recs.map((r) => r.id), names: recs.map((r) => r.name) } };
      },
    },
    {
      kind: 'if',
      id: 'g-speaker',
      branches: [
        {
          name: 'New speaker',
          when: 'Find records › Records is empty',
          test: (c) => found(c).length === 0,
          steps: [createSpeaker, link('link-new', 'Link the pitch to the new speaker', '{Create record › Airtable record ID}', (c) => [c.out('create-speaker').record as string]), thank('ack-new'), post('slack-new')],
        },
        { name: 'Returning speaker', steps: [link('link-existing', 'Link the pitch to the existing speaker', '{Find records › Records › Airtable record ID}', found), thank('ack-known'), post('slack-known')] },
      ],
    },
  ],
  notify: 'Marcus Webb',
  scenarios: [
    {
      id: 'new-speaker',
      label: 'A first-time speaker',
      summary: 'Rafael has never pitched before: a speaker record is created and linked.',
      start: 1440 + 642,
      form: {
        Title: 'Cold-chain routes on half the fuel',
        'Speaker name': 'Rafael Mendes',
        'Speaker email': 'rafael@coldline.example',
        Company: 'Coldline Freight',
        Format: 'Talk',
        Track: 'Supply chain',
        Abstract: 'How a 30-truck fleet cut fuel use by planning refrigerated routes around loading-dock times instead of distance.',
        Headshot: ['rafael-mendes.jpg'],
        Event: ['recEvtSum'],
        'Needs travel': true,
      },
      expect: { status: 'success', visits: ['create-speaker', 'link-new', 'ack-new', 'slack-new', 'g-speaker:0'], skips: ['link-existing', 'ack-known'], emails: 1 },
    },
    {
      id: 'returning',
      label: 'A speaker who has pitched before',
      summary: 'Mara spoke in Seattle; her new pitch links to her existing record, and her count goes up.',
      start: 2 * 1440 + 845,
      form: {
        Title: 'What 400 supplier scorecards taught us',
        'Speaker name': 'Mara Okafor',
        'Speaker email': 'mara@tidewell.example',
        Company: 'Tidewell Logistics',
        Format: 'Keynote',
        Track: 'Supply chain',
        Abstract: 'Two years of scoring suppliers on emissions, on-time rate and responsiveness: what moved, what did not, and what we stopped measuring.',
        Event: ['recEvtSum'],
      },
      expect: { status: 'success', visits: ['link-existing', 'ack-known', 'slack-known', 'g-speaker:1'], skips: ['create-speaker', 'link-new'], emails: 1 },
    },
    {
      id: 'slack-expired',
      label: 'The Slack connection has expired',
      summary: 'The pitch is linked and the speaker thanked; only the Slack post fails, and Marcus hears about it.',
      start: 3 * 1440 + 1210,
      form: {
        Title: 'Repairable office furniture, procured',
        'Speaker name': 'Lena Fischer',
        'Speaker email': 'lena@oakline.example',
        Company: 'Oakline Interiors',
        Format: 'Panel',
        Track: 'Operations',
        Abstract: 'A panel of three buyers on writing repairability into furniture tenders, and what it did to five-year costs.',
        Event: ['recEvtPdx'],
      },
      failures: { 'slack-new': 'The Slack account for this action needs to be reconnected.' },
      expect: { status: 'failed', visits: ['create-speaker', 'link-new', 'ack-new'], skips: ['slack-new'], emails: 1 },
    },
  ],
  fields: [
    { table: 'Sessions', field: 'Speaker email', use: 'Matched against Speakers › Email.' },
    { table: 'Sessions', field: 'Speaker', use: 'Set by record ID, from Create record or Find records.' },
    { table: 'Sessions', field: 'Status', use: 'Set to In review, which puts the pitch in the Review queue interface.' },
    { table: 'Speakers', field: 'Name, Email, Company, Headshot', use: 'Filled from the form when the speaker is new.' },
    { table: 'Speakers', field: 'Pitches', use: 'A count of linked sessions, quoted in the Slack post.' },
  ],
  build: [
    { title: 'A form trigger, not “record created”', body: '“When a record is created” fires the moment someone presses + in the grid, before anything is typed. “When a form is submitted” fires only for the form, with every answer in place.' },
    { title: 'Find, then one group with two branches', body: 'The If branch runs when Find records came back empty; Otherwise covers the returning speaker, so exactly one runs. The new-speaker branch creates the speaker first, then uses its record ID in the update.' },
    { title: 'The group is the last step', body: 'In Airtable nothing can follow a conditional group, so the thank-you email and the Slack post sit inside both branches. They read the same in each; only the step IDs differ.' },
    { title: 'Links by record ID', body: 'Update record sets Speaker from Create record › Airtable record ID or Find records › Records › Airtable record ID. Setting a link field from typed text would match on the primary field’s name and could pick the wrong Ana.' },
    { title: 'The automation sets Status', body: 'The form does not show Status. The automation sets In review, so a pitch with an empty Status is a sign the run failed, and the All pitches view groups it where it stands out.' },
    { title: 'Slack goes last in each branch', body: 'It is the one step that depends on an outside connection. If it fails, the pitch is already linked and the speaker already thanked; only the Slack post is missing.' },
    { title: 'A person behind the email', body: 'From name is “Brightwater Program” and Reply to is Hannah’s address, so a speaker’s reply reaches someone instead of a no-reply box.' },
  ],
  edgeCases: [
    { title: 'Two pitches from a new speaker a minute apart', body: 'Runs can overlap, so both can find no speaker and create two. The Speakers view “Duplicates”, grouped by a LOWER(TRIM(Name)) formula, shows them; Marcus merges them monthly.' },
    { title: 'A second pitch from a different address', body: 'A personal address instead of a work one does not match, so a second speaker record is made. The same Duplicates view catches it by name.' },
    { title: 'Slack is disconnected', body: 'The run stops at the Slack step and shows as Failed in the run history. The record and the email are not undone. Airtable emails Marcus, who reconnects Slack; the missed post is in the Review queue anyway.' },
    { title: 'Someone types a pitch into the grid', body: 'Nothing runs, by design: only form submissions start this automation. Pitches taken by phone go through the form too.' },
    { title: 'A pitch for an event that just closed', body: 'The form’s Event picker reads the Events view “Open for pitches”. When Dev sets an event to Program locked, it disappears from the picker for the next visitor.' },
  ],
  qa: [
    'A new email creates exactly one speaker and links the pitch to it.',
    'A known email links to the existing speaker and creates nothing in Speakers.',
    'Status is In review after every successful run.',
    'The thank-you email names the right event and the reply goes to Hannah.',
    'With Slack disconnected, the run fails at Slack only and Marcus gets the failure email.',
    'A record added in the grid does not start the automation.',
  ],
  features: ['Form view', 'When a form is submitted', 'Find records', 'Conditional group with Otherwise', 'Create record', 'Update record', 'Link to another record', 'Count field', 'Send email', 'Send a Slack message'],
};
