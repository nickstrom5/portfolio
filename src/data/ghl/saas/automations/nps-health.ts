import type { Automation, Contact } from '@/lib/ghl/types';
import { formatDay, nextWeekdayAt } from '@/lib/ghl/engine';

const DAY = 1440;
const WEEKDAYS = [0, 1, 2, 3, 4];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** Last quarter's answer. The first step clears all three, so the tag is always the latest answer. */
const NPS_TAGS = ['nps-detractor', 'nps-passive', 'nps-promoter'];

const company = (c: Contact) => String(c.fields.company ?? `${c.firstName} ${c.lastName}`);
const comment = (c: Contact) => String(c.fields.nps_comment ?? '').trim();

/** Update Contact Field on Account Health, logged as a change. */
function setHealth(to: string) {
  return ({ contact }: { contact: Contact }) => {
    const was = String(contact.fields.account_health ?? '');
    return {
      effect: { fields: { account_health: to } },
      log: was && was !== to ? `Account Health: ${was} → ${to}.` : was === to ? `Account Health stays ${to}.` : `Account Health set to ${to}.`,
    };
  };
}

/** Commercial emails carry the postal address; the unsubscribe link sits in the template footer. */
const footer = '\n\n{{location.name}}, {{location.address}}';

const sorry = {
  subject: 'Thank you for being straight with us',
  body:
    'Hi {{contact.first_name}},\n\nThank you for answering our survey, and for being honest. Your answer tells me Crewlo is not working the way your team needs it to, and I want to understand why.\n\nI will call you within one business day. If email is easier, or there is a better number or time to reach you, reply here and I will work around you.\n\nLeo Park\nCustomer Success, Crewlo',
};

const ten = {
  subject: 'What would make Crewlo a 10 for you?',
  body:
    'Hi {{contact.first_name}},\n\nThanks for answering our survey. You gave Crewlo {{contact.nps}} out of 10, which I read as: it works, but something is missing.\n\nWhat is the one thing that would make it a 10 for you? A line or two is plenty. Just reply to this email. I read every answer myself, and I pass product ideas to the team that builds Crewlo.\n\nLeo Park\nCustomer Success, Crewlo',
};

const survey = `Survey: Quarterly NPS                               Sites › Surveys
Sticky Contact: on

1  Radio Select   "How likely are you to recommend Crewlo to a friend
                   or colleague?"
                   Options 0 to 10          Field: NPS Answer   Required
                   Option scores (Math Calculations): each option
                   scores its own number, so "0" scores 0 and "10" scores 10
   Score          Field: NPS Score, unique key nps = the NPS Answer score
2  Multi line     "What is the main reason for your answer?"
                   Field: NPS Comment, unique key nps_comment   Optional
3  Email          Required, so the answer lands on the customer's record.
                   Sticky Contact fills it in when the browser has it.

On submit: "Thank you. Leo Park reads every answer."

Sent by a quarterly email campaign from Leo to the Customers
smart list (tag customer), linking the survey page.`;

const slackBody = `{
  "text": "NPS detractor: {{contact.company}} answered {{contact.nps}}. Leo Park is calling today.",
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "Detractor: {{contact.company}} ({{contact.nps}}/10)" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Contact*\\n{{contact.name}}" },
        { "type": "mrkdwn", "text": "*Plan*\\n{{contact.plan}}, {{contact.seats}} seats" },
        { "type": "mrkdwn", "text": "*Account health*\\n{{contact.account_health}}" },
        { "type": "mrkdwn", "text": "*Next step*\\nLeo Park calls today" }
      ]
    },
    {
      "type": "context",
      "elements": [
        { "type": "mrkdwn", "text": "The comment is in Leo's email and on the contact record, not in Slack." }
      ]
    }
  ]
}`;

export const npsHealth: Automation = {
  id: 'nps-health',
  number: '06',
  name: 'NPS and health',
  kicker: 'Customer success',
  tagline:
    'Every answer to the quarterly NPS survey gets its own response. Detractors get a call from the customer success manager the same day, passives get one question, and promoters get the referral link. Nobody is asked for a public review because of their score.',
  problem:
    'Crewlo sent an NPS survey every quarter and read the results in a spreadsheet weeks later. By then an unhappy customer had been unhappy for a month, the comments from the 7s and 8s had gone unanswered, and the customers who would gladly have recommended Crewlo were never asked.',
  solution:
    'The survey writes the score to the contact, and one If/Else sorts the answer. A 0 to 6 sets Account Health to At risk, emails Leo the comment, gives him a call task due today, posts to #cs-alerts and sends a short note from Leo saying he will call. A 7 or 8 gets one question from Leo, what would make it a 10, and a reply goes straight to him. A 9 or 10 gets the referral link, plus a case-study invite a few days later if they have never been asked. Anything unexpected, a missing score included, takes the detractor path, so a person looks at it.',
  workflow: {
    name: '06 · Customer Success · NPS and Health',
    folder: 'Customer Success',
    triggers: [{ title: 'Survey Submitted', filters: ['Survey is Quarterly NPS'], label: 'Survey Submitted (Quarterly NPS)' }],
    settings: {
      allowReEntry: true,
      stopOnResponse: false,
      timezone: 'contact',
      timeWindow: { start: '08:00', end: '18:00', days: WEEKDAYS },
      senderName: 'Leo Park, Crewlo',
      notes: [
        'Allow Re-entry on: the same customers answer every quarter. GHL does not let a contact re-enter while still active, and the longest path ends within ten days, long before the next survey.',
        'Stop on Response off: the passive path waits for a reply on purpose. With it on, that reply would end the run instead of taking the Replied branch to Leo. A "thanks" to the referral email should not cancel anything either.',
        "Time Window Monday to Friday, 8 AM to 6 PM, contact time zone. It holds the emails to the customer; the tags, Account Health, Leo's alert and task and the Slack post run the moment the answer lands.",
        'Sender Details: From Name Leo Park, From Email leo@crewlo.example. Every email here is from him, so replies reach the person who can act on them.',
        "Email only: the demo form's text consent covers booking reminders and product news, not survey follow-ups or referral asks.",
        'Custom Webhook is a premium action, billed per execution. It runs for detractors only.',
      ],
    },
    steps: [
      {
        id: 'untag',
        kind: 'action',
        action: 'remove_tag',
        title: 'Remove Contact Tag',
        label: "Clear last quarter's answer",
        summary: 'Removes nps-detractor, nps-passive and nps-promoter, so the tag on the contact is always the latest answer and smart lists count each customer once.',
        run: ({ contact }) => {
          const old = contact.tags.filter((t) => NPS_TAGS.includes(t));
          return {
            effect: { removeTags: NPS_TAGS },
            log: old.length ? `Removed ${old.join(', ')}, last quarter's answer.` : 'No NPS tag from an earlier quarter, so there is nothing to remove.',
          };
        },
      },
      {
        id: 'score',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Promoter, passive or detractor?',
        branches: [
          {
            label: 'Promoter: 9 or 10',
            when: { type: 'field', key: 'nps', op: 'gt', value: 8, label: 'NPS Score is greater than 8' },
            nodes: [
              {
                id: 'tag-promoter',
                kind: 'action',
                action: 'add_tag',
                title: 'Add Contact Tag',
                label: 'nps-promoter',
                summary: 'Latest answer: promoter. The Promoters smart list and the quarterly report filter on it.',
                effect: { addTags: ['nps-promoter'] },
              },
              {
                id: 'health-good',
                kind: 'action',
                action: 'update_field',
                title: 'Update Contact Field',
                label: 'Account Health: Healthy',
                summary: 'Account Health is set from the latest answer. Leo can change it by hand after a conversation.',
                run: setHealth('Healthy'),
              },
              {
                id: 'email-referral',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Referral program',
                summary:
                  'Thanks them for the score and offers the referral program through the Referral page trigger link, inserted with the picker. It opens their own referral page in the app. No review ask, and no mention of reviews.',
                message: {
                  channel: 'email',
                  subject: 'Thank you, {{contact.first_name}}',
                  body:
                    'Hi {{contact.first_name}},\n\nThank you for the {{contact.nps}}. It is good to hear Crewlo is doing its job for {{contact.company}}.\n\nIf you know another field-service company that still schedules on a whiteboard or in a group chat, this link opens your referral page in Crewlo, with a personal link you can send them: {{trigger_link.referral}}\n\nWhen a company you refer becomes a Crewlo customer, you both get a month free.\n\nLeo Park\nCustomer Success, Crewlo' +
                    footer,
                },
              },
              {
                id: 'case-study',
                kind: 'ifelse',
                title: 'If/Else',
                label: 'Asked for a case study before?',
                branches: [
                  {
                    label: 'Never asked',
                    when: { type: 'no_tag', has: 'case-study-invited' },
                    nodes: [
                      {
                        id: 'wait-case',
                        kind: 'wait',
                        title: 'Wait',
                        label: 'Four days',
                        mode: 'time',
                        minutes: 4 * DAY,
                        summary: 'Four days after the referral email, so each email carries one ask.',
                      },
                      {
                        id: 'email-case',
                        kind: 'action',
                        action: 'send_email',
                        title: 'Send Email',
                        label: 'Case-study invite',
                        summary: 'An easy no. They approve every word before anything is published, and nothing is paid or discounted for taking part.',
                        message: {
                          channel: 'email',
                          subject: 'Would you be open to a short case study?',
                          body:
                            'Hi {{contact.first_name}},\n\nOne more question, and no is a perfectly good answer.\n\nWe are writing a few short case studies about how field-service teams run their day in Crewlo. Would {{contact.company}} be open to a 30-minute call with me about it? We write it up, you approve every word before anything is published, and you can pull out at any point.\n\nIf you are interested, reply and I will send a few times.\n\nLeo Park\nCustomer Success, Crewlo' +
                            footer,
                        },
                      },
                      {
                        id: 'tag-case',
                        kind: 'action',
                        action: 'add_tag',
                        title: 'Add Contact Tag',
                        label: 'case-study-invited',
                        summary: 'One case-study ask per customer. Next quarter the If/Else above sends a repeat promoter to the None branch.',
                        effect: { addTags: ['case-study-invited'] },
                      },
                    ],
                  },
                ],
                otherwise: {
                  label: 'Asked before',
                  nodes: [
                    {
                      id: 'end-asked',
                      kind: 'end',
                      title: 'End',
                      summary: 'They were invited in an earlier quarter. The referral email is enough; asking again every quarter would turn a thank-you into a chore.',
                    },
                  ],
                },
              },
            ],
          },
          {
            label: 'Passive: 7 or 8',
            when: {
              type: 'all',
              label: 'NPS Score is greater than 6 and less than 9',
              of: [
                { type: 'field', key: 'nps', op: 'gt', value: 6 },
                { type: 'field', key: 'nps', op: 'lt', value: 9 },
              ],
            },
            nodes: [
              {
                id: 'tag-passive',
                kind: 'action',
                action: 'add_tag',
                title: 'Add Contact Tag',
                label: 'nps-passive',
                summary: 'Latest answer: passive.',
                effect: { addTags: ['nps-passive'] },
              },
              {
                id: 'health-watch',
                kind: 'action',
                action: 'update_field',
                title: 'Update Contact Field',
                label: 'Account Health: Watch',
                summary: 'Not at risk, but not safe either. Leo reviews the Watch list before renewals.',
                run: setHealth('Watch'),
              },
              {
                id: 'email-ten',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'What would make it a 10?',
                summary: 'One question from Leo, answered by replying. Plain text, no links, nothing to click.',
                message: { channel: 'email', subject: ten.subject, body: ten.body },
              },
              {
                id: 'wait-reply',
                kind: 'wait',
                title: 'Wait',
                label: 'Replied?',
                mode: 'event',
                event: 'reply',
                minutes: 5 * DAY,
                summary: 'The contact to reply, Reply To channel Email, Timeout 5 days. A reply goes down the Replied branch to Leo.',
                branches: {
                  met: {
                    label: 'Replied',
                    nodes: [
                      {
                        id: 'notify-reply',
                        kind: 'action',
                        action: 'internal_notification',
                        title: 'Internal Notification',
                        label: 'Tell Leo',
                        summary: 'Type of Notification: Notification (in-app), To User Type: Particular Users, Leo Park, with the contact as the Redirect Page.',
                        message: {
                          channel: 'internal',
                          to: 'Leo Park',
                          subject: '{{contact.first_name}} answered "what would make it a 10"',
                          body: '{{contact.name}}, {{contact.company}}, answered {{contact.nps}} on the survey and replied to your follow-up. The reply is in Conversations, on the email thread. A task to answer it is due the next business day.',
                        },
                      },
                      {
                        id: 'task-reply',
                        kind: 'action',
                        action: 'add_task',
                        title: 'Add Task',
                        label: 'Answer the reply',
                        summary: 'Assigned to Leo Park, Due In 1 day, Skip Weekends on. The description says to answer the customer and pass any product idea to the product team.',
                        run: ({ contact, now }) => ({
                          log: `Task for Leo Park, due ${formatDay(nextWeekdayAt(now, now % DAY))}: "Answer ${contact.firstName} ${contact.lastName}, ${company(contact)}: what would make it a 10". The reply is in Conversations.`,
                        }),
                      },
                    ],
                  },
                  timeout: {
                    label: 'No reply in 5 days',
                    nodes: [
                      {
                        id: 'note-quiet',
                        kind: 'action',
                        action: 'add_note',
                        title: 'Add to Notes',
                        label: 'For the next check-in',
                        summary: 'Note titled Quarterly NPS, with the score and the comment, for whoever talks to them next. No second email: one unanswered question is enough.',
                        run: ({ contact }) => {
                          const why = comment(contact);
                          return {
                            log: `Note on ${contact.firstName}'s record: "Quarterly NPS: ${contact.fields.nps}, passive. ${why ? `Comment: ${why} ` : 'No comment. '}No answer to 'what would make it a 10?' within 5 days. Worth asking at the next check-in."`,
                          };
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
        otherwise: {
          label: 'Detractor: 0 to 6, or no score',
          nodes: [
            {
              id: 'tag-detractor',
              kind: 'action',
              action: 'add_tag',
              title: 'Add Contact Tag',
              label: 'nps-detractor',
              summary: 'Latest answer: detractor. Recorded first, so reports are right even if a later step fails.',
              effect: { addTags: ['nps-detractor'] },
            },
            {
              id: 'health-risk',
              kind: 'action',
              action: 'update_field',
              title: 'Update Contact Field',
              label: 'Account Health: At risk',
              summary: 'The At risk smart list is the first thing Leo opens each morning.',
              run: setHealth('At risk'),
            },
            {
              id: 'notify-leo',
              kind: 'action',
              action: 'internal_notification',
              title: 'Internal Notification',
              label: 'Email Leo the comment',
              summary:
                'Type of Notification: Email, To User Type: Particular Users, Leo Park. Not the assigned user: many customers are still owned by the account executive who closed them.',
              message: {
                channel: 'internal',
                to: 'Leo Park',
                subject: 'Detractor: {{contact.company}} answered {{contact.nps}}',
                body:
                  '{{contact.name}} ({{contact.email}}, {{contact.phone}}) answered the Quarterly NPS survey with {{contact.nps}}.\n\nTheir reason:\n{{contact.nps_comment}}\n\nPlan {{contact.plan}}, {{contact.seats}} seats. Account Health is now At risk.\n\nYour call task is due today. They get a short email from you saying you will call within one business day.',
              },
            },
            {
              id: 'task-call',
              kind: 'action',
              action: 'add_task',
              title: 'Add Task',
              label: 'Call today',
              summary: 'Assigned to Leo Park, Due In Now, so it is due today and sits at the top of his list. The description has the score, the comment and the phone number.',
              run: ({ contact, now }) => {
                const why = comment(contact);
                return {
                  log: `Task for Leo Park, due today (${formatDay(now)}): "Call ${contact.firstName} ${contact.lastName}, ${company(contact)}: NPS ${contact.fields.nps}". ${why ? `Comment: "${why}" ` : 'No comment left. '}Read Conversations first, then call ${contact.phone}.`,
                };
              },
            },
            {
              id: 'slack',
              kind: 'action',
              action: 'webhook',
              title: 'Custom Webhook',
              label: 'Post to #cs-alerts',
              summary:
                'Premium. Event CUSTOM, Method POST, Content-Type application/json, to a Slack incoming webhook for #cs-alerts, a private channel. Company, score, plan, health and the next step; no email, phone or comment.',
              message: {
                channel: 'slack',
                to: '#cs-alerts',
                subject: 'Detractor: {{contact.company}} ({{contact.nps}}/10)',
                body: 'Contact: {{contact.name}}\nPlan: {{contact.plan}}, {{contact.seats}} seats\nAccount health: {{contact.account_health}}\nNext step: Leo Park calls today\nThe comment is in Leo\'s email and on the contact record, not in Slack.',
              },
              code: { language: 'json', source: slackBody },
            },
            {
              id: 'email-sorry',
              kind: 'action',
              action: 'send_email',
              title: 'Send Email',
              label: 'Heard you, will call',
              summary: 'Short and from Leo: thanks, no excuses, a promise to call within one business day, and a way to say email is easier. The Time Window holds it to business hours.',
              message: { channel: 'email', subject: sorry.subject, body: sorry.body },
            },
          ],
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'detractor',
      label: 'Detractor, mid-afternoon',
      summary:
        'Victor was a 7 last quarter. On Tuesday afternoon he answers 4: the mobile app keeps logging his crew leads out. Leo has the comment, a task and a Slack post within seconds, and Victor has a note from Leo.',
      start: at(1, 14, 47),
      contact: {
        firstName: 'Victor',
        lastName: 'Salas',
        email: 'victor@salaslandscape.example',
        phone: '(210) 555-0158',
        timezone: 'America/Chicago',
        source: 'Website demo form',
        tags: ['customer', 'nps-passive'],
        assignedTo: 'ben',
        fields: {
          company: 'Salas Landscape Co.',
          plan: 'standard-monthly',
          seats: 12,
          workspace_id: 'ws_5KT8PM',
          account_health: 'Watch',
          nps: 4,
          nps_comment: 'The dispatch board is fine, but the mobile app logs my crew leads out every few days and they end up calling the office for their jobs.',
        },
      },
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['untag', 'score:else', 'tag-detractor', 'health-risk', 'notify-leo', 'task-call', 'slack', 'email-sorry'],
        tags: ['customer', 'nps-detractor'],
      },
    },
    {
      id: 'passive-replies',
      label: 'Passive who replies',
      summary: 'Jenna answers 7 on Monday morning. Leo asks what would make it a 10, and she replies after lunch: a live map of her techs. Leo gets the reply and a task.',
      start: at(0, 10, 26),
      contact: {
        firstName: 'Jenna',
        lastName: 'Morales',
        email: 'jenna@clearwaterpoolcare.example',
        phone: '(407) 555-0131',
        timezone: 'America/New_York',
        source: 'Crewlo app signup',
        tags: ['customer', 'nps-promoter'],
        fields: {
          company: 'Clearwater Pool Care',
          plan: 'standard-annual',
          seats: 6,
          workspace_id: 'ws_3HD7QW',
          account_health: 'Healthy',
          nps: 7,
          nps_comment: 'Works well for us. Reporting is pretty basic.',
        },
      },
      events: [
        {
          at: at(0, 13, 5) - at(0, 10, 26),
          type: 'reply',
          channel: 'email',
          value: 'Honestly, a live map of where each tech is. Right now I still call them to find out who is running late.',
        },
      ],
      expect: {
        outcome: 'completed',
        visits: ['untag', 'score:1', 'tag-passive', 'health-watch', 'email-ten', 'wait-reply:met', 'notify-reply', 'task-reply'],
        tags: ['customer', 'nps-passive'],
      },
    },
    {
      id: 'passive-silent',
      label: 'Passive, Friday night, no reply',
      summary:
        'Hector answers 8 at 7:34 on Friday evening, with no comment. The tag and Account Health change at once; Leo\'s question waits for Monday at 8 AM. Hector opens it but never replies, so a note is left for the next check-in.',
      start: at(4, 19, 34),
      contact: {
        firstName: 'Hector',
        lastName: 'Ruiz',
        email: 'hector@ruizappliance.example',
        phone: '(303) 555-0174',
        timezone: 'America/Denver',
        source: 'Google ads',
        tags: ['customer'],
        fields: { company: 'Ruiz Appliance Repair', plan: 'standard-monthly', seats: 4, workspace_id: 'ws_9RB2LX', nps: 8 },
      },
      events: [{ at: at(7, 9, 20) - at(4, 19, 34), type: 'email_opened' }],
      expect: {
        outcome: 'completed',
        visits: ['score:1', 'health-watch', 'email-ten', 'wait-reply:timeout', 'note-quiet'],
        tags: ['customer', 'nps-passive'],
      },
    },
    {
      id: 'promoter',
      label: 'Promoter, first case-study ask',
      summary:
        'Rachel answers 10 on Wednesday morning. She gets the referral email at once and opens her referral page before lunch. Four days later falls on a Sunday, so the case-study invite goes on Monday at 8 AM.',
      start: at(2, 9, 12),
      contact: {
        tags: ['customer', 'nps-passive'],
        fields: {
          company: 'Brightline HVAC',
          plan: 'standard-monthly',
          seats: 9,
          workspace_id: 'ws_7Q2M9K',
          account_health: 'Watch',
          nps: 10,
          nps_comment: 'Our dispatcher finally has one screen for the whole day.',
        },
      },
      events: [
        { at: at(2, 9, 30) - at(2, 9, 12), type: 'email_opened' },
        { at: at(2, 12, 40) - at(2, 9, 12), type: 'link_clicked', value: 'referral', label: 'Referral page' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['untag', 'score:0', 'tag-promoter', 'health-good', 'email-referral', 'case-study:0', 'wait-case', 'email-case', 'tag-case'],
        tags: ['customer', 'nps-promoter', 'case-study-invited'],
      },
    },
    {
      id: 'promoter-asked',
      label: 'Promoter, asked before',
      summary: 'Amy answers 9 on Thursday afternoon. She was invited to a case study last quarter, so she gets the referral email and nothing else.',
      start: at(3, 13, 30),
      contact: {
        firstName: 'Amy',
        lastName: 'Chen',
        email: 'amy@chenmechanical.example',
        phone: '(206) 555-0147',
        timezone: 'America/Los_Angeles',
        source: 'Website demo form',
        tags: ['customer', 'nps-promoter', 'case-study-invited'],
        assignedTo: 'aisha',
        fields: {
          company: 'Chen Mechanical',
          plan: 'standard-annual',
          seats: 23,
          workspace_id: 'ws_2VN6TE',
          account_health: 'Healthy',
          nps: 9,
          nps_comment: 'Solid product, and support answers fast.',
        },
      },
      events: [],
      expect: {
        outcome: 'ended',
        visits: ['untag', 'score:0', 'health-good', 'email-referral', 'case-study:else', 'end-asked'],
        tags: ['customer', 'nps-promoter', 'case-study-invited'],
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'NPS Score', key: 'nps', type: 'Score', note: '0 to 10, from the survey Score field. The If/Else compares it as a number.' },
      { name: 'NPS Answer', key: 'nps_answer', type: 'Radio Select', note: 'Options 0 to 10, each scored with its own number. It feeds NPS Score.' },
      { name: 'NPS Comment', key: 'nps_comment', type: 'Multi line', note: 'Optional. No "score" in the name, or GHL treats it as a scoring element.' },
      { name: 'Account Health', key: 'account_health', type: 'Dropdown (single)', note: 'Healthy · Watch · At risk. Set from the latest answer; Leo can override it after a call.' },
    ],
    tags: [
      { name: 'customer', note: 'Who gets the survey. Added by 04a when the app posts subscription.created' },
      { name: 'nps-detractor · nps-passive · nps-promoter', note: 'The latest answer. All three are cleared at the start of every run' },
      { name: 'case-study-invited', note: 'Has had the one case-study ask' },
    ],
  },
  build: [
    {
      title: 'Agree the playbook with Leo first',
      body: 'Before anything in GHL, Leo and Hana agreed what each answer should cause. 0 to 6: Leo calls the same day, and the team hears about it. 7 or 8: one question, answered by a person. 9 or 10: the referral program, and once per customer a case-study invite. No public review ask anywhere in this workflow; the edge cases say why.',
    },
    {
      title: 'A survey that stores a real 0 to 10',
      body: 'GHL\'s Rating element offers 1 to 10 icons and stores the one picked, so it has no 0. The question is a Radio Select with options 0 to 10, each option scored with its own number, and a Score field turns that into NPS Score, unique key nps: a number the If/Else can compare. GHL treats any custom field with "score" in its name as a numeric scoring element, so the word goes on that field and nowhere else. The comment field is NPS Comment, not Score Reason.',
    },
    {
      title: 'How the survey reaches customers',
      body: "A quarterly email campaign from Leo to the Customers smart list (tag customer) links the survey page. I did not use the email builder's inline NPS element: its help article only describes answers landing in the campaign's Submissions tab, not a Survey Submitted trigger or a contact field, and this workflow needs both. The survey asks for the email address, and Sticky Contact fills it in, so the answer lands on the existing contact.",
    },
    {
      title: 'Trigger, then clear last quarter',
      body: 'Survey Submitted, filtered to Survey is Quarterly NPS, so no other survey can start it. The first step removes last quarter\'s nps-detractor, nps-passive and nps-promoter tags, so a contact only ever carries the latest answer and the smart lists count each customer once.',
    },
    {
      title: 'One If/Else, detractor as the default',
      body: 'Promoter (greater than 8) and passive (greater than 6 and less than 9) are the named branches, and detractor is the None branch on purpose. Anything the first two do not catch, including a 0 stored as empty or a survey whose field mapping broke, goes to a person instead of a referral ask.',
    },
    {
      title: 'Detractors: record first, then people',
      body: "Tag and Account Health go first, so reports stay right even if a later step fails. The Internal Notification emails Leo as a particular user rather than the assigned user, because many customers are still owned by the AE who closed them. Add Task is Due In Now. The #cs-alerts post is a Custom Webhook to a Slack incoming webhook: the channel is private, and GHL's Slack action posts to private channels as the user who connected Slack. The customer's email comes last and waits for the Time Window.",
    },
    {
      title: 'Passives and promoters',
      body: 'The passive email asks one question. A Wait for the contact to reply on Email, with a 5-day timeout, splits the path: a reply notifies Leo in-app and gives him a task for the next business day, and silence leaves a note for the next check-in. Promoters get the Referral page trigger link, which opens their own referral page in the app. The case-study invite waits 4 days so each email makes one ask, and the case-study-invited tag keeps it to once per customer. Both are commercial emails, so they carry the postal address and the unsubscribe link.',
    },
    {
      title: 'Settings, test, hand over',
      body: 'Allow Re-entry on for next quarter, Stop on Response off so the reply wait can do its job, Time Window weekdays 8 AM to 6 PM in the contact\'s time zone, Sender Details set to Leo. I submitted the live survey as five test contacts, one per scenario, read Execution Logs for each branch, and ran a copy with the waits cut to minutes for the timeout and the case-study email. Leo got a one-page SOP: what each alert means and what to do about it.',
    },
  ],
  edgeCases: [
    {
      title: 'No G2 or Capterra ask, on purpose',
      body: 'Asking only promoters for public reviews is review gating. Google lists "selectively solicit positive reviews from customers" among its prohibited practices, and the FTC\'s guidance for businesses that ask for reviews makes the same point: do not ask only the customers you expect to be happy. So the score never decides who is asked. If Crewlo wants G2 or Capterra reviews, the ask belongs in its own workflow that reaches every customer at the same point, say 90 days after go-live, whatever they answered here. The referral email never mentions reviews, and nothing is offered for one.',
    },
    {
      title: 'A 0, or no score at all',
      body: "Detractor is the None branch, so a 0 that lands as empty, or an answer with no score because someone edited the survey, still reaches Leo. His email then shows an empty score, which is the cue to check the survey's field mapping.",
    },
    {
      title: 'An out-of-office reply to the passive email',
      body: 'Any reply ends the wait, auto-replies included, so Leo sometimes gets a task for an out-of-office message. He closes it in seconds, and a real answer is never missed. Replies to the other emails are not watched; they land in Conversations like any email reply.',
    },
    {
      title: 'Comments with quotes or line breaks',
      body: "The Custom Webhook's Raw Body is a text template, so a comment with a double quote or a line break would break the JSON and Slack would answer 400. The comment stays out of Slack: Leo's email and the contact record carry it, which also keeps customers' words out of a channel that more people read than work the account. A company name with a double quote can still break the post; Execution Logs show the failure, and the email and task do not depend on Slack.",
    },
    {
      title: 'Answers with a different email',
      body: "The survey matches the contact on the email typed in. A customer who types a personal address creates a new contact without the customer tag, plan or company, so Leo's alert shows those fields empty. The SOP says to merge the two contacts before calling.",
    },
    {
      title: 'After hours, weekends, unsubscribed',
      body: "The alert, the task and the Slack post go out when the answer lands, so a Saturday detractor is Leo's first overdue task on Monday. The emails wait for the weekday 8 AM to 6 PM window. A customer who has unsubscribed from email has every email skipped and logged; a detractor still gets Leo's call.",
    },
  ],
  qa: [
    'Live survey submitted with 0, 6, 7, 8, 9 and 10: NPS Score on the contact equals the answer, 0 included, and Execution Logs show the matching branch',
    "A test submission with the score removed: it takes the detractor path, and Leo's email shows the empty score",
    'Detractor: Leo gets the email with the comment and a task due today, #cs-alerts gets one post with no email, phone or comment, and the acknowledgment arrives from leo@crewlo.example',
    "Every path removes last quarter's NPS tag, adds the new one and changes Account Health",
    'Reply to the passive email: Leo gets the in-app notification and a task due the next business day; in a copy with minute-long waits, no reply leaves the note instead',
    'Referral trigger link: it opens the referral page in the app, and the click shows in the activity timeline',
    'Promoter without case-study-invited gets the invite 4 days later and the tag; the same contact answering 9 next quarter gets the referral email only',
    'Submitted on a Friday evening: the email shows as waiting in Execution Logs and sends Monday at 8 AM; the referral and case-study emails show the address and unsubscribe link in Gmail and Outlook',
  ],
  snippets: [
    {
      title: 'Quarterly NPS survey',
      language: 'text',
      code: survey,
      note: 'A Radio Select on its own stores the chosen option as text. The Score field gives the If/Else a number, so it can use greater than and less than.',
    },
    {
      title: '#cs-alerts post (Custom Webhook, Raw Body)',
      language: 'json',
      code: slackBody,
      note: 'Event CUSTOM, Method POST, Content-Type application/json, sent to the incoming-webhook URL for #cs-alerts. The URL is a secret in itself, so it lives only in this action. No free text from the customer goes into the body.',
    },
    {
      title: 'Detractor and passive emails',
      language: 'text',
      code: `Detractor, from Leo Park
Subject: ${sorry.subject}

${sorry.body}

----------------------------------------------------------------

Passive, from Leo Park
Subject: ${ten.subject}

${ten.body}`,
      note: 'Both are plain text from a person, with no links. The detractor email promises a call rather than an apology in bulk; the passive email asks exactly one question.',
    },
  ],
  features: [
    'Survey Submitted',
    'Surveys · Radio Select option scores',
    'Surveys · Score field',
    'Remove Contact Tag',
    'If/Else',
    'Add Contact Tag',
    'Update Contact Field',
    'Internal Notification',
    'Add Task',
    'Custom Webhook (premium)',
    'Send Email',
    'Trigger Links',
    'Wait · A set period of time',
    'Wait · The contact to reply',
    'Add to Notes',
    'Allow Re-entry',
    'Time Window',
    'Sender Details',
  ],
};
