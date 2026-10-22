import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const reportApproval: Automation = {
  id: 'report-approval',
  number: '05',
  name: 'Executive sign-off',
  kicker: 'Approval → submit or redraft',
  tagline: 'The executive director’s decision on a report sends it to submission or back to drafting.',
  problem:
    'Rosa reviewed reports from an emailed PDF and replied with notes, or “fine”, or nothing. Grace couldn’t tell an approval from a skim, and one report went to a funder with Rosa’s notes still unaddressed.',
  solution:
    'Each report’s final review is an approval task assigned to Rosa, with the draft attached. Her decision is the trigger. Approved moves it to Ready to submit and hands it to Grace, due tomorrow, because Grace submits through the funder’s portal. Changes requested creates a revision task in Drafting for Noor, who owns the narrative, due in two days, and leaves a comment pointing to it. The approval history on the task is the record the auditor asks for.',
  automation: {
    name: '05 · Act on the executive director’s sign-off',
    project: 'Grant Reporting',
    triggers: [{ type: 'approval' }],
    actions: [],
    paths: [
      {
        id: 'p-approved',
        label: 'Approved',
        when: [{ type: 'approval', is: 'approved' }],
        actions: [
          { type: 'move', section: 'Ready to submit' },
          { type: 'create_task', name: 'Submit the approved report through the funder portal', project: 'Grant Reporting', section: 'Ready to submit', assignee: 'grace', dueIn: 1 },
        ],
      },
      {
        id: 'p-changes',
        label: 'Changes requested',
        when: [{ type: 'approval', is: 'changes_requested' }],
        actions: [
          { type: 'create_task', name: 'Revise the report from Rosa’s notes', project: 'Grant Reporting', section: 'Drafting', assignee: 'noor', dueIn: 2 },
          { type: 'comment', body: '@Noor Haddad changes requested. Rosa’s notes are above. The revision task is in Drafting, due in two days; Grace will add a new final review when it’s ready.' },
        ],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: ['No Rejected path: a report owed to a funder can’t be rejected, only fixed. If Rosa rejects one, it takes no path and Grace calls her.', 'Approvals need Asana Advanced, which the nonprofit discount puts within reach.'],
    },
  },
  scenarios: [
    {
      id: 'approved',
      label: 'Approved first time',
      summary: 'Rosa approves the Q3 report on Tuesday.',
      start: 8 * D + 540,
      task: { name: 'Final review: Q3 report, Salmon Habitat Fund', section: 'Final review', assignee: 'rosa', due: 9, approval: 'pending', fields: { 'Report type': 'Funder report', Grant: 'Salmon Habitat Fund' } },
      events: [{ at: 8 * D + 960, by: 'rosa', type: 'approval', status: 'approved' }],
      expect: { section: 'Ready to submit', completed: true, paths: ['p-approved'] },
    },
    {
      id: 'changes',
      label: 'Changes requested',
      summary: 'Rosa wants the Alder Run gap explained, not buried.',
      start: 8 * D + 540,
      task: { name: 'Final review: Q3 report, Salmon Habitat Fund', section: 'Final review', assignee: 'rosa', due: 9, approval: 'pending', fields: { 'Report type': 'Funder report', Grant: 'Salmon Habitat Fund' } },
      events: [
        { at: 8 * D + 1000, by: 'rosa', type: 'comment', body: 'Page 3: say plainly that Alder Run wasn’t surveyed and why. Funders trust a gap more than a fudge.' },
        { at: 8 * D + 1001, by: 'rosa', type: 'approval', status: 'changes_requested' },
      ],
      expect: { section: 'Final review', completed: true, paths: ['p-changes'] },
    },
    {
      id: 'rejected',
      label: 'Rejected by mistake',
      summary: 'Rosa clicks Reject on her phone; nothing automatic happens.',
      start: 8 * D + 540,
      task: { name: 'Final review: November board packet', section: 'Final review', assignee: 'rosa', due: 9, approval: 'pending', fields: { 'Report type': 'Board report' } },
      events: [{ at: 8 * D + 1200, by: 'rosa', type: 'approval', status: 'rejected' }, { at: 9 * D + 540, by: 'grace', type: 'comment', body: 'Rosa meant Request changes; adding a revision task by hand.' }],
      expect: { section: 'Final review', completed: true },
    },
  ],
  build: [
    { title: 'Final review as an approval', body: 'Created in Final review, assigned to Rosa, with the draft attached and the funder’s due date.' },
    { title: 'Trigger', body: 'Approval status is changed, to any status.' },
    { title: 'Two paths', body: 'Approved: Ready to submit and a submission task for Grace. Changes requested: a revision task for Noor and a comment.' },
    { title: 'Proofing', body: 'Rosa can comment on the attached PDF itself; each note becomes a subtask, so the revision has a checklist.' },
  ],
  edgeCases: [
    { title: 'Rejected', body: 'There’s no path for it on purpose, as in the third sample: a person reads the situation.' },
    { title: 'Approved, then a typo found', body: 'Grace fixes it before submitting and notes it on the submission task. A second approval for a typo would slow the work for nothing.' },
    { title: 'Rosa is travelling', body: 'Ben covers approvals while she’s away: the approval is reassigned to him, and his decision triggers the automation the same way.' },
  ],
  qa: [
    'Approve moves the review to Ready to submit and creates one submission task for Grace due tomorrow.',
    'Request changes creates one revision task for Noor and posts the comment.',
    'Reject runs the automation and takes no path.',
  ],
  features: ['Approvals', 'Approval status is changed', 'Check if paths', 'Create task', 'Proofing', 'Comments'],
};
