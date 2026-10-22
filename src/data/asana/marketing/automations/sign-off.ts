import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const signOff: Automation = {
  id: 'sign-off',
  number: '04',
  name: 'Launch sign-offs',
  kicker: 'Approval → the plan moves',
  tagline: 'The director’s approval decision moves the launch plan on its own.',
  problem:
    'Sign-off on launch assets happened in comment threads and Slack. “Looks good, maybe tweak the end” could mean approved or not. The winter launch slipped twice, once because a video nobody had approved went to paid social, once because a revision request sat unread for three days.',
  solution:
    'Each launch asset has a sign-off task set up as an Asana approval, assigned to Dana and blocked by the work it signs off. Dana has three buttons: Approve, Request changes, Reject. One automation listens for her decision. Approved moves the sign-off to Locked and tells #winter-launch, and the tasks waiting on it are no longer blocked. Changes requested creates a revision task in Creative for the right maker, due in two days. Rejected moves the sign-off to Cut and pulls in the creative lead, because the Creative locked milestone may now move.',
  automation: {
    name: '04 · Act on launch sign-off decisions',
    project: 'Winter Gear Launch',
    triggers: [{ type: 'approval' }],
    actions: [],
    paths: [
      {
        id: 'p-approved',
        label: 'Approved',
        when: [{ type: 'approval', is: 'approved' }],
        actions: [
          { type: 'move', section: 'Locked' },
          { type: 'slack', channel: '#winter-launch', body: 'Signed off. The tasks waiting on this sign-off are unblocked; check Timeline for what starts next.' },
        ],
      },
      {
        id: 'p-video',
        label: 'Changes to video',
        when: [{ type: 'approval', is: 'changes_requested' }, { type: 'field', key: 'Asset', op: 'is', value: 'Video' }],
        actions: [
          { type: 'create_task', name: 'Revise hero video from sign-off notes', project: 'Winter Gear Launch', section: 'Creative', assignee: 'theo', dueIn: 2 },
          { type: 'comment', body: '@Theo Banerjee changes requested. Dana’s notes are in the comments above. The revision task is in Creative, due in two days; add a new sign-off when it’s ready.' },
        ],
      },
      {
        id: 'p-changes',
        label: 'Changes to anything else',
        when: [{ type: 'approval', is: 'changes_requested' }, { type: 'field', key: 'Asset', op: 'is_not', value: 'Video' }],
        actions: [
          { type: 'create_task', name: 'Revise from sign-off notes', project: 'Winter Gear Launch', section: 'Creative', assignee: 'jun', dueIn: 2 },
          { type: 'comment', body: '@Jun Okafor changes requested. Dana’s notes are in the comments above. The revision task is in Creative, due in two days; add a new sign-off when it’s ready.' },
        ],
      },
      {
        id: 'p-rejected',
        label: 'Rejected',
        when: [{ type: 'approval', is: 'rejected' }],
        actions: [
          { type: 'move', section: 'Cut' },
          { type: 'collaborators', users: ['ava'] },
          { type: 'slack', channel: '#marketing-leads', body: 'A launch asset was rejected at sign-off and moved to Cut. Creative locked may move: Ava and Dana to agree the plan today.' },
        ],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: [
        'Approvals need Asana Advanced. All three decisions complete the approval task, so the dependent tasks are unblocked on Approve and on the other two as well; that is why Changes requested and Rejected create work or a conversation straight away.',
        'Revisions get a new task instead of reopening the approval, so the approval keeps an honest history of each decision.',
      ],
    },
  },
  scenarios: [
    {
      id: 'approved',
      label: 'Approved',
      summary: 'Dana approves the landing page on Thursday.',
      start: 7 * D + 540,
      task: { name: 'Sign-off: landing page', section: 'Sign-off', assignee: 'dana', due: 9, approval: 'pending', fields: { Asset: 'Web' } },
      events: [{ at: 9 * D + 630, by: 'dana', type: 'approval', status: 'approved' }],
      expect: { section: 'Locked', completed: true, paths: ['p-approved'] },
    },
    {
      id: 'video-changes',
      label: 'Changes to the video',
      summary: 'Dana wants the color grade warmer before it goes to paid social.',
      start: 7 * D + 540,
      task: { name: 'Sign-off: hero video', section: 'Sign-off', assignee: 'dana', due: 9, approval: 'pending', fields: { Asset: 'Video' } },
      events: [
        { at: 8 * D + 1010, by: 'dana', type: 'comment', body: 'Grade is too cold for a cozy-layers story. Warm it up, and trim the last two seconds.' },
        { at: 8 * D + 1012, by: 'dana', type: 'approval', status: 'changes_requested' },
      ],
      expect: { section: 'Sign-off', paths: ['p-video'] },
    },
    {
      id: 'web-changes',
      label: 'Changes to the page',
      summary: 'The landing page needs the price above the fold.',
      start: 8 * D + 540,
      task: { name: 'Sign-off: landing page', section: 'Sign-off', assignee: 'dana', due: 9, approval: 'pending', fields: { Asset: 'Web' } },
      events: [{ at: 9 * D + 700, by: 'dana', type: 'approval', status: 'changes_requested', note: 'With a comment: price above the fold on mobile.' }],
      expect: { section: 'Sign-off', paths: ['p-changes'] },
    },
    {
      id: 'rejected',
      label: 'Rejected',
      summary: 'Retail’s in-store poster doesn’t fit the new positioning.',
      start: 8 * D + 540,
      task: { name: 'Sign-off: in-store poster', section: 'Sign-off', assignee: 'dana', due: 9, approval: 'pending', fields: { Asset: 'Retail' } },
      events: [{ at: 9 * D + 900, by: 'dana', type: 'approval', status: 'rejected' }],
      expect: { section: 'Cut', paths: ['p-rejected'] },
    },
  ],
  build: [
    { title: 'Sign-offs as approvals', body: 'In the project template, each sign-off is an approval task assigned to Dana, blocked by the asset it signs off, and itself blocking the Creative locked milestone.' },
    { title: 'Trigger', body: 'Approval status is changed, to any status. One automation, so all sign-off logic is in one place.' },
    { title: 'Check if, four paths', body: 'Approved; Changes requested and Asset is Video; Changes requested and Asset is not Video; Rejected. Two conditions on a path must both be true.' },
    { title: 'Revision tasks', body: 'Create task in Creative with the maker and a two-day due date, plus a comment on the sign-off pointing to it.' },
    { title: 'Template', body: 'Saved into the Seasonal launch template, so next season’s project starts with the automation, the approvals and the dependencies already wired.' },
  ],
  edgeCases: [
    { title: 'Someone other than Dana approves', body: 'Anyone with edit access can complete an approval. The launch project is comment-only for everyone outside marketing, so only the team can.' },
    { title: 'Changes requested twice', body: 'Each decision creates its own revision task, so the second round of notes never overwrites the first.' },
    { title: 'Approved by mistake', body: 'Dana reopens it and decides again. The Slack message has gone, so she says so in the thread; the automation doesn’t pretend to undo a message.' },
    { title: 'A new kind of asset', body: 'Anything not Video goes to Jun. When the team hires a second editor, the video path gets a second condition on Asset.' },
  ],
  qa: [
    'Approve moves the sign-off to Locked and posts once to #winter-launch.',
    'Changes requested on a video creates one task in Creative for Theo, due in two days.',
    'Changes requested on web creates one task for Jun.',
    'Reject moves to Cut and adds Ava.',
    'Dependent tasks on Timeline show as unblocked after the decision.',
  ],
  features: ['Approvals', 'Dependencies', 'Milestones', 'Timeline', 'Automations', 'Check if paths', 'Project templates', 'Asana for Slack'],
};
