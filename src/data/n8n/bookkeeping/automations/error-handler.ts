import type { Automation, Item, Json, RunContext } from '@/lib/n8n/types';
import { item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const base = business.env.baseUrl;
const vars = business.env.vars;

/** The item the Error Trigger outputs for a failed production execution. */
const failure = (o: { workflowId: string; workflow: string; exec: string; node: string; message: string; mode?: string }): Item =>
  item({
    execution: {
      id: o.exec,
      url: `${base}/workflow/${o.workflowId}/executions/${o.exec}`,
      error: { message: o.message, stack: `NodeApiError: ${o.message}\n    at ExecuteContext.execute` },
      lastNodeExecuted: o.node,
      mode: o.mode ?? 'webhook',
    },
    workflow: { id: o.workflowId, name: o.workflow },
  });

const what = (ctx: RunContext) => (ctx.$('What broke')[0]?.json ?? {}) as Record<string, string | boolean>;

/** Same rule as the If below: workflows tagged client-facing start with 01 or 02. */
const clientFacing = (name: string) => /^0[12] · /.test(name);

export const errorHandler: Automation = {
  id: 'error-handler',
  number: '03',
  name: 'Error handler',
  kicker: 'Reliability',
  tagline: 'Every Ledgerline workflow names this one as its error workflow. When an automatic execution fails, it posts the workflow, the node, the error and a link to the failed execution in #ops, gives Tom a ClickUp task when a client is waiting on it, and stays quiet about the same failure for an hour.',
  problem:
    'Automations fail quietly. A revoked Google token or a renamed ClickUp list stops a workflow, n8n marks the execution red, and nobody looks at the Executions list until a client asks why they never got their welcome email.',
  solution:
    'An Error Trigger starts this workflow whenever a production execution of a workflow that names it fails. Edit Fields pulls out what a person needs: workflow, node, message and the execution URL. Remove Duplicates, keyed on the workflow, the node and the hour, lets the first alert through and drops repeats, so an outage that fails twenty runs is one message, not twenty. An If then asks whether a client is waiting: for onboarding and the document chase, #ops gets an @here and Tom gets a ClickUp task due today with the link to retry; for internal workflows, #ops gets a plain post.',
  workflow: {
    name: '03 · Ops · Error handler',
    folder: 'Ledgerline / Ops',
    tags: ['ops', 'error-workflow'],
    trigger: {
      id: 'error',
      name: 'Error Trigger',
      type: 'Error Trigger',
      icon: 'alert',
      tone: 'trigger',
      summary: 'Runs when a production execution of any workflow that names this one under Settings › Error workflow fails. It does not need to be published. Manual test runs never start it, so it is tested by failing a real execution on purpose.',
    },
    settings: {
      executionOrder: 'v1',
      timezone: 'America/Chicago',
      saveFailed: true,
      saveSuccess: true,
      notes: [
        'No error workflow of its own: n8n does not call an error workflow for a failure inside itself, and a loop of alerts about alerts would help nobody. If Slack is down, its executions show as failed in the list.',
        'Save successful executions on: the history of what failed and when is the monthly reliability review.',
        'Used by every workflow on the instance, including the monthly reporting ones, which are internal.',
      ],
    },
    steps: [
      {
        kind: 'node',
        node: {
          id: 'what',
          name: 'What broke',
          type: 'Edit Fields (Set)',
          icon: 'pen',
          tone: 'core',
          summary: 'Flattens the Error Trigger’s item into the five things an alert needs. execution.url is missing when a trigger node itself failed, since that execution was never saved, so the link falls back to the workflow.',
          params: [
            { k: 'workflow', v: '{{ $json.workflow.name }}' },
            { k: 'node', v: '{{ $json.execution.lastNodeExecuted }}' },
            { k: 'message', v: '{{ $json.execution.error.message }}' },
            { k: 'url', v: "{{ $json.execution.url ?? 'https://n8n.ledgerline.example/workflow/' + $json.workflow.id }}" },
          ],
          run: (items) => ({
            items: items.map((it) => {
              const e = it.json.execution as Json;
              const w = it.json.workflow as Json;
              return item({ workflow: w.name, workflow_id: w.id, node: e.lastNodeExecuted, message: (e.error as Json).message, url: e.url ?? `${base}/workflow/${w.id}`, execution_id: e.id });
            }),
          }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'hourly',
          name: 'Once an hour per failure',
          type: 'Remove Duplicates',
          operation: 'Remove Items Processed in Previous Executions',
          icon: 'dedupe',
          tone: 'core',
          summary: 'Value Is New, keyed on workflow, node and the hour. The first failure of the hour gets through; the same failure again in that hour is dropped, so an outage is one alert. Every failed execution is still in the Executions list.',
          params: [
            { k: 'Keep Items Where', v: 'Value Is New' },
            { k: 'Value to Dedupe On', v: "{{ $json.workflow_id }}|{{ $json.node }}|{{ $now.toFormat('yyyy-MM-dd HH') }}" },
          ],
          run: (items, ctx) => {
            const dup = !!ctx.fixtures.alreadyAlerted;
            return { items: dup ? [] : items, log: dup ? 'Same workflow, node and hour as an earlier alert: dropped.' : 'First alert for this failure this hour.' };
          },
        },
      },
      {
        kind: 'split',
        node: {
          id: 'client',
          name: 'Is a client waiting?',
          type: 'If',
          icon: 'split',
          tone: 'logic',
          summary: 'The client-facing workflows are 01 and 02, and their names start that way by convention. A tag would be nicer, but the Error Trigger sends the workflow’s id and name, not its tags.',
          params: [{ k: 'Condition', v: '{{ $json.workflow }} matches regex ^0[12] · ' }],
          run: (items) => {
            const yes = clientFacing(String(items[0].json.workflow));
            return { outputs: yes ? [items, []] : [[], items], log: yes ? 'Client-facing.' : 'Internal.' };
          },
        },
        branches: [
          {
            label: 'true',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'urgent',
                  name: 'Alert #ops, @here',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Ledgerline Slack (bot)',
                  summary: 'An @here, because a client is waiting. The message says what failed and where, and links straight to the failed execution, where Retry starts again from the failed node.',
                  params: [{ k: 'Channel', v: vars.ops_channel }],
                  run: (items, ctx) => {
                    const w = what(ctx);
                    return { items, messages: [{ channel: 'slack', to: vars.ops_channel, subject: `@here ${w.workflow} failed`, body: `A client is waiting on this one.\nNode: ${w.node}\nError: ${w.message}\nExecution ${w.execution_id}: ${w.url}` }] };
                  },
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'task',
                  name: 'Task for Tom',
                  type: 'ClickUp',
                  operation: 'Task › Create',
                  icon: 'task',
                  tone: 'app',
                  credential: 'Ledgerline ClickUp (OAuth2)',
                  summary: 'Due today, assigned to Tom, with the execution link, so the fix is tracked like any other client work and does not live only in a Slack thread.',
                  params: [
                    { k: 'List', v: 'Ops' },
                    { k: 'Name', v: 'Fix: {{ $json.workflow }} at {{ $json.node }}' },
                  ],
                  run: (_items, ctx) => {
                    const w = what(ctx);
                    return { items: [item({ id: '86b2r19ka', url: 'https://app.clickup.com/t/86b2r19ka' })], messages: [{ channel: 'task', to: 'ClickUp · Tom Reyes', subject: `Fix: ${w.workflow} at ${w.node}`, body: `${w.message}. Due today. Retry the execution once fixed: ${w.url}` }] };
                  },
                },
              },
            ],
          },
          {
            label: 'false',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'quiet',
                  name: 'Post to #ops',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Ledgerline Slack (bot)',
                  summary: 'No @here for internal work: the monthly reports can wait for the morning. Same details and link.',
                  params: [{ k: 'Channel', v: vars.ops_channel }],
                  run: (items, ctx) => {
                    const w = what(ctx);
                    return { items, messages: [{ channel: 'slack', to: vars.ops_channel, subject: `${w.workflow} failed`, body: `Node: ${w.node}\nError: ${w.message}\nExecution ${w.execution_id}: ${w.url}` }] };
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
  scenarios: [
    {
      id: 'onboarding',
      label: 'Onboarding failed at Drive',
      summary: 'The Oakridge Vet onboarding from 01 stopped at Create the client folder. #ops gets an @here with the link, and Tom gets a task due today.',
      start: at(4, 11, 5),
      from: 'from 01 · Onboarding · New client',
      input: [failure({ workflowId: 'client-onboarding', workflow: '01 · Onboarding · New client', exec: '6102', node: 'Create the client folder', message: 'The service was not able to process your request (500 Internal Error)' })],
      expect: { status: 'success', visits: ['what', 'hourly', 'client:0', 'urgent', 'task'], skips: ['quiet'] },
    },
    {
      id: 'internal',
      label: 'A monthly report failed',
      summary: 'The 1st-of-the-month P&L pack could not read QuickBooks after a token expired. Internal, so #ops gets a plain post for the morning and no task.',
      start: at(6, 5, 0),
      from: 'from 05 · Reports · Monthly P&L pack',
      input: [failure({ workflowId: 'monthly-pnl', workflow: '05 · Reports · Monthly P&L pack', exec: '6188', node: 'Get profit and loss', message: 'Authorization failed - please check your credentials (401 Unauthorized)', mode: 'trigger' })],
      expect: { status: 'success', visits: ['client:1', 'quiet'], skips: ['urgent', 'task'] },
    },
    {
      id: 'repeat',
      label: 'The same outage, again',
      summary: 'Drive is still down, and a second onboarding fails at the same node twenty minutes later. Remove Duplicates has already let this hour’s alert through, so nothing is posted; the failed execution is still in the list for Tom.',
      start: at(4, 11, 25),
      from: 'from 01 · Onboarding · New client',
      input: [failure({ workflowId: 'client-onboarding', workflow: '01 · Onboarding · New client', exec: '6107', node: 'Create the client folder', message: 'The service was not able to process your request (500 Internal Error)' })],
      fixtures: { alreadyAlerted: true },
      expect: { status: 'success', visits: ['what', 'hourly'], skips: ['urgent', 'quiet'], items: { hourly: 0 } },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Ledgerline Slack (bot)', type: 'Slack OAuth2', note: 'Posts to #ops.' },
      { name: 'Ledgerline ClickUp (OAuth2)', type: 'ClickUp OAuth2', note: 'Creates tasks in the Ops list.' },
    ],
    fields: [
      { name: 'execution.id, execution.url, execution.error.message, execution.lastNodeExecuted, execution.mode', where: 'Error Trigger output', type: 'Object', note: 'url and id are missing when the failed node was the trigger itself' },
      { name: 'workflow.id, workflow.name', where: 'Error Trigger output', type: 'Object' },
    ],
  },
  build: [
    { title: 'One error workflow for the instance', body: 'An Error Trigger first, then every workflow names this one under Settings › Error workflow. A new workflow is not finished until that setting is made; it is on the go-live checklist.' },
    { title: 'Keep what a person needs', body: 'The Error Trigger sends the execution’s id, URL, error, last node and mode, and the workflow’s id and name. Edit Fields keeps those, and falls back to the workflow’s URL when a trigger failed, because then there is no saved execution to link to.' },
    { title: 'One alert per outage', body: 'Remove Duplicates across executions, on workflow, node and hour. The first failure always gets through, and twenty failures in an outage are one message. The Executions list still shows every one.' },
    { title: 'Urgency by who is waiting', body: 'The Error Trigger does not include tags, so the If reads the name: 01 and 02 are client-facing by the naming convention. Those get an @here and a ClickUp task due today; everything else gets a plain post.' },
    { title: 'Test it the real way', body: 'Manual runs never start an error workflow. I published a copy of 01 with a deliberately wrong Drive folder ID, posted a test request to its production URL, and read the alert that came back.' },
  ],
  edgeCases: [
    { title: 'Slack is the thing that is down', body: 'The alert itself fails, and n8n does not run an error workflow for a failure in the error workflow. Tom’s weekly look at the Executions list, filtered to Error, is the backstop.' },
    { title: 'A trigger fails, not a node', body: 'For example, a Schedule Trigger whose credential was revoked. The item has no execution id or URL, so the message links to the workflow instead, and the If still works from the name.' },
    { title: 'Two different failures in the same hour', body: 'Different nodes or workflows make different keys, so both alert. Only the same failure repeating is quietened.' },
    { title: 'Someone tests 01 by hand and it fails', body: 'No alert. Manual executions do not start the error workflow, which keeps testing noise out of #ops.' },
  ],
  qa: [
    'A published copy of 01 fails on purpose: one @here in #ops with a working execution link, and one ClickUp task',
    'The same failure again within the hour: nothing posted, both executions in the list',
    'An internal workflow failure: plain post, no task',
    'A failing Schedule Trigger: the alert links to the workflow, not to an execution',
    'A manual run that fails: no alert',
  ],
  snippets: [
    {
      title: 'Error Trigger output',
      language: 'json',
      code: JSON.stringify(failure({ workflowId: 'client-onboarding', workflow: '01 · Onboarding · New client', exec: '6102', node: 'Create the client folder', message: 'The service was not able to process your request (500 Internal Error)' }).json, null, 2),
      note: 'Shape of the item for a failed production execution. For a trigger failure, a trigger object replaces execution.',
    },
  ],
  features: ['Error Trigger', 'Error workflow setting', 'Edit Fields (Set)', 'Remove Duplicates (across executions)', 'If (regex)', 'Slack', 'ClickUp'],
};
