/** 03 · Guarantee check-ins: each morning, clients near the end of a 90-day guarantee get a check-in, and old invoices are listed. */
import type { Automation, Ctx } from '@/lib/airtable/types';
import { fx, shortDate } from '@/lib/airtable/engine';

const due = (c: Ctx) => c.out('find-due').records as string[];
const overdue = (c: Ctx) => c.out('find-overdue').records as string[];

export const guaranteeCheckins: Automation = {
  id: 'guarantee-checkins',
  number: '03',
  name: 'Guarantee check-ins',
  kicker: 'Every morning → check-ins and overdue invoices',
  tagline: 'Two weeks before a placement’s 90-day guarantee ends, the client gets a check-in, once. Invoices unpaid after 30 days land in Leo’s inbox.',
  problem: 'Larkspur replaces a hire for free if they leave within 90 days. Nobody asked clients how a new hire was doing until it was too late to help, and unpaid invoices were noticed when the bank balance looked low.',
  solution: 'Every morning the automation reads two views. For each placement whose guarantee ends in the next 14 days and has had no check-in, a repeating group emails the client contact and ticks Check-in sent. If any invoice has been unpaid for more than 30 days, Leo gets one email listing them.',
  trigger: {
    type: 'At a scheduled time',
    summary: 'Runs every day at 8:00 AM Mountain time.',
    params: [
      { k: 'Interval type', v: 'Days' },
      { k: 'Every', v: '1 day' },
      { k: 'Time', v: '8:00 AM' },
      { k: 'Timezone', v: 'America/Denver' },
    ],
  },
  steps: [
    {
      kind: 'action',
      id: 'find-due',
      type: 'Find records',
      title: 'Check-ins coming due',
      summary: 'Reads the view, which already leaves out placements checked on.',
      params: [
        { k: 'Table', v: 'Placements' },
        { k: 'Find records based on', v: 'View' },
        { k: 'View', v: 'Guarantee check-ins due' },
      ],
      run: (c) => {
        const r = c.inView('Placements', 'Guarantee check-ins due');
        return { log: r.length ? `Found ${r.length}: ${r.map((x) => x.name).join('; ')}` : 'No records found', output: { records: r.map((x) => x.id) } };
      },
    },
    {
      kind: 'repeat',
      id: 'r-checkins',
      over: 'Find records › Records',
      list: (c) => due(c).map((id) => c.record('Placements', id)),
      steps: [
        {
          kind: 'action',
          id: 'checkin-email',
          type: 'Send email',
          title: 'Check in with the client',
          summary: 'One email per placement, to that client’s contact.',
          params: [
            { k: 'To', v: '{Current item › Client contact email}' },
            { k: 'From name', v: 'Nadia at Larkspur' },
            { k: 'Reply to', v: 'nadia@larkspurtalent.example' },
            { k: 'Subject', v: 'How is {Current item › Placement} going?' },
          ],
          run: (c) => {
            const p = c.item!;
            const [who, job] = p.name.split(' → ');
            return {
              messages: [{ channel: 'email', to: fx.str(p.get('Client contact email')), subject: `How is ${who.split(' ')[0]} settling in?`, body: `Hello,\n\n${who} has been with you nearly three months as ${job.split(' · ')[0]}. How is it going? If anything is not working, now is the time to tell me: the replacement guarantee runs until ${shortDate(p.get('Guarantee ends'))}.\n\nA two-line reply is plenty.\n\nNadia Hassan\nLarkspur Talent` }],
            };
          },
        },
        {
          kind: 'action',
          id: 'mark-checked',
          type: 'Update record',
          title: 'Tick Check-in sent',
          summary: 'Takes the placement out of the view, so tomorrow’s run skips it.',
          params: [
            { k: 'Table', v: 'Placements' },
            { k: 'Record ID', v: '{Current item › Airtable record ID}' },
            { k: 'Check-in sent', v: 'Checked' },
          ],
          run: (c) => ({ update: [{ table: 'Placements', id: c.item!.id, fields: { 'Check-in sent': true } }] }),
        },
      ],
    },
    {
      kind: 'action',
      id: 'find-overdue',
      type: 'Find records',
      title: 'Invoices over 30 days',
      summary: 'Invoiced, unpaid, older than 30 days.',
      params: [
        { k: 'Table', v: 'Placements' },
        { k: 'Find records based on', v: 'View' },
        { k: 'View', v: 'Invoices over 30 days' },
      ],
      run: (c) => {
        const r = c.inView('Placements', 'Invoices over 30 days');
        return { log: r.length ? `Found ${r.length}` : 'No records found', output: { records: r.map((x) => x.id) } };
      },
    },
    {
      kind: 'if',
      id: 'g-overdue',
      when: 'Find records › Records is not empty',
      test: (c) => overdue(c).length > 0,
      steps: [
        {
          kind: 'action',
          id: 'overdue-email',
          type: 'Send email',
          title: 'List them for Leo',
          summary: 'One email, only when there is something to chase.',
          params: [
            { k: 'To', v: 'leo@larkspurtalent.example' },
            { k: 'Subject', v: 'Unpaid over 30 days' },
            { k: 'Message', v: '{Find records › Records › Placement}, {… › Fee}, {… › Days since invoice}' },
          ],
          run: (c) => {
            const list = overdue(c).map((id) => c.record('Placements', id));
            return { messages: [{ channel: 'email', to: c.email('Leo Marsh'), subject: `Unpaid over 30 days: ${list.length}`, body: `${list.map((p) => `• ${p.name}: ${p.text('Fee')}, invoiced ${shortDate(p.get('Invoiced on'))} (${p.text('Days since invoice')} days)`).join('\n')}\n\nMark them paid from the Billing dashboard when the money arrives.` }] };
          },
        },
      ],
    },
  ],
  notify: 'Leo Marsh',
  scenarios: [
    {
      id: 'due',
      label: 'Two check-ins due, one invoice late',
      summary: 'Mia’s and Carlos’s guarantees end within two weeks; Copper Range has not paid for Carlos.',
      start: 480,
      expect: { status: 'success', visits: ['find-due', 'r-checkins', 'checkin-email', 'mark-checked', 'find-overdue', 'g-overdue', 'overdue-email'], emails: 3 },
    },
    {
      id: 'quiet',
      label: 'Nothing due today',
      summary: 'Check-ins already sent and the invoice paid: the run ends without a word.',
      start: 480,
      setup: {
        by: 'Yesterday’s check-ins went out, and Copper Range paid',
        update: [
          { table: 'Placements', id: 'recPlcMia', fields: { 'Check-in sent': true } },
          { table: 'Placements', id: 'recPlcCarlos', fields: { 'Check-in sent': true, 'Invoice status': 'Paid' } },
        ],
      },
      expect: { status: 'success', visits: ['find-due', 'r-checkins:empty', 'find-overdue', 'g-overdue:skip'], skips: ['checkin-email', 'overdue-email'], emails: 0 },
    },
  ],
  fields: [
    { table: 'Placements', field: 'Guarantee ends', use: 'DATEADD({Start date}, 90, \'days\'); the view filters on it.' },
    { table: 'Placements', field: 'Check-in sent', use: 'Ticked inside the repeating group so each client is asked once.' },
    { table: 'Placements', field: 'Days since invoice', use: 'Formula the overdue view filters on.' },
    { table: 'Placements', field: 'Client contact email', use: 'Lookup through Application › Role › Client.' },
  ],
  build: [
    { title: 'Two views, one schedule', body: 'Both lists are views the team also uses, so Leo’s Billing dashboard and the morning email always agree.' },
    { title: 'Send, then tick, per item', body: 'The repeating group sends one check-in and ticks Check-in sent for that placement before moving to the next, so a failure partway leaves the sent ones ticked and the rest due tomorrow.' },
    { title: 'Daily, but each client once', body: 'The run is daily so nothing waits a week; Check-in sent makes sure a client is asked only once.' },
    { title: 'Overdue list only when needed', body: 'The email to Leo is in a conditional group on the overdue list, so most mornings he gets nothing.' },
  ],
  edgeCases: [
    { title: 'The client contact changed', body: 'Change it on the Clients record; the lookup reads the new address on the next run.' },
    { title: 'A hire left early', body: 'Nadia ticks Check-in sent by hand so no cheerful check-in goes out, and the replacement search runs as new applications on the same role.' },
    { title: 'An invoice is part-paid', body: 'It stays Invoiced and keeps appearing until Leo marks it Paid. The list is a nudge, not an accounting system.' },
  ],
  qa: [
    'A placement 14 days from its guarantee end gets one check-in and is ticked.',
    'A ticked placement is never emailed again.',
    'Invoices unpaid over 30 days are listed in one email; none means no email.',
    'A quiet morning ends the run successfully with nothing sent.',
  ],
  features: ['At a scheduled time', 'Find records (based on view)', 'Repeating group', 'Update record', 'Conditional groups', 'Send email', 'Formula (DATEADD, DATETIME_DIFF)', 'Calendar view'],
};
