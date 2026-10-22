/** 03 · Nightly conflict check: a script flags double bookings, clears stale flags, and the desk hears only when there is one. */
import type { Automation, Ctx, RecordView } from '@/lib/airtable/types';

const SCRIPT = `// Flags bookings that share an asset on overlapping dates, and clears flags that no longer apply.
const table = base.getTable('Bookings');
const query = await table.selectRecordsAsync({
  fields: ['Booking', 'Assets', 'Pickup', 'Return', 'Status', 'Conflict', 'Conflict note'],
});
const live = query.records.filter((r) => ['Confirmed', 'Out'].includes(r.getCellValueAsString('Status')));

const notes = new Map();
for (let i = 0; i < live.length; i++) {
  for (let j = i + 1; j < live.length; j++) {
    const a = live[i];
    const b = live[j];
    // Dates come back as "YYYY-MM-DD", so they compare as text.
    const overlap = a.getCellValue('Pickup') <= b.getCellValue('Return') && b.getCellValue('Pickup') <= a.getCellValue('Return');
    if (!overlap) continue;
    const inB = (b.getCellValue('Assets') || []).map((x) => x.id);
    const shared = (a.getCellValue('Assets') || []).filter((x) => inB.includes(x.id)).map((x) => x.name);
    if (!shared.length) continue;
    for (const [r, other] of [[a, b], [b, a]]) {
      const line = 'Shares ' + shared.join(', ') + ' with ' + other.getCellValueAsString('Booking');
      notes.set(r.id, (notes.get(r.id) || []).concat(line));
    }
  }
}

// Only write records whose flag or note actually changes.
const updates = [];
for (const r of query.records) {
  const note = (notes.get(r.id) || []).join('\\n');
  if (!!r.getCellValue('Conflict') !== !!note || r.getCellValueAsString('Conflict note') !== note) {
    updates.push({ id: r.id, fields: { 'Conflict': !!note, 'Conflict note': note } });
  }
}
// updateRecordsAsync takes at most 50 records per call.
while (updates.length) await table.updateRecordsAsync(updates.splice(0, 50));

output.set('conflicts', notes.size);
output.set('summary', [...notes].map(([id, lines]) =>
  query.getRecord(id).getCellValueAsString('Booking') + ': ' + lines.join('; ')).join('\\n'));`;

/** The same rule as the script, run on the simulated base. */
function check(c: Ctx) {
  const all = c.records('Bookings');
  const live = all.filter((r) => ['Confirmed', 'Out'].includes(r.get('Status') as string));
  const notes = new Map<string, string[]>();
  const ids = (r: RecordView) => r.get('Assets') as string[];
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) {
      const [a, b] = [live[i], live[j]];
      const overlap = (a.get('Pickup') as string) <= (b.get('Return') as string) && (b.get('Pickup') as string) <= (a.get('Return') as string);
      const shared = ids(a).filter((x) => ids(b).includes(x)).map((x) => c.record('Assets', x).name);
      if (!overlap || !shared.length) continue;
      for (const [r, other] of [[a, b], [b, a]]) notes.set(r.id, [...(notes.get(r.id) ?? []), `Shares ${shared.join(', ')} with ${other.name}`]);
    }
  const update = all
    .map((r) => ({ r, note: (notes.get(r.id) ?? []).join('\n') }))
    .filter(({ r, note }) => !!r.get('Conflict') !== !!note || (r.get('Conflict note') ?? '') !== note)
    .map(({ r, note }) => ({ table: 'Bookings', id: r.id, fields: { Conflict: !!note, 'Conflict note': note || null } }));
  const summary = [...notes].map(([id, lines]) => `${c.record('Bookings', id).name}: ${lines.join('; ')}`).join('\n');
  return { notes, update, summary };
}

export const conflictCheck: Automation = {
  id: 'conflict-check',
  number: '03',
  name: 'Nightly conflict check',
  kicker: 'Every night → double bookings flagged',
  tagline: 'Every night a script compares every live booking with every other. Clashes are flagged on the records and emailed to the desk; fixed ones are unflagged without a word.',
  problem: 'Twice a year two productions turned up for the same light. Each booking looked fine on its own, and nobody compares forty bookings by hand.',
  solution: 'At 9 PM every night a script reads the confirmed and outgoing bookings, finds pairs that share an asset on overlapping dates, ticks Conflict and writes a note on both, and clears the flag on bookings that no longer clash. If it found any, Andre gets one email with the list for the morning.',
  trigger: {
    type: 'At a scheduled time',
    summary: 'Runs every day at 9:00 PM Eastern time, after the desk closes.',
    params: [
      { k: 'Interval type', v: 'Days' },
      { k: 'Every', v: '1 day' },
      { k: 'Time', v: '9:00 PM' },
      { k: 'Timezone', v: 'America/New_York' },
    ],
  },
  steps: [
    {
      kind: 'action',
      id: 'check',
      type: 'Run a script',
      title: 'Compare every live booking',
      summary: 'Flags clashes, clears stale flags, writes only what changed.',
      params: [{ k: 'Input variables', v: 'None: the script reads Bookings itself' }],
      script: { inputs: [], source: SCRIPT },
      ms: 2600,
      run: (c) => {
        const { notes, update, summary } = check(c);
        return { log: `${update.length ? `${update.length} record${update.length === 1 ? '' : 's'} updated in ${Math.ceil(update.length / 50)} call${update.length > 50 ? 's' : ''} to updateRecordsAsync` : 'Nothing to update'} · output.set: conflicts ${notes.size}, summary`, update, output: { conflicts: notes.size, summary } };
      },
    },
    {
      kind: 'if',
      id: 'g-conflicts',
      when: 'Run a script › conflicts is greater than 0',
      test: (c) => (c.out('check').conflicts as number) > 0,
      steps: [
        {
          kind: 'action',
          id: 'conflict-email',
          type: 'Send email',
          title: 'Tell Andre before the morning',
          summary: 'One email with every clash in it.',
          params: [
            { k: 'To', v: 'andre@kestrelgrip.example' },
            { k: 'Subject', v: 'Double bookings: {Run a script › conflicts} bookings' },
            { k: 'Message', v: '{Run a script › summary}' },
          ],
          run: (c) => {
            const o = c.out('check');
            return { messages: [{ channel: 'email', to: c.email('Andre Mills'), subject: `Double bookings: ${o.conflicts} bookings`, body: `These bookings share gear on overlapping dates:\n\n${o.summary}\n\nThey are ticked in the Bookings view “Conflicts”. Change either booking and both flags clear on tomorrow night’s run.` }] };
          },
        },
      ],
    },
  ],
  notify: 'Jordan Price',
  scenarios: [
    {
      id: 'clash',
      label: 'Two jobs want SkyPanel #2 on Friday',
      summary: 'Night Shift has it Wednesday to Saturday; the Tidewater commercial booked it for Friday. Both flagged, last week’s stale flag cleared, one email.',
      start: 1260,
      expect: { status: 'success', visits: ['check', 'g-conflicts', 'conflict-email'], emails: 1 },
    },
    {
      id: 'clear',
      label: 'Andre already swapped in SkyPanel #3',
      summary: 'No clashes left: the stale flag is cleared and nobody is emailed.',
      start: 1260,
      setup: { by: 'Andre swaps SkyPanel #3 into the Tidewater booking', update: [{ table: 'Bookings', id: 'recBkg02', fields: { Assets: ['recAst02', 'recAst06'] } }] },
      expect: { status: 'success', visits: ['check', 'g-conflicts:skip'], skips: ['conflict-email'], emails: 0 },
    },
  ],
  fields: [
    { table: 'Bookings', field: 'Assets, Pickup, Return, Status', use: 'Read by the script.' },
    { table: 'Bookings', field: 'Conflict, Conflict note', use: 'Written by the script only; the Conflicts view filters on Conflict.' },
    { table: 'Assets', field: 'Asset tag', use: 'The primary field, so linked assets read as tags in the note.' },
  ],
  build: [
    { title: 'Why a script', body: 'Comparing every booking with every other one is a pairwise check no filter or Find records can express. The script is short, reads seven fields, and is commented for the next person.' },
    { title: 'Writes only what changed', body: 'The script compares each record’s current flag and note with the new ones and updates only those that differ, in calls of at most 50 records, the limit for updateRecordsAsync. A quiet night writes nothing.' },
    { title: 'Flags clear themselves', body: 'A booking that no longer clashes is unticked on the next run. The Conflicts view is always tonight’s truth, not a list somebody has to tidy.' },
    { title: 'Email only when there is news', body: 'The email sits in a conditional group on the script’s conflicts output. Most nights the run succeeds and Andre hears nothing.' },
    { title: 'Inside the limits', body: 'Scripts in automations have 30 seconds to run. Forty live bookings is about 800 pairs, which takes a fraction of a second; at a few thousand live bookings this would move to a nightly window of dates instead.' },
  ],
  edgeCases: [
    { title: 'Same-day return and pickup', body: 'A light back Friday morning and out Friday afternoon counts as a clash, because the dates overlap. That is deliberate: the desk confirms the timing with both clients rather than finding out at the dock.' },
    { title: 'A quote, not a booking', body: 'Quotes are left out. Two quotes for the same light are normal; the check is for promises.' },
    { title: 'Someone edits the note by hand', body: 'The next run overwrites it with the computed note. The field description says so, and the desk keeps their own notes elsewhere on the record.' },
    { title: 'The script fails', body: 'Nothing is half-written in a way that matters: a failed run leaves last night’s flags in place, and Jordan gets the failure email with the error from the script.' },
  ],
  qa: [
    'Two bookings sharing an asset on overlapping dates are both flagged, each naming the other.',
    'Bookings sharing an asset on separate dates are not flagged.',
    'A stale flag is cleared when its clash is gone.',
    'With no clashes, the run writes nothing new and sends nothing.',
    'Quotes and returned bookings are ignored.',
  ],
  features: ['At a scheduled time', 'Run a script', 'selectRecordsAsync', 'updateRecordsAsync (batches of 50)', 'Script output variables', 'Conditional groups', 'Send email', 'Formula primary field', 'Calendar and Timeline views'],
};
