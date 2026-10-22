/** 01 · Damage report: the gear comes off the shelf at once; vendors and the desk hear about it when it matters. */
import type { Automation, Ctx } from '@/lib/airtable/types';
import { fx, shortDate } from '@/lib/airtable/engine';

const T = (c: Ctx) => c.trigger!;
const asset = (c: Ctx) => c.record('Assets', (T(c).get('Asset') as string[])[0]);

const SCRIPT = `// Upcoming bookings (next 7 days) that include the asset just pulled.
const { assetIds } = input.config();
const assetId = assetIds[0];
const bookings = base.getTable('Bookings');
const query = await bookings.selectRecordsAsync({
  fields: ['Booking', 'Assets', 'Pickup', 'Status'],
});

const today = new Date();
const from = today.toISOString().slice(0, 10);
const to = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);

const hits = query.records.filter((r) =>
  ['Quote', 'Confirmed'].includes(r.getCellValueAsString('Status')) &&
  (r.getCellValue('Assets') || []).some((a) => a.id === assetId) &&
  r.getCellValue('Pickup') >= from &&
  r.getCellValue('Pickup') <= to
);

output.set('count', hits.length);
output.set('list', hits
  .map((r) => r.getCellValueAsString('Booking') + ', pickup ' + r.getCellValueAsString('Pickup'))
  .join('\\n'));`;

export const damageReport: Automation = {
  id: 'damage-report',
  number: '01',
  name: 'Damage report',
  kicker: 'Report → pulled, quoted, desk warned',
  tagline: 'A damaged light is off the shelf the second it is reported, the repair shop has the details, and the desk knows which jobs it affects.',
  problem: 'Damage was written on a whiteboard at the check-in bench. A light with a frayed cable went out to a set because nobody had changed its status, repair quotes waited until Kim had time to write an email, and the desk learned a booked item was broken when the client came to pick it up.',
  solution: 'The crew report damage on an Airtable form at the bench. The automation sets the asset to In repair straight away, so it cannot be booked. Minor damage goes to Kim’s repair board. Major or unsafe damage emails the asset’s repair vendor for a quote. Unsafe damage also runs a short script to find bookings in the next week that include the item, and posts them to the desk’s Slack channel.',
  trigger: {
    type: 'When a form is submitted',
    table: 'Maintenance',
    view: 'Damage report',
    summary: 'Runs once for each damage report sent through the form, on the bench tablet or in the Warehouse interface’s copy of it.',
    params: [
      { k: 'Table', v: 'Maintenance' },
      { k: 'Form', v: 'Damage report' },
    ],
  },
  steps: [
    {
      kind: 'action',
      id: 'pull-asset',
      type: 'Update record',
      title: 'Take the asset off the shelf',
      summary: 'Status In repair hides it from the Pickup calendar’s quoting and the desk’s Available filter.',
      params: [
        { k: 'Table', v: 'Assets' },
        { k: 'Record ID', v: '{Trigger › Asset › Airtable record ID}' },
        { k: 'Status', v: 'In repair' },
      ],
      run: (c) => ({ log: `${asset(c).name}: Status ${asset(c).text('Status')} → In repair`, update: [{ table: 'Assets', id: asset(c).id, fields: { Status: 'In repair' } }] }),
    },
    {
      kind: 'if',
      id: 'g-minor',
      when: 'Trigger › Severity is Minor',
      test: (c) => T(c).get('Severity') === 'Minor',
      steps: [
        {
          kind: 'action',
          id: 'in-house',
          type: 'Update record',
          title: 'Onto Kim’s repair board',
          summary: 'Minor damage is fixed in house.',
          params: [
            { k: 'Table', v: 'Maintenance' },
            { k: 'Record ID', v: '{Trigger › Airtable record ID}' },
            { k: 'Status', v: 'In repair' },
          ],
          run: (c) => ({ update: [{ table: 'Maintenance', id: T(c).id, fields: { Status: 'In repair' } }] }),
        },
      ],
    },
    {
      kind: 'if',
      id: 'g-vendor',
      when: 'Trigger › Severity is any of Major, Unsafe',
      test: (c) => ['Major', 'Unsafe'].includes(T(c).get('Severity') as string),
      steps: [
        {
          kind: 'action',
          id: 'quote',
          type: 'Send email',
          title: 'Ask the vendor for a quote',
          summary: 'To the asset’s own repair vendor, through a lookup of a lookup.',
          params: [
            { k: 'To', v: '{Trigger › Vendor email}' },
            { k: 'From name', v: 'Kestrel Grip & Lighting' },
            { k: 'Reply to', v: 'kim@kestrelgrip.example' },
            { k: 'Subject', v: 'Repair quote: {Trigger › Asset} ({Trigger › Severity})' },
          ],
          run: (c) => {
            const a = asset(c);
            return {
              messages: [
                {
                  channel: 'email',
                  to: fx.str(T(c).get('Vendor email')),
                  subject: `Repair quote: ${a.name} (${T(c).text('Severity')})`,
                  body: `Hello ${T(c).text('Vendor')},\n\nWe need a quote and turnaround time for:\n\n${a.text('Name')} (asset ${a.name})\nIssue: ${T(c).text('Issue')}${T(c).text('Details') ? `\nDetails: ${T(c).text('Details')}` : ''}\n${T(c).get('Severity') === 'Unsafe' ? '\nIt is marked unsafe and out of service until repaired.\n' : ''}\nPhotos are on our damage report; reply and Kim will send them over. We can drop it off tomorrow.\n\nKim Tran\nKestrel Grip & Lighting`,
                },
              ],
            };
          },
        },
        {
          kind: 'action',
          id: 'mark-waiting',
          type: 'Update record',
          title: 'Mark the report Waiting on vendor',
          summary: 'Moves the card on Kim’s repair board.',
          params: [
            { k: 'Table', v: 'Maintenance' },
            { k: 'Record ID', v: '{Trigger › Airtable record ID}' },
            { k: 'Status', v: 'Waiting on vendor' },
          ],
          run: (c) => ({ update: [{ table: 'Maintenance', id: T(c).id, fields: { Status: 'Waiting on vendor' } }] }),
        },
      ],
    },
    {
      kind: 'if',
      id: 'g-unsafe',
      when: 'Trigger › Severity is Unsafe',
      test: (c) => T(c).get('Severity') === 'Unsafe',
      steps: [
        {
          kind: 'action',
          id: 'find-bookings',
          type: 'Run a script',
          title: 'Find bookings that include it',
          summary: 'Checks the next week’s bookings for this one asset; a date window and a record ID read more clearly as a few lines of script.',
          params: [{ k: 'Input variable assetIds', v: '{Trigger › Asset › Airtable record ID}' }],
          script: { inputs: [{ name: 'assetIds', value: 'Trigger › Asset › Airtable record ID (list)' }], source: SCRIPT },
          run: (c) => {
            const id = (T(c).get('Asset') as string[])[0];
            const hits = c.records('Bookings').filter((b) => {
              const d = fx.daysBetween(b.get('Pickup'), c.today);
              return ['Quote', 'Confirmed'].includes(b.get('Status') as string) && (b.get('Assets') as string[]).includes(id) && d !== null && d >= 0 && d <= 7;
            });
            return { log: `output.set: count ${hits.length}, list`, output: { count: hits.length, list: hits.map((b) => `${b.name}, pickup ${shortDate(b.get('Pickup'))}`).join('\n') } };
          },
        },
        {
          kind: 'action',
          id: 'slack-desk',
          type: 'Send a Slack message',
          title: 'Warn the rental desk',
          summary: 'Names the bookings that need a substitute.',
          params: [
            { k: 'Channel', v: '#rental-desk' },
            { k: 'Message', v: 'Unsafe: {Trigger › Asset} is out of service. Bookings in the next 7 days: {Run a script › list}' },
          ],
          run: (c) => {
            const o = c.out('find-bookings');
            return {
              messages: [{ channel: 'slack', to: '#rental-desk', body: `Unsafe: ${asset(c).name} (${asset(c).text('Name')}) is out of service. ${T(c).text('Issue')}.\n${o.count ? `Bookings in the next 7 days that include it:\n${o.list}\nPlease sub in another unit or call the client.` : 'No bookings in the next 7 days include it.'}` }],
            };
          },
        },
      ],
    },
  ],
  notify: 'Jordan Price',
  scenarios: [
    {
      id: 'minor',
      label: 'Minor: a scuffed lens',
      summary: 'Luis reports a missing rear cap. Pulled and on Kim’s board; no emails.',
      start: 1040,
      form: { Asset: ['recAst04'], Issue: 'Rear cap missing, light scuff on barrel', Severity: 'Minor', 'Reported by': 'Luis Ortega' },
      expect: { status: 'success', visits: ['pull-asset', 'in-house', 'g-minor', 'g-vendor:skip', 'g-unsafe:skip'], skips: ['quote', 'find-bookings'], emails: 0 },
    },
    {
      id: 'major',
      label: 'Major: a flickering SkyPanel',
      summary: 'Kim reports flicker at low output. Pulled, vendor asked for a quote.',
      start: 1440 + 665,
      form: { Asset: ['recAst01'], Issue: 'Flickers at 30% output and below', Severity: 'Major', Details: 'Reproducible on two dimmer curves; fine above 40%.', Photos: ['flicker-test.mov'], 'Reported by': 'Kim Tran' },
      expect: { status: 'success', visits: ['pull-asset', 'quote', 'mark-waiting', 'g-vendor', 'g-minor:skip', 'g-unsafe:skip'], skips: ['in-house', 'slack-desk'], emails: 1 },
    },
    {
      id: 'unsafe',
      label: 'Unsafe: a split ballast cable',
      summary: 'Bree finds split insulation on the M18’s cable the night before a booked shoot.',
      start: 2 * 1440 + 1120,
      form: { Asset: ['recAst03'], Issue: 'Ballast head cable insulation split near connector', Severity: 'Unsafe', Details: 'Copper visible over about 1 cm. Taped and tagged red.', Photos: ['m18-cable-1.jpg', 'm18-cable-2.jpg'], 'Reported by': 'Bree Collins' },
      expect: { status: 'success', visits: ['pull-asset', 'quote', 'mark-waiting', 'find-bookings', 'slack-desk', 'g-vendor', 'g-unsafe', 'g-minor:skip'], emails: 1 },
    },
    {
      id: 'unsafe-slack-down',
      label: 'Unsafe, and Slack is disconnected',
      summary: 'Everything up to the Slack post happens; the run fails there and Jordan is emailed.',
      start: 2 * 1440 + 1120,
      form: { Asset: ['recAst03'], Issue: 'Ballast head cable insulation split near connector', Severity: 'Unsafe', 'Reported by': 'Bree Collins' },
      failures: { 'slack-desk': 'The Slack account for this action needs to be reconnected.' },
      expect: { status: 'failed', visits: ['pull-asset', 'quote', 'mark-waiting', 'find-bookings'], skips: ['slack-desk'], emails: 1 },
    },
  ],
  fields: [
    { table: 'Maintenance', field: 'Asset', use: 'Link from the form; its record ID is the one the first step updates.' },
    { table: 'Maintenance', field: 'Vendor email', use: 'Lookup of Asset › Vendor email, itself a lookup into the synced Vendors table.' },
    { table: 'Maintenance', field: 'Status', use: 'In repair or Waiting on vendor, set by the automation.' },
    { table: 'Assets', field: 'Status', use: 'In repair as the first step of every run.' },
    { table: 'Assets', field: 'Open repairs', use: 'A count with a condition; it rises the moment the report exists.' },
  ],
  build: [
    { title: 'Off the shelf first', body: 'Setting the asset to In repair is the first action, outside any condition. Whatever happens after, the gear cannot be booked or handed out.' },
    { title: 'Three conditional groups, not one per severity', body: 'Minor, “Major or Unsafe”, and Unsafe. Unsafe reports run two groups: the vendor quote they share with Major, and the booking check that only they need.' },
    { title: 'A lookup through a lookup', body: 'Maintenance › Vendor email looks up Assets › Vendor email, which looks up the synced Vendors table. When finance changes a vendor’s address, the next quote request goes to the new one.' },
    { title: 'Script only where actions fall short', body: 'Find records filters on conditions a person could type; matching bookings whose Assets include one record ID by date window is easier to read as twelve lines of script. It reads four fields and sets two outputs.' },
    { title: 'Interface-only reporters', body: 'The crew are interface-only collaborators and submit the same form inside the Warehouse interface, so they never see purchase prices or client emails.' },
  ],
  edgeCases: [
    { title: 'The asset has no vendor', body: 'Grip like the 20×20 frame is repaired in house and has no vendor. Its reports should be Minor; if one is marked Major, the quote email has no address and the run fails at that step, after the asset is already pulled. Jordan gets the failure email and the board still shows the report.' },
    { title: 'Two reports for the same item', body: 'Both run. The asset is already In repair, so the second update changes nothing; the vendor gets two emails, which Kim answers as one.' },
    { title: 'The item is out on a job', body: 'Damage reported by phone from set is logged by the desk on the same form. The asset goes to In repair, which is right: it should not go out again when it comes back.' },
    { title: 'Slack is disconnected', body: 'The asset is pulled and the vendor asked before the Slack step, so the run fails with nothing important missing. Jordan reconnects Slack and reads the bookings off the Conflicts and calendar views.' },
    { title: 'The script’s dates', body: 'Automation scripts run on Airtable’s servers in UTC. Late in the evening in Atlanta it is already tomorrow in UTC, so a pickup that same day falls outside the window; by then that gear has left the building anyway.' },
  ],
  qa: [
    'Every report sets its asset to In repair, whatever the severity.',
    'Minor damage sends no email; Major and Unsafe send one quote request to the right vendor.',
    'Unsafe damage lists only bookings in the next 7 days that include that asset.',
    'With Slack disconnected, the run fails at Slack only.',
    'Interface-only users can submit the form and see nothing priced.',
  ],
  features: ['Form view', 'When a form is submitted', 'Update record', 'Conditional groups', 'Send email', 'Run a script', 'Send a Slack message', 'Lookup of a lookup', 'Synced table', 'Interface-only collaborators'],
};
