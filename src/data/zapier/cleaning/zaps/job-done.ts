/** 02 · Job done: a row marked Done becomes a QuickBooks invoice the same day, then a review request two days later. */
import type { Ctx, Json, Zap } from '@/lib/zapier/types';
import { firstName, money, shortDate, str } from '../../helpers';

const T = (c: Ctx) => c.trigger;
const amount = (c: Ctx) => Number(str(T(c).Amount)) || 0;
const invoiceNo = (c: Ctx) => str(c.out('invoice')['Doc Number']);

const job = (o: Partial<Json>): Json => ({
  'Row ID': '14',
  'Job ID': 'J-2291',
  Client: 'Dana Whitfield',
  Email: 'dana.whitfield@example.com',
  Service: 'One-time deep clean',
  Amount: '205',
  'Cleaned On': '2026-03-03',
  Crew: 'Tasha',
  Status: 'Done',
  'Invoice #': '',
  ...o,
});

export const jobDone: Zap = {
  id: 'job-done',
  number: '02',
  name: 'Job done to invoice',
  kicker: 'Done → invoice now, review ask later',
  tagline: 'The crew lead changes one cell to Done. The invoice goes out within minutes, and two days later a happy client is asked for a review.',
  problem:
    'Invoices were written on Fridays from a week of text messages, so a Monday job was billed five days later and paid later still. Review requests were sent in a rush whenever someone remembered, sometimes to a client who had phoned that morning to complain.',
  solution:
    'The crew lead sets the job’s Status to Done in the Jobs sheet. The Zap finds the client in QuickBooks, or adds them, creates the invoice from the row and emails it, then writes the invoice number back to the sheet. It waits two days, reads the row again, and asks for a review only if nobody has logged a complaint in the meantime.',
  folder: 'Maple & Main',
  trigger: {
    app: 'Google Sheets',
    event: 'New or Updated Spreadsheet Row',
    icon: 'sheet',
    type: 'polling',
    summary: 'Watches the Jobs worksheet. It runs for a new row, and again each time the Status cell of a row changes.',
    params: [
      { k: 'Spreadsheet', v: 'Maple & Main Ops' },
      { k: 'Worksheet', v: 'Jobs' },
      { k: 'Trigger Column', v: 'Status' },
    ],
  },
  steps: [
    {
      kind: 'filter',
      id: 'done',
      title: 'Only finished jobs',
      summary: 'The trigger fires for every change to Status. Scheduled, Rescheduled and the Zap’s own Invoiced all stop here.',
      rules: 'Status (Text) Exactly matches Done',
      params: [{ k: 'Only continue if', v: '{trigger › Status} (Text) Exactly matches Done' }],
      test: (c) => str(T(c).Status) === 'Done',
    },
    {
      kind: 'action',
      id: 'customer',
      app: 'QuickBooks Online',
      event: 'Find Customer',
      icon: 'search',
      search: 'create',
      title: 'Find the client in QuickBooks, or add them',
      summary: 'Searches by email. A first-time client is created on the spot, so the invoice step always has a customer to bill.',
      params: [
        { k: 'Search By', v: 'Email' },
        { k: 'Search Value', v: '{trigger › Email}' },
        { k: 'Create QuickBooks Online Customer if it doesn’t exist yet?', v: 'Yes' },
        { k: 'Display Name (if created)', v: '{trigger › Client}' },
        { k: 'Email (if created)', v: '{trigger › Email}' },
      ],
      run: (c) => {
        const email = str(T(c).Email).trim().toLowerCase();
        const hit = c.rows('QuickBooks customers').find((r) => str(r.Email).toLowerCase() === email);
        if (hit) return { found: true, log: `Found customer ${str(hit.Id)} · ${str(hit['Display Name'])}`, output: { Id: hit.Id, 'Display Name': hit['Display Name'] } };
        const row = { Id: '87', 'Display Name': str(T(c).Client), Email: str(T(c).Email) };
        return {
          found: false,
          log: `No customer with that email, so one was created: ${row['Display Name']}`,
          output: { Id: row.Id, 'Display Name': row['Display Name'] },
          write: [{ collection: 'QuickBooks customers', row }],
          effects: [{ app: 'QuickBooks Online', what: 'Customer created', name: row['Display Name'], fields: { Email: row.Email } }],
        };
      },
    },
    {
      kind: 'action',
      id: 'invoice',
      app: 'QuickBooks Online',
      event: 'Create Invoice',
      icon: 'invoice',
      title: 'Create the invoice',
      summary: 'One line, straight from the row: the service, the amount and the date of the clean. Terms are Net 7.',
      params: [
        { k: 'Customer', v: '{customer › Id}' },
        { k: 'Invoice Date', v: '{trigger › Cleaned On}' },
        { k: 'Terms', v: 'Net 7' },
        { k: 'Line Description', v: '{trigger › Service} · {trigger › Cleaned On} · job {trigger › Job ID}' },
        { k: 'Line Amount', v: '{trigger › Amount}' },
      ],
      run: (c) => {
        const no = `10${str(T(c)['Job ID']).replace(/\D/g, '').slice(-2)}`;
        return {
          log: `Invoice ${no} for ${money(amount(c))}`,
          output: { Id: `9${no}`, 'Doc Number': no, 'Total Amt': amount(c), Balance: amount(c) },
          effects: [{ app: 'QuickBooks Online', what: 'Invoice created', name: `Invoice ${no} · ${str(T(c).Client)}`, fields: { Line: `${str(T(c).Service)} · job ${str(T(c)['Job ID'])}`, Amount: money(amount(c)), Terms: 'Net 7' } }],
        };
      },
    },
    {
      kind: 'action',
      id: 'send-invoice',
      app: 'QuickBooks Online',
      event: 'Send Invoice',
      icon: 'mail',
      title: 'Email it from QuickBooks',
      summary: 'QuickBooks sends its own invoice email, with the pay-online button, so the client pays the way they already know.',
      params: [
        { k: 'Invoice', v: '{invoice › Id}' },
        { k: 'Email To', v: '{trigger › Email}' },
      ],
      run: (c) => ({
        messages: [
          {
            channel: 'email',
            to: str(T(c).Email),
            subject: `Invoice ${invoiceNo(c)} from Maple & Main Cleaning`,
            body: `Dear ${str(T(c).Client)},\n\nHere is your invoice for ${str(T(c).Service).toLowerCase()} on ${shortDate(T(c)['Cleaned On'])}.\n\nAmount due: ${money(amount(c))}\nDue within 7 days\n\n[Review and pay]\n\nThank you for your business.\nMaple & Main Cleaning`,
          },
        ],
        effects: [{ app: 'QuickBooks Online', what: 'Invoice emailed', name: `Invoice ${invoiceNo(c)}`, fields: { To: str(T(c).Email) } }],
      }),
    },
    {
      kind: 'action',
      id: 'mark',
      app: 'Google Sheets',
      event: 'Update Spreadsheet Row',
      icon: 'sheet',
      title: 'Write the invoice number back',
      summary: 'Sets Status to Invoiced and fills Invoice #, so the sheet shows at a glance what has been billed.',
      params: [
        { k: 'Worksheet', v: 'Jobs' },
        { k: 'Row', v: '{trigger › Row ID}' },
        { k: 'Status', v: 'Invoiced' },
        { k: 'Invoice #', v: '{invoice › Doc Number}' },
      ],
      run: (c) => ({ effects: [{ app: 'Google Sheets', what: 'Row updated in Jobs', name: `${str(T(c)['Job ID'])} · ${str(T(c).Client)}`, fields: { Status: 'Invoiced', 'Invoice #': invoiceNo(c) } }] }),
    },
    {
      kind: 'delay',
      id: 'wait',
      event: 'Delay For',
      title: 'Give the client two days with the result',
      summary: 'Long enough to notice a missed spot and say so, short enough that the clean is still fresh.',
      params: [
        { k: 'Time Delayed For (value)', v: '2' },
        { k: 'Time Delayed For (unit)', v: 'days' },
      ],
      ms: 2 * 1440 * 60000,
    },
    {
      kind: 'action',
      id: 'recheck',
      app: 'Google Sheets',
      event: 'Lookup Spreadsheet Row',
      icon: 'search',
      search: 'halt',
      title: 'Read the job again',
      summary: 'The trigger’s copy of the row is two days old by now. This step fetches the row as it is today, Complaint column included.',
      params: [
        { k: 'Worksheet', v: 'Jobs' },
        { k: 'Lookup Column', v: 'Job ID' },
        { k: 'Lookup Value', v: '{trigger › Job ID}' },
      ],
      run: (c) => {
        const complaint = str(c.fixtures.complaint);
        if (c.fixtures.deleted) return { found: false, log: `No row with Job ID ${str(T(c)['Job ID'])}` };
        return { found: true, log: complaint ? `Complaint on file: “${complaint}”` : 'No complaint on the row', output: { 'Job ID': T(c)['Job ID'], Status: 'Invoiced', Complaint: complaint } };
      },
    },
    {
      kind: 'filter',
      id: 'happy',
      title: 'No open complaint',
      summary: 'A client who has complained hears from Renee, not from a review request.',
      rules: 'Complaint Does not exist',
      params: [{ k: 'Only continue if', v: '{recheck › Complaint} Does not exist' }],
      test: (c) => !str(c.out('recheck').Complaint),
    },
    {
      kind: 'action',
      id: 'review',
      app: 'Gmail',
      event: 'Send Email',
      icon: 'mail',
      title: 'Ask for a review',
      summary: 'A short note from the owner with one link.',
      params: [
        { k: 'To', v: '{trigger › Email}' },
        { k: 'From Name', v: 'Renee at Maple & Main' },
        { k: 'Subject', v: 'How did we do?' },
      ],
      run: (c) => ({
        messages: [
          {
            channel: 'email',
            to: str(T(c).Email),
            subject: 'How did we do?',
            body: `Hi ${firstName(T(c).Client)},\n\n${str(T(c).Crew)} and the crew cleaned your home on ${shortDate(T(c)['Cleaned On'])}. If you were happy with it, a short Google review helps a small business like ours more than anything: https://mapleandmain.example/review\n\nAnd if something was not right, reply to this email. It comes straight to me.\n\nRenee Alvarado\nMaple & Main Cleaning`,
          },
        ],
      }),
    },
  ],
  autoreplay: true,
  owner: 'Marcus Bell',
  scenarios: [
    {
      id: 'regular',
      label: 'A regular client’s job is marked Done',
      summary: 'Dana is already in QuickBooks. The invoice goes out, and the review request follows two days later.',
      start: 1440 + 14 * 60 + 11,
      event: 'In the Jobs sheet: Tasha changes J-2291 to Done',
      trigger: job({}),
      expect: { status: 'Successful', visits: ['done', 'customer', 'invoice', 'send-invoice', 'mark', 'wait', 'recheck', 'happy', 'review'], tasks: 6 },
    },
    {
      id: 'new-client',
      label: 'A first job for a new client',
      summary: 'Sam is not in QuickBooks yet, so the search creates the customer and the invoice follows as usual.',
      start: 2 * 1440 + 12 * 60 + 37,
      event: 'In the Jobs sheet: Tasha changes J-2304 to Done',
      trigger: job({ 'Row ID': '27', 'Job ID': 'J-2304', Client: 'Sam Okonkwo', Email: 'sam.okonkwo@example.com', Service: 'Move-out clean', Amount: '340', 'Cleaned On': '2026-03-04' }),
      expect: { status: 'Successful', visits: ['customer', 'invoice', 'review'], tasks: 6 },
    },
    {
      id: 'echo',
      label: 'The Zap’s own edit comes back',
      summary: 'Writing Invoiced into the Status cell fires the trigger again. The first filter stops that run before it does anything.',
      start: 1440 + 14 * 60 + 15,
      event: 'In the Jobs sheet: the Zap itself changed J-2291 to Invoiced',
      trigger: job({ Status: 'Invoiced', 'Invoice #': '1091' }),
      expect: { status: 'Filtered', visits: ['done:stop'], skips: ['customer', 'invoice'], tasks: 0 },
    },
    {
      id: 'complaint',
      label: 'A complaint comes in during the two days',
      summary: 'The invoice has gone out. Then Marcus logs a complaint on the row, and the review request is never sent.',
      start: 3 * 1440 + 15 * 60 + 2,
      event: 'In the Jobs sheet: Tasha changes J-2310 to Done',
      trigger: job({ 'Row ID': '33', 'Job ID': 'J-2310', Client: 'Gordon Pruitt', Email: 'gordon.pruitt@example.com', Service: 'Recurring, every 2 weeks', Amount: '160', 'Cleaned On': '2026-03-05' }),
      fixtures: { complaint: 'Inside of the oven was missed' },
      expect: { status: 'Filtered', visits: ['invoice', 'send-invoice', 'mark', 'recheck', 'happy:stop'], skips: ['review'], tasks: 5 },
    },
    {
      id: 'row-deleted',
      label: 'The row is deleted during the two days',
      summary: 'A job entered twice is removed from the sheet. The lookup finds nothing, and the run stops quietly.',
      start: 3 * 1440 + 9 * 60 + 33,
      event: 'In the Jobs sheet: Tasha changes J-2307 to Done',
      trigger: job({ 'Row ID': '30', 'Job ID': 'J-2307', Client: 'Dana Whitfield', Service: 'Recurring, every 2 weeks', Amount: '150', 'Cleaned On': '2026-03-05' }),
      fixtures: { deleted: true },
      expect: { status: 'Safely halted', visits: ['mark', 'wait', 'recheck:none'], skips: ['happy', 'review'], tasks: 4 },
    },
    {
      id: 'no-amount',
      label: 'The Amount cell is empty',
      summary: 'QuickBooks refuses an invoice with no amount. The run errors, Autoreplay cannot fix a missing number, and Marcus is emailed.',
      start: 4 * 1440 + 10 * 60 + 26,
      event: 'In the Jobs sheet: Tasha changes J-2318 to Done',
      trigger: job({ 'Row ID': '41', 'Job ID': 'J-2318', Client: 'Imani Brooks', Email: 'imani.brooks@example.com', Service: 'Recurring, weekly', Amount: '', 'Cleaned On': '2026-03-06' }),
      failures: { invoice: { message: 'QuickBooks Online: “Amount is missing or is not a number.” (line 1)' } },
      expect: { status: 'Errored', visits: ['done', 'customer'], skips: ['send-invoice', 'mark', 'review'], tasks: 1 },
    },
  ],
  fields: [
    { app: 'Google Sheets', field: 'Status', use: 'The trigger column. Done starts the work; Invoiced is written back.' },
    { app: 'Google Sheets', field: 'Client, Email, Service, Amount, Cleaned On', use: 'Everything the invoice needs, read from the row.' },
    { app: 'Google Sheets', field: 'Invoice #', use: 'Written back so the sheet and QuickBooks can be matched.' },
    { app: 'Google Sheets', field: 'Complaint', use: 'Read two days later; anything in it stops the review request.' },
    { app: 'QuickBooks Online', field: 'Customer › Email', use: 'How an existing customer is found.' },
  ],
  build: [
    { title: 'A trigger column, then a filter', body: 'The trigger watches the Status column, so it fires on every change to it. The filter right after lets only Done through. Filters use no tasks, so the many rows that stop here cost nothing.' },
    { title: 'The Zap must survive its own edit', body: 'Step 6 writes Invoiced into the very cell the trigger watches, which starts a second run. Because the filter wants exactly Done, that run ends as Filtered at step 2. Without it the Zap would invoice the same job again and again.' },
    { title: 'Find the customer, or create them', body: 'The search step has “create if it doesn’t exist yet” ticked, so it always hands the next step a customer ID. Searching by email, not name, means two clients called Chris Lee cannot be mixed up.' },
    { title: 'Let QuickBooks send the email', body: 'Send Invoice uses QuickBooks’ own email, with its pay-online button and its record of when the client opened it. A Gmail message with a PDF would have neither.' },
    { title: 'Read the row again after the delay', body: 'A Zap carries the trigger’s data as it was when the run began. Two days later that copy is stale, so step 8 looks the row up fresh before the filter decides.' },
    { title: 'Two filters, two meanings', body: 'A run that stops at step 2 was never a finished job. A run that stops at step 9 was billed and then held back from the review request. Both show as Filtered in Zap history, and the step number says which.' },
  ],
  edgeCases: [
    { title: 'Someone changes Done back to Scheduled and then to Done again', body: 'The trigger fires again and a second invoice would be created. The Jobs sheet protects against the slip: once Invoice # is filled, a data-validation rule stops Status going back to Done without the number being cleared first.' },
    { title: 'The Amount cell is empty or has text in it', body: 'QuickBooks rejects the invoice and the run errors at step 4. Autoreplay tries again, but a missing number does not fix itself, so Marcus gets the error email. He fills in the cell and replays the run from the failed step.' },
    { title: 'The Zap is turned off during the two days', body: 'A delayed run only continues if the Zap is on when its time comes. Zaps in this account are paused, never turned off, during maintenance, and the Monday check of Zap history looks for runs still showing Delayed.' },
    { title: 'A client with two email addresses', body: 'If the Jobs row uses an address QuickBooks does not know, a second customer is created. Priya’s month-end review lists customers created by Zapier so duplicates are merged.' },
    { title: 'The row is deleted before the review request', body: 'The lookup at step 8 finds nothing and the run ends as Safely halted, which is the right result: there is nobody to ask.' },
  ],
  qa: [
    'Changing Status to Done creates exactly one invoice with the row’s service, date and amount.',
    'The invoice number appears in the row, and Status reads Invoiced.',
    'The run started by that edit ends as Filtered at step 2 and uses no tasks.',
    'A client who is not in QuickBooks is created once and billed.',
    'A complaint typed into the row during the delay stops the review request.',
    'An empty Amount errors at Create Invoice and Marcus gets Zapier’s email.',
  ],
  features: ['Polling trigger', 'Trigger column', 'Filter by Zapier', 'Search with “create if it doesn’t exist yet”', 'Delay For', 'Lookup after a delay', 'Autoreplay', 'QuickBooks Online', 'Google Sheets', 'Gmail'],
};
