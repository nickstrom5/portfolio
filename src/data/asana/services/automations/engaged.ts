import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const engaged: Automation = {
  id: 'engaged',
  number: '03',
  name: 'Engaged → onboarding',
  kicker: 'Signed → onboarding starts',
  tagline: 'A signed engagement starts onboarding the same hour, with the request list for that service.',
  problem:
    'After a client signed, onboarding waited for Sam to notice, set up a project and remember which documents a tax client needs versus a bookkeeping client. Two spring clients waited three weeks for their first request list. One got the wrong list.',
  solution:
    'When the engagement letter comes back signed, Owen moves the prospect to Engaged. The automation adds Sam as a collaborator, creates a task in the Client Ops queue to spin up the onboarding project from the template, and posts the win to #new-clients. Then it checks Service and adds the right request list as subtasks: bank feeds and statements for bookkeeping, prior returns and an IRS Form 8821 for tax, the cap table and forecasts for CFO work. Sam makes the project from the template in two clicks; its dates count from the kickoff date he picks.',
  automation: {
    name: '03 · Start onboarding when a client signs',
    project: 'New Client Intake',
    triggers: [{ type: 'moved', section: 'Engaged' }],
    actions: [
      { type: 'collaborators', users: ['sam'] },
      { type: 'create_task', name: 'Create onboarding project from the Client onboarding template', project: 'Client Ops', section: 'To do', assignee: 'sam', dueIn: 1 },
      { type: 'slack', channel: '#new-clients', body: 'New client engaged. Onboarding project goes up tomorrow; the request list is on the intake task.' },
    ],
    paths: [
      {
        id: 'p-books',
        label: 'Bookkeeping',
        when: [{ type: 'field', key: 'Service', op: 'is', value: 'Bookkeeping' }],
        actions: [{ type: 'subtasks', items: [{ name: 'Request: connect bank and card feeds', assignee: 'owen' }, { name: 'Request: last 12 months of statements', assignee: 'owen' }, { name: 'Request: payroll provider access', assignee: 'owen' }] }],
      },
      {
        id: 'p-tax',
        label: 'Tax',
        when: [{ type: 'field', key: 'Service', op: 'is', value: 'Tax' }],
        actions: [{ type: 'subtasks', items: [{ name: 'Request: prior three years of returns', assignee: 'owen' }, { name: 'Request: signed IRS Form 8821', assignee: 'owen' }, { name: 'Request: year-to-date financials', assignee: 'owen' }] }],
      },
      {
        id: 'p-cfo',
        label: 'Fractional CFO',
        when: [{ type: 'field', key: 'Service', op: 'is', value: 'Fractional CFO' }],
        actions: [{ type: 'subtasks', items: [{ name: 'Request: cap table and board deck', assignee: 'owen' }, { name: 'Request: current forecast and budget', assignee: 'owen' }, { name: 'Schedule: first weekly finance meeting', assignee: 'elena' }] }],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: [
        'No else path: a task can’t reach Engaged with Service still Not sure, because automation 01 keeps those in Inquiries until it is set.',
        'It creates a setup task rather than the project itself, so Sam picks the kickoff date the template’s relative due dates count from. That is one human step, made fast by the template.',
      ],
    },
  },
  scenarios: [
    {
      id: 'books',
      label: 'The bakery signs',
      summary: 'A bookkeeping engagement comes back signed on Wednesday.',
      start: 2 * D + 540,
      task: { name: 'Larkspur Bakery LLC', section: 'Engagement letter', assignee: 'sam', due: 2, fields: { Service: 'Bookkeeping', 'Conflict check': 'Clear', 'Monthly fee': 650 } },
      events: [{ at: 2 * D + 820, by: 'owen', type: 'move', section: 'Engaged', note: 'The signed letter came back by e-signature.' }],
      expect: { section: 'Engaged', paths: ['p-books'] },
    },
    {
      id: 'tax',
      label: 'The clinic signs for tax',
      summary: 'The S corp clinic signs; the tax request list goes out.',
      start: 3 * D + 540,
      task: { name: 'Ridgeway Physical Therapy', section: 'Engagement letter', assignee: 'marcus', due: 4, fields: { Service: 'Tax', 'Conflict check': 'Clear', 'Monthly fee': 900 } },
      events: [{ at: 4 * D + 660, by: 'owen', type: 'move', section: 'Engaged' }],
      expect: { section: 'Engaged', paths: ['p-tax'] },
    },
    {
      id: 'cfo',
      label: 'The startup signs for CFO work',
      summary: 'Elena’s new client; the first meeting is hers to book.',
      start: 1 * D + 540,
      task: { name: 'Vantage Robotics', section: 'Engagement letter', assignee: 'elena', due: 2, fields: { Service: 'Fractional CFO', 'Conflict check': 'Clear', 'Monthly fee': 6500 } },
      events: [{ at: 1 * D + 1000, by: 'owen', type: 'move', section: 'Engaged' }],
      expect: { section: 'Engaged', paths: ['p-cfo'] },
    },
  ],
  build: [
    { title: 'Trigger', body: 'Task moved to a section: Engaged. Owen moves it when the signed letter is back, so the trigger is a fact, not a hope.' },
    { title: 'Always', body: 'Add Sam as collaborator, create the setup task in Client Ops for tomorrow, and post to #new-clients.' },
    { title: 'Request list by service', body: 'Check if Service is Bookkeeping, Tax or Fractional CFO, each adding its own subtasks for Owen.' },
    { title: 'The template', body: 'Client onboarding: five sections, relative due dates from kickoff, dependencies, three milestones, and automations 04 and 05 included, so every new project chases on its own.' },
    { title: 'The portfolio', body: 'Each new onboarding project is added to Client onboardings · Q4, so the partners see every new client’s status in one list.' },
  ],
  edgeCases: [
    { title: 'Moved to Engaged by mistake', body: 'The Slack post has gone and the subtasks exist. Owen moves the task back and deletes the subtasks; the Client Ops task is closed as not needed. The run history shows exactly what to undo.' },
    { title: 'Two services', body: 'A client signing for bookkeeping and tax has Service set to the main one. The second list is added from a saved task template by hand.' },
    { title: 'Template changes', body: 'Editing the template changes future projects only. Projects already running keep their version, which is what you want mid-onboarding.' },
  ],
  qa: [
    'Moving a bookkeeping client to Engaged adds Sam, three request subtasks, one Client Ops task due tomorrow and one Slack post.',
    'Tax and CFO clients get their own lists.',
    'A project made from the template has dates counted from the kickoff date picked.',
  ],
  features: ['Section triggers', 'Create task', 'Subtasks', 'Check if paths', 'Project templates', 'Relative due dates', 'Portfolios', 'Asana for Slack'],
};
