/** The “Brightwater Program” base: four tables, their views, and the interfaces the team works in. */
import type { BaseSchema } from '@/lib/airtable/types';
import { fx } from '@/lib/airtable/engine';

const accepted = { text: 'Status is Accepted', test: (g: (f: string) => unknown) => g('Status') === 'Accepted' };
const within = (d: number | null, days: number) => d !== null && d >= 0 && d <= days;

export const base: BaseSchema = {
  name: 'Brightwater Program',
  workspace: 'Brightwater Summits',
  plan: 'Team',
  tables: [
    {
      name: 'Sessions',
      description: 'One record per pitch. The form creates them; the ones accepted become the program.',
      fields: [
        { name: 'Title', type: 'Single line text', note: 'Primary field: the talk’s title, as the speaker wrote it.' },
        { name: 'Speaker name', type: 'Single line text', note: 'As typed on the form. The link to Speakers is set by automation 01.' },
        { name: 'Speaker email', type: 'Email' },
        { name: 'Company', type: 'Single line text' },
        { name: 'Format', type: 'Single select', options: ['Keynote', 'Talk', 'Panel', 'Workshop'] },
        { name: 'Track', type: 'Single select', options: ['Operations', 'Supply chain', 'Finance', 'People'] },
        { name: 'Abstract', type: 'Long text' },
        { name: 'Headshot', type: 'Attachment' },
        { name: 'Event', type: 'Link to another record', link: 'Events', note: 'On the form, limited to the Events view “Open for pitches”, so nobody pitches to a locked program.' },
        { name: 'Speaker', type: 'Link to another record', link: 'Speakers', note: 'One speaker record per person, however many times they pitch.' },
        { name: 'Status', type: 'Single select', options: ['In review', 'Accepted', 'Declined'], note: 'Set to In review by automation 01; reviewers move it from the Review queue interface.' },
        { name: 'Score', type: 'Rating', note: 'Reviewers’ score, 1 to 5.' },
        { name: 'Needs travel', type: 'Checkbox', note: 'Asked on the form. Decides whether a travel task is made.' },
        { name: 'Event date', type: 'Rollup', via: 'Event', of: 'Starts', agg: { text: 'MIN(values)', fn: fx.min }, format: 'date', note: 'A rollup, not a lookup, so formulas get one date instead of a list.' },
        { name: 'Slides due', type: 'Formula', formula: { text: "DATEADD({Event date}, -7, 'days')", fn: (g) => fx.addDays(g('Event date'), -7) }, format: 'date' },
        { name: 'Book travel by', type: 'Formula', formula: { text: "DATEADD({Event date}, -30, 'days')", fn: (g) => fx.addDays(g('Event date'), -30) }, format: 'date' },
        { name: 'Slides', type: 'Attachment' },
        {
          name: 'Slides status',
          type: 'Formula',
          formula: {
            text: 'IF({Status} != "Accepted", "",\n  IF({Slides}, "Received",\n    IF(IS_BEFORE({Slides due}, TODAY()), "Overdue", "Waiting")))',
            fn: (g, today) => (g('Status') !== 'Accepted' ? null : !fx.empty(g('Slides')) ? 'Received' : (fx.daysBetween(g('Slides due'), today) ?? 0) < 0 ? 'Overdue' : 'Waiting'),
          },
        },
        { name: 'Welcome sent', type: 'Checkbox', note: 'Ticked by automation 02 and part of its conditions, so moving Status away and back cannot send the welcome twice.' },
        { name: 'Status changed', type: 'Last modified time', watch: ['Status'], note: 'Only watches Status, so it dates the decision, not the last typo fix.' },
        { name: 'Submitted', type: 'Created time' },
        { name: 'Tasks', type: 'Link to another record', link: 'Tasks', mirror: 'Session' },
      ],
      records: [
        { id: 'recSes01', f: { Title: 'Supplier scorecards suppliers actually like', 'Speaker name': 'Mara Okafor', 'Speaker email': 'mara@tidewell.example', Company: 'Tidewell Logistics', Format: 'Talk', Track: 'Supply chain', Event: ['recEvtSea'], Speaker: ['recSpk01'], Status: 'Accepted', Score: 5, 'Welcome sent': true, 'Status changed': '2026-01-28T10:12:00', Submitted: '2026-01-09T08:40:00' } },
        { id: 'recSes02', f: { Title: 'Closing the books in three days', 'Speaker name': 'Jun Watanabe', 'Speaker email': 'jun@ferncastle.example', Company: 'Ferncastle Foods', Format: 'Talk', Track: 'Finance', Event: ['recEvtSea'], Speaker: ['recSpk02'], Status: 'Accepted', Score: 4, 'Welcome sent': true, 'Status changed': '2026-01-28T10:15:00', Submitted: '2026-01-12T15:02:00' } },
        { id: 'recSes03', f: { Title: 'Hiring operations people who stay', 'Speaker name': 'Ana Lima', 'Speaker email': 'ana.lima@northrow.example', Company: 'Northrow Apparel', Format: 'Panel', Track: 'People', Event: ['recEvtSea'], Speaker: ['recSpk03'], Status: 'Accepted', Score: 4, Slides: ['ops-hiring-panel.pdf'], 'Welcome sent': true, 'Status changed': '2026-01-28T10:20:00', Submitted: '2026-01-14T11:30:00' } },
        { id: 'recSes04', f: { Title: 'Heat pumps for warehouses, hands on', 'Speaker name': 'Tomas Berg', 'Speaker email': 'tomas@gridleaf.example', Company: 'Gridleaf Energy', Format: 'Workshop', Track: 'Operations', Event: ['recEvtSea'], Speaker: ['recSpk04'], Status: 'Accepted', Score: 5, 'Needs travel': true, 'Welcome sent': true, 'Status changed': '2026-01-29T09:05:00', Submitted: '2026-01-15T16:45:00' } },
        { id: 'recSes05', f: { Title: 'Packaging returns without the waste', 'Speaker name': 'Ana Lima', 'Speaker email': 'ana.lima@northrow.example', Company: 'Northrow Apparel', Format: 'Talk', Track: 'Supply chain', Event: ['recEvtSum'], Speaker: ['recSpk03'], Status: 'In review', Score: 4, 'Status changed': '2026-02-16T13:00:00', Submitted: '2026-02-16T12:58:00' } },
        { id: 'recSes06', f: { Title: 'Running a repair café at work', 'Speaker name': 'Jun Watanabe', 'Speaker email': 'jun@ferncastle.example', Company: 'Ferncastle Foods', Format: 'Workshop', Track: 'People', Event: ['recEvtSum'], Speaker: ['recSpk02'], Status: 'In review', Score: 5, 'Needs travel': true, 'Status changed': '2026-02-20T09:31:00', Submitted: '2026-02-20T09:30:00' } },
        { id: 'recSes07', f: { Title: 'Carbon accounting for small teams', 'Speaker name': 'Tomas Berg', 'Speaker email': 'tomas@gridleaf.example', Company: 'Gridleaf Energy', Format: 'Talk', Track: 'Finance', Event: ['recEvtSum'], Speaker: ['recSpk04'], Status: 'Declined', Score: 2, 'Status changed': '2026-02-25T17:40:00', Submitted: '2026-02-11T10:10:00' } },
      ],
      views: [
        { name: 'All pitches', type: 'Grid', purpose: 'The whole pipeline, for Priya.', setup: ['Group: Event, then Status', 'Sort: Submitted, newest first'] },
        { name: 'Review board', type: 'Kanban', purpose: 'Where the team talks through pitches on Tuesdays.', setup: ['Stacked by: Status', 'Card cover: Headshot', 'Filter: Status is not Declined'] },
        {
          name: 'Call for speakers',
          type: 'Form',
          purpose: 'The public pitch form, linked from the website.',
          setup: ['Event picker limited to the Events view “Open for pitches”', 'Redirect after submit: the speaker FAQ page'],
          fields: ['Title', 'Speaker name', 'Speaker email', 'Company', 'Format', 'Track', 'Abstract', 'Headshot', 'Event', 'Needs travel'],
          required: ['Title', 'Speaker name', 'Speaker email', 'Format', 'Event', 'Abstract'],
        },
        {
          name: 'Missing slides · next 14 days',
          type: 'Grid',
          purpose: 'What automation 03 reads every Monday. Also Hannah’s to-do list.',
          setup: ['Filter: Status is Accepted', 'Filter: Slides is empty', 'Filter: Event date is within the next 14 days', 'Sort: Slides due, earliest first'],
          test: (g, today) => g('Status') === 'Accepted' && fx.empty(g('Slides')) && within(fx.daysBetween(g('Event date'), today), 14),
        },
      ],
    },
    {
      name: 'Speakers',
      description: 'One record per person. Pitches link here, so a speaker’s history is in one place.',
      fields: [
        { name: 'Name', type: 'Single line text' },
        { name: 'Email', type: 'Email' },
        { name: 'Company', type: 'Single line text' },
        { name: 'Headshot', type: 'Attachment' },
        { name: 'Sessions', type: 'Link to another record', link: 'Sessions', mirror: 'Speaker' },
        { name: 'Pitches', type: 'Count', via: 'Sessions' },
        { name: 'Accepted talks', type: 'Count', via: 'Sessions', where: accepted, note: 'A count with a condition: only linked sessions whose Status is Accepted.' },
        { name: 'Name key', type: 'Formula', formula: { text: 'LOWER(TRIM({Name}))', fn: (g) => fx.str(g('Name')).trim().toLowerCase() }, note: 'For the Duplicates view.' },
      ],
      records: [
        { id: 'recSpk01', f: { Name: 'Mara Okafor', Email: 'mara@tidewell.example', Company: 'Tidewell Logistics', Headshot: ['mara-okafor.jpg'] } },
        { id: 'recSpk02', f: { Name: 'Jun Watanabe', Email: 'jun@ferncastle.example', Company: 'Ferncastle Foods', Headshot: ['jun-watanabe.jpg'] } },
        { id: 'recSpk03', f: { Name: 'Ana Lima', Email: 'ana.lima@northrow.example', Company: 'Northrow Apparel', Headshot: ['ana-lima.jpg'] } },
        { id: 'recSpk04', f: { Name: 'Tomas Berg', Email: 'tomas@gridleaf.example', Company: 'Gridleaf Energy' } },
      ],
      views: [
        { name: 'Speaker wall', type: 'Gallery', purpose: 'Headshots and bios for the website team.', setup: ['Card cover: Headshot', 'Fields: Company, Accepted talks', 'Filter: Accepted talks > 0'] },
        { name: 'Duplicates', type: 'Grid', purpose: 'Checked monthly: the same person under two records gets merged by hand.', setup: ['Group: Name key', 'Sort: Name'] },
      ],
    },
    {
      name: 'Events',
      description: 'The summit and each workshop. Shared out to the marketing base as a synced table.',
      fields: [
        { name: 'Name', type: 'Single line text' },
        { name: 'Starts', type: 'Date' },
        { name: 'Ends', type: 'Date' },
        { name: 'City', type: 'Single select', options: ['Portland', 'Seattle', 'Boise'] },
        { name: 'Status', type: 'Single select', options: ['Planning', 'Open for pitches', 'Program locked', 'Done'] },
        { name: 'Producer', type: 'User' },
        { name: 'Sessions', type: 'Link to another record', link: 'Sessions', mirror: 'Event' },
        { name: 'Accepted sessions', type: 'Count', via: 'Sessions', where: accepted },
        {
          name: 'Slides received',
          type: 'Count',
          via: 'Sessions',
          where: { text: 'Status is Accepted and Slides status is Received', test: (g) => g('Status') === 'Accepted' && g('Slides status') === 'Received' },
        },
        { name: 'Days to go', type: 'Formula', formula: { text: "DATETIME_DIFF({Starts}, TODAY(), 'days')", fn: (g, today) => fx.daysBetween(g('Starts'), today) }, format: 'integer' },
      ],
      records: [
        { id: 'recEvtSea', f: { Name: 'Workshop day · Seattle', Starts: '2026-03-12', Ends: '2026-03-12', City: 'Seattle', Status: 'Program locked', Producer: 'Dev Castillo' } },
        { id: 'recEvtPdx', f: { Name: 'Workshop day · Portland', Starts: '2026-04-16', Ends: '2026-04-16', City: 'Portland', Status: 'Open for pitches', Producer: 'Dev Castillo' } },
        { id: 'recEvtSum', f: { Name: 'Brightwater Summit 2026', Starts: '2026-05-20', Ends: '2026-05-21', City: 'Portland', Status: 'Open for pitches', Producer: 'Dev Castillo' } },
      ],
      views: [
        { name: 'Season', type: 'Timeline', purpose: 'The year at a glance; the view the marketing base syncs.', setup: ['Start: Starts', 'End: Ends', 'Group: City'] },
        { name: 'Open for pitches', type: 'Grid', purpose: 'Limits the form’s Event picker.', setup: ['Filter: Status is Open for pitches'] },
      ],
    },
    {
      name: 'Tasks',
      description: 'What has to happen before a session is on stage. Created by automation 02.',
      fields: [
        { name: 'Task', type: 'Single line text' },
        { name: 'Session', type: 'Link to another record', link: 'Sessions' },
        { name: 'Event', type: 'Lookup', via: 'Session', of: 'Event' },
        { name: 'Type', type: 'Single select', options: ['Slides', 'Travel', 'Room setup'] },
        { name: 'Owner', type: 'User' },
        { name: 'Due', type: 'Date' },
        { name: 'Done', type: 'Checkbox' },
      ],
      records: [
        { id: 'recTsk01', f: { Task: 'Slides · Supplier scorecards suppliers actually like', Session: ['recSes01'], Type: 'Slides', Owner: 'Hannah Lee', Due: '2026-03-05' } },
        { id: 'recTsk02', f: { Task: 'Slides · Closing the books in three days', Session: ['recSes02'], Type: 'Slides', Owner: 'Hannah Lee', Due: '2026-03-05' } },
        { id: 'recTsk03', f: { Task: 'Slides · Hiring operations people who stay', Session: ['recSes03'], Type: 'Slides', Owner: 'Hannah Lee', Due: '2026-03-05', Done: true } },
        { id: 'recTsk04', f: { Task: 'Travel · Tomas Berg', Session: ['recSes04'], Type: 'Travel', Owner: 'Dev Castillo', Due: '2026-02-10', Done: true } },
        { id: 'recTsk05', f: { Task: 'Room setup · Heat pumps for warehouses, hands on', Session: ['recSes04'], Type: 'Room setup', Owner: 'Marcus Webb', Due: '2026-03-05' } },
      ],
      views: [
        { name: 'Open by owner', type: 'Grid', purpose: 'The team’s stand-up list.', setup: ['Filter: Done is unchecked', 'Group: Owner', 'Sort: Due, earliest first'] },
        { name: 'Task calendar', type: 'Calendar', purpose: 'Deadlines by day.', setup: ['Date field: Due', 'Filter: Done is unchecked', 'Color: Type'] },
      ],
    },
  ],
  interfaces: [
    {
      name: 'Program',
      audience: 'The team as editors. Two advisory-board reviewers are invited to the interface only, so they see the pitches to score and nothing else in the base.',
      pages: [
        { name: 'Review queue', layout: 'Record review', purpose: 'Reviewers read one pitch at a time and score it.', elements: ['Source: Sessions where Status is In review', 'Fields: Title, Abstract, Format, Track, Event, Headshot', 'Editable: Score', 'Buttons: Accept (sets Status to Accepted), Decline (sets Status to Declined)'] },
        { name: 'Event dashboard', layout: 'Dashboard', purpose: 'Dev’s view of each event’s readiness.', elements: ['Filter: Event (picker)', 'Number: Accepted sessions', 'Number: Slides received', 'Bar chart: Sessions by Track', 'Grid: Missing slides · next 14 days'] },
        { name: 'My tasks', layout: 'List', purpose: 'Each person’s own open tasks.', elements: ['Source: Tasks where Owner is the current user and Done is unchecked', 'Group: Due', 'Editable: Done'] },
      ],
    },
  ],
  syncs: [{ table: 'Events', direction: 'out', other: 'Brightwater Marketing', note: 'The Season view is shared as a sync source. The marketing base syncs it as a read-only table, so campaign dates follow the event dates without anyone retyping them.' }],
};
