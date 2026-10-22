/** The Damage report form, rebuilt as a working demo that feeds 01 · Damage report. */
import type { DemoForm } from '@/lib/airtable/types';

const assets: Record<string, string> = {
  'KGL-0418 · ARRI M18 HMI with ballast': 'recAst03',
  'KGL-0412 · ARRI SkyPanel S60-C #2': 'recAst01',
  'KGL-0231 · Cooke S4/i 32mm': 'recAst04',
  'KGL-0107 · Sony Venice 2 body #1': 'recAst05',
};

export const demo: DemoForm = {
  url: 'airtable.com/appKestrelInv/shrDamageReport',
  title: 'Damage report',
  description: 'Anything broken, worn or unsafe at check-in. The item comes off the shelf as soon as you press Submit.',
  fields: [
    { name: 'asset', label: 'Asset', type: 'dropdown', required: true, options: Object.keys(assets), help: 'Scan or pick the asset tag. Retired gear is not listed.' },
    { name: 'issue', label: 'Issue', type: 'text', required: true, placeholder: 'What is wrong, in a few words' },
    { name: 'severity', label: 'Severity', type: 'dropdown', required: true, options: ['Unsafe', 'Major', 'Minor'], help: 'Unsafe: must not go out again until fixed. Major: needs the repair shop. Minor: we fix it here.' },
    { name: 'details', label: 'Details', type: 'textarea' },
    { name: 'by', label: 'Reported by', type: 'dropdown', required: true, options: ['Kim Tran', 'Luis Ortega', 'Bree Collins'] },
  ],
  submitLabel: 'Submit',
  ending: 'Thanks. The item is marked In repair and the right people have been told.',
  feeds: 'damage-report',
  toRecord: (a) => ({ Asset: [assets[a.asset] ?? 'recAst03'], Issue: a.issue, Severity: a.severity, Details: a.details || null, 'Reported by': a.by }),
  behaviors: [
    { value: 'normal', label: 'Email and Slack both work' },
    { value: 'slack', label: 'Slack has been disconnected', failures: { 'slack-desk': 'The Slack account for this action needs to be reconnected.' } },
  ],
  note: 'Try the M18 as Unsafe: it is booked for a music video this week, so the desk is warned about that job. Then try a Minor scuff and see the vendor groups skipped.',
  notes: [
    { title: 'A form on Maintenance', body: 'Each report is a new Maintenance record. Status, Cost and the vendor lookups are not on the form; the automation and the repair board handle those.' },
    { title: 'Asset picker limited to a view', body: 'Asset is a link field. Its picker reads the Assets view “Active assets”, so retired gear cannot be reported, and the asset tag is the primary field, so typing the tag finds it.' },
    { title: 'Photos as attachments', body: 'The real form has a Photos attachment field; the crew take pictures on the tablet. This demo leaves it out because nothing you pick here is uploaded.' },
    { title: 'The same form in an interface', body: 'The Warehouse interface has a Form page with the same fields, so interface-only crew can report damage without access to the base.' },
  ],
};
