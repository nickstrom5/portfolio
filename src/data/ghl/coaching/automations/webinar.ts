import type { Automation, RunContext } from '@/lib/ghl/types';
import { formatClock, formatDay } from '@/lib/ghl/engine';
import { business, nextWorkshop } from '../business';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after a scenario's start at which something happens, counted from the workshop it registers for. */
const fromWorkshop = (start: number, minutes: number) => nextWorkshop(start) - start + minutes;

/**
 * Update Opportunity with "Allow Opportunity to Move to Any Previous Stage"
 * off: a card already past the target stage stays where it is.
 */
const STAGES = business.pipeline.stages;
function moveCard(stage: string) {
  return ({ contact }: RunContext) => {
    const current = contact.opportunity?.stage;
    if (current && STAGES.indexOf(current) > STAGES.indexOf(stage)) {
      return { log: `The card is already in ${current}. Backward moves are off, so it stays there.` };
    }
    return { effect: { opportunity: { stage } }, log: `Enrollment › ${stage}.` };
  };
}

const schedule = `When (Central)        Channel  Who                              What
On registration       Email    Everyone                         Confirmation and Join link
Wednesday 7:00 PM     Email    Everyone                         "Tomorrow at 7"
Thursday 6:00 PM      SMS      Ticked the reminders box         Starts in 1 hour
Thursday 6:55 PM      SMS      Ticked the reminders box         Room is open
Thursday 8:15 PM      Email    Clicked Join                     Offer, price, refund policy
Thursday 8:15 PM      Email    Did not click Join               Replay, up for 48 hours
Friday 2:15 PM        SMS      Box ticked, replay not opened    Replay nudge
Replay click + 2 hr   Email    Opened the replay                Same offer email
Saturday 8:15 PM      Email    Never opened the replay          Invitation to next Thursday

Texts carry reminders only. Nothing is sold by text: the offer goes by email.
Latest text: 7:55 PM Eastern. Most texts in any 24 hours: three.`;

const triggerLinks = `Trigger link       Points to                                  Used in
Workshop Join      Workshop Room URL custom value (Zoom)      Confirmation, day-before email, both texts
Workshop Replay    Replay page, live for 48 hours             Replay email, Friday text, offer P.S.
Checkout           Two-Step Order form, Career Pivot Blueprint Offer email
Apply              1:1 Pivot Coaching application             Offer email

Insert each one with the Trigger Links picker in the email or SMS editor.
A raw URL, or the custom value on its own, sends people to the same page
but records no click, and the "Joined live?" branch reads that click.`;

export const webinar: Automation = {
  id: 'webinar',
  number: '01',
  name: 'Workshop registration and reminders',
  kicker: 'Workshop',
  tagline: 'Every registrant gets a confirmation and reminders pinned to Thursday at 7 PM, and after the session the workflow sends the offer to people who joined and the replay to people who did not.',
  problem:
    'Morgan sent the workshop reminders by hand from her inbox, when she remembered. Show-up was thin, people who missed it heard nothing until next week’s promo, and people who had sat through the whole hour got the same "sorry we missed you" email as everyone else.',
  solution:
    'One run per registration. Event Start Date pins every reminder to the Thursday session, texts go only to people who ticked the reminders box, and 75 minutes after the start one signal, a click on the Join trigger link, decides what comes next: the offer with the price and refund policy, or the replay for 48 hours with one text nudge. Replay viewers get the same offer, current students get their login instead, and anyone who never watches is invited to next week.',
  workflow: {
    name: '01 · Workshop · Registration and Reminders',
    folder: 'Workshop',
    triggers: [{ title: 'Form Submitted', filters: ['Form is Workshop Registration'], label: 'Form Submitted (workshop page)' }],
    settings: {
      allowReEntry: true,
      stopOnResponse: false,
      timezone: 'contact',
      senderName: 'Morgan Hale',
      exits: [
        {
          event: 'order_submitted',
          by: 'Paying fires 03 · Students · Course Onboarding, whose first step is Remove from Workflow: 01 · Workshop and 02 · Checkout Recovery. Someone who buys during the session never gets the offer email.',
        },
      ],
      notes: [
        'Allow Re-entry on: the workshop runs every week. GHL lets a contact back in only after their current run has finished, so a double submit never starts a second run.',
        'Stop on Response off: "see you Thursday" or a question about the replay must not cancel the reminders or the replay. Replies land in Conversations for a person, and STOP still turns on SMS DND by itself.',
        'Timezone: Contact. Event Start Date ignores this and always uses the account time zone, Central, which is what a live session needs. The contact zone only drives the Advance Window after a replay click.',
        'No workflow Time Window: it would also hold the 8:15 PM follow-up emails. The texts are pinned to the session instead, and the latest one lands at 7:55 PM Eastern.',
        'Sender: From Name Morgan Hale, from morgan@trailheadcareers.example. Emails are signed with the Founder First Name custom value, not {{user.first_name}}, because the assigned user changes when Devon picks up an application.',
      ],
    },
    steps: [
      {
        id: 'event-date',
        kind: 'action',
        action: 'event_date',
        title: 'Event Start Date',
        label: 'Next Thursday, 7 PM',
        summary: 'Type Specific Day: Thursday at 7:00 PM. Every reminder below waits relative to this date. GHL runs this action on the account time zone, Central, even with the workflow on contact time, which is right for a session that starts at one moment for everyone.',
        run: ({ now }) => {
          const at = nextWorkshop(now);
          return { eventStart: at, log: `Event start set to ${formatClock(at)}. Every reminder below counts from it.` };
        },
      },
      {
        id: 'untag',
        kind: 'action',
        action: 'remove_tag',
        title: 'Remove Contact Tag',
        label: 'Clear last session',
        summary: 'Removes workshop-attended, workshop-replay and workshop-no-show, so for someone who registers again the tags always describe the latest session.',
        effect: { removeTags: ['workshop-attended', 'workshop-replay', 'workshop-no-show'] },
      },
      {
        id: 'can-text',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Reminder texts allowed?',
        branches: [
          {
            label: 'SMS consent',
            when: { type: 'field', key: 'sms_consent', op: 'eq', value: 'Yes', label: 'SMS Consent is Yes' },
            nodes: [
              {
                id: 'find-opp',
                kind: 'ifelse',
                title: 'Find Opportunity',
                label: 'Find the Enrollment card',
                branches: [
                  {
                    label: 'Opportunity Found',
                    when: { type: 'all', label: 'Latest opportunity in the Enrollment pipeline, any status', of: [{ type: 'opportunity' }] },
                    nodes: [
                      {
                        id: 'email-confirm',
                        kind: 'action',
                        action: 'send_email',
                        title: 'Send Email',
                        label: 'You are registered',
                        summary: 'Straight away, day or night: it answers the form they just sent. The Join link, what the hour covers, the replay promise, and a request to reply.',
                        message: {
                          channel: 'email',
                          subject: 'You are in: {{custom_values.workshop_title}}, Thursday at 7 PM Central',
                          body: 'Hi {{contact.first_name}},\n\nYou are registered for {{custom_values.workshop_title}}, a free 60-minute live workshop.\n\nWhen: Thursday at 7 PM Central (8 PM Eastern, 5 PM Pacific)\nJoin: {{trigger_link.join}}\nThe room opens 10 minutes early, and this same link works on the day.\n\nWhat we will cover:\n- How to describe the skills you already have in the words a new field uses\n- How to test a new field before you quit anything\n- A 90-day plan you can start the next morning\n\nCannot make it live? Everyone who registers gets the replay for 48 hours.\n\nOne favor: reply to this email with the one question you most want answered. I will take as many as I can in the live Q&A.\n\n{{custom_values.founder_first_name}}',
                        },
                      },
                      {
                        id: 'wait-1d',
                        kind: 'wait',
                        title: 'Wait',
                        label: '1 day before',
                        mode: 'before_appointment',
                        offset: DAY,
                        summary: 'Wait for Event/Appointment Time: 1 day before the event start date. If this date has already passed: Skip all outbound communication actions till next wait, so a same-day registrant does not get "tomorrow" by mistake.',
                      },
                      {
                        id: 'email-1d',
                        kind: 'action',
                        action: 'send_email',
                        title: 'Send Email',
                        label: 'Tomorrow at 7',
                        summary: 'The Join link again, and two things to have ready so the hour is worth their time.',
                        message: {
                          channel: 'email',
                          subject: 'Tomorrow at 7 PM Central: {{custom_values.workshop_title}}',
                          body: 'Hi {{contact.first_name}},\n\nQuick reminder: we are live tomorrow, Thursday, at 7 PM Central.\n\nJoin here: {{trigger_link.join}}\n\nTwo things make the hour more useful. Write down your current job title and one role you are curious about, and have something to write on. We use both in the first 20 minutes.\n\nIf something comes up, the replay goes to everyone who registered.\n\nSee you tomorrow,\n{{custom_values.founder_first_name}}',
                        },
                      },
                      {
                        id: 'wait-1h',
                        kind: 'wait',
                        title: 'Wait',
                        label: '1 hour before',
                        mode: 'before_appointment',
                        offset: 60,
                        summary: 'Wait for Event/Appointment Time: 1 hour before. Same past-date setting. 6 PM Central is 7 PM Eastern and 4 PM Pacific.',
                      },
                      {
                        id: 'sms-1h',
                        kind: 'action',
                        action: 'send_sms',
                        title: 'Send SMS',
                        label: 'Starts in 1 hour',
                        summary: 'The first text they get from this account, so it names the sender and carries the opt-out line. Skipped for anyone on SMS DND.',
                        message: {
                          channel: 'sms',
                          body: '{{location.name}}: Hi {{contact.first_name}}, {{custom_values.workshop_title}} starts in 1 hour, at 7 PM Central. Join here: {{trigger_link.join}} Reply STOP to opt out.',
                        },
                      },
                      {
                        id: 'wait-doors',
                        kind: 'wait',
                        title: 'Wait',
                        label: '5 minutes before',
                        mode: 'before_appointment',
                        offset: 5,
                        summary: 'Wait for Event/Appointment Time: 5 minutes before. Not at 7:00, because 7 PM Central is 8 PM Eastern, the edge of the strictest state quiet-hours window. 6:55 PM Central lands at 7:55 PM on the East Coast.',
                      },
                      {
                        id: 'sms-doors',
                        kind: 'action',
                        action: 'send_sms',
                        title: 'Send SMS',
                        label: 'Room is open',
                        summary: 'The nudge that gets people from "registered" to "in the room". One link, signed by the host.',
                        message: {
                          channel: 'sms',
                          body: "We're live in 5 minutes and the room is open, {{contact.first_name}}. Join here: {{trigger_link.join}} See you inside, {{custom_values.founder_first_name}}",
                        },
                      },
                      {
                        id: 'save-date',
                        kind: 'action',
                        action: 'update_field',
                        title: 'Update Contact Field',
                        label: 'Session date, attendance reset',
                        summary: 'Workshop Date = Current Date, written now so it is always the session they were booked into. Attended Live = No until a Join click says otherwise. Smart Lists, 02 and 05 read both.',
                        run: ({ now }) => ({
                          effect: { fields: { workshop_date: formatDay(now), attended: 'No' } },
                          log: `Workshop Date is now ${formatDay(now)}, and Attended Live is reset to No.`,
                        }),
                      },
                      {
                        id: 'wait-end',
                        kind: 'wait',
                        title: 'Wait',
                        label: '75 minutes after the start',
                        mode: 'after_appointment',
                        offset: 75,
                        summary: 'Wait for Event/Appointment Time: 1 hour 15 minutes after. The hour plus Q&A, so nobody gets a follow-up while Morgan is still answering questions.',
                      },
                      {
                        id: 'if-attended',
                        kind: 'ifelse',
                        title: 'If/Else',
                        label: 'Joined live?',
                        branches: [
                          {
                            label: 'Joined',
                            when: { type: 'event', event: 'link_clicked', value: 'join', label: 'Clicked the Workshop Join trigger link' },
                            nodes: [
                              {
                                id: 'opp-attended',
                                kind: 'action',
                                action: 'update_opportunity',
                                title: 'Update Opportunity',
                                label: 'Attended',
                                summary: 'Enrollment › Attended, the card Find Opportunity picked. Allow Opportunity to Move to Any Previous Stage stays off, and Status is not touched, so a won card is never reopened.',
                                run: moveCard('Attended'),
                              },
                              {
                                id: 'field-attended',
                                kind: 'action',
                                action: 'update_field',
                                title: 'Update Contact Field',
                                label: 'Attended Live = Yes',
                                summary: 'Keeps live attendance apart from replay views, so the show-up rate in reporting means live.',
                                effect: { fields: { attended: 'Yes' } },
                              },
                              {
                                id: 'tag-attended',
                                kind: 'action',
                                action: 'add_tag',
                                title: 'Add Contact Tag',
                                label: 'workshop-attended',
                                summary: 'For the "attended, not bought" Smart List and for 02 and 05.',
                                effect: { addTags: ['workshop-attended'] },
                              },
                              {
                                id: 'offer-check',
                                kind: 'ifelse',
                                title: 'If/Else',
                                label: 'Already a student?',
                                branches: [
                                  {
                                    label: 'Already a student',
                                    when: { type: 'field', key: 'purchase', op: 'not_empty', label: 'Purchase is not empty' },
                                    nodes: [
                                      {
                                        id: 'email-student',
                                        kind: 'action',
                                        action: 'send_email',
                                        title: 'Send Email',
                                        label: 'Your course login',
                                        summary: 'A current student came back for the live Q&A. No pitch for a course they own: the login and a line to student success.',
                                        message: {
                                          channel: 'email',
                                          subject: 'Good to see you again, {{contact.first_name}}',
                                          body: 'Hi {{contact.first_name}},\n\nThanks for coming back to the workshop. You already have {{custom_values.course_name}}, so there is nothing to buy here. Pick up where you left off: {{custom_values.course_login}}\n\nStuck on a module? Reply to this email and our student success team will help.\n\n{{custom_values.founder_first_name}}',
                                        },
                                      },
                                    ],
                                  },
                                ],
                                otherwise: {
                                  label: 'Not a student',
                                  nodes: [
                                    {
                                      id: 'email-offer',
                                      kind: 'action',
                                      action: 'send_email',
                                      title: 'Send Email',
                                      label: 'The offer',
                                      summary: 'Price, payment plan and refund policy in plain words, one checkout link, no countdown. The P.S. links the replay, for anyone who clicked Join but left early.',
                                      message: {
                                        channel: 'email',
                                        subject: 'If you want the full plan: {{custom_values.course_name}}',
                                        body: 'Hi {{contact.first_name}},\n\nThanks for spending the hour on {{custom_values.workshop_title}}. The workshop gives you the map. {{custom_values.course_name}} is the full, self-paced version: the skills inventory, the 90-day plan and the templates from the workshop, to work through on your own schedule.\n\nIt is {{custom_values.course_price}}, or {{custom_values.payment_plan}}, with a {{custom_values.refund_policy}}. If it is not for you, email {{custom_values.support_email}} and you get your money back.\n\nEnroll here: {{trigger_link.checkout}}\n\nThe price is the same next week. There is no countdown, so take the time you need.\n\nWant one-to-one help instead? {{custom_values.coaching_name}} is by application: {{trigger_link.apply}}\n\n{{custom_values.founder_first_name}}\n\nP.S. Missed part of it? The replay is here until Saturday evening: {{trigger_link.replay}}',
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        ],
                        otherwise: {
                          label: 'Missed it',
                          nodes: [
                            {
                              id: 'email-replay',
                              kind: 'action',
                              action: 'send_email',
                              title: 'Send Email',
                              label: 'The replay',
                              summary: 'No guilt, one link, and a way in for someone with 20 minutes. The replay page stays up for 48 hours.',
                              message: {
                                channel: 'email',
                                subject: 'Sorry we missed you: the replay is up until Saturday',
                                body: 'Hi {{contact.first_name}},\n\nWe missed you tonight, and that is fine. The full recording of {{custom_values.workshop_title}} is here until Saturday evening:\n\n{{trigger_link.replay}}\n\nIf you only have 20 minutes, watch the first 20. That is the skills map, and you can do it on paper while you watch.\n\n{{custom_values.founder_first_name}}',
                              },
                            },
                            {
                              id: 'wait-replay-1',
                              kind: 'wait',
                              title: 'Wait',
                              label: 'Replay opened? (18 hours)',
                              mode: 'event',
                              event: 'link_clicked',
                              minutes: 18 * 60,
                              summary: 'The contact to take an action: Clicks a trigger link, Workshop Replay. Timeout 18 hours, which ends Friday at 2:15 PM Central, a time a text can land anywhere from Eastern to Hawaii.',
                              branches: {
                                met: {
                                  label: 'Opened the replay',
                                  nodes: [
                                    {
                                      id: 'wait-watch',
                                      kind: 'wait',
                                      title: 'Wait',
                                      label: 'Time to watch it',
                                      mode: 'time',
                                      minutes: 120,
                                      window: { start: '08:00', end: '21:00', days: ALL_WEEK },
                                      summary: 'Two hours, long enough to finish the recording before the offer arrives. Advance Window 8 AM to 9 PM, so a midnight viewer gets it over breakfast.',
                                    },
                                    {
                                      id: 'opp-replay',
                                      kind: 'action',
                                      action: 'update_opportunity',
                                      title: 'Update Opportunity',
                                      label: 'Attended',
                                      summary: 'Enrollment › Attended: they have seen the workshop. The Attended Live field stays No, so live and replay are still counted apart.',
                                      run: moveCard('Attended'),
                                    },
                                    {
                                      id: 'tag-replay',
                                      kind: 'action',
                                      action: 'add_tag',
                                      title: 'Add Contact Tag',
                                      label: 'workshop-replay',
                                      summary: 'Watched the replay, not live.',
                                      effect: { addTags: ['workshop-replay'] },
                                    },
                                    {
                                      id: 'goto-offer',
                                      kind: 'goto',
                                      title: 'Go To',
                                      target: 'offer-check',
                                      summary: 'Same student check and the same offer email as the live path, so there is one offer to keep up to date.',
                                    },
                                  ],
                                },
                                timeout: {
                                  label: 'Not yet',
                                  nodes: [
                                    {
                                      id: 'sms-nudge',
                                      kind: 'action',
                                      action: 'send_sms',
                                      title: 'Send SMS',
                                      label: 'Replay nudge',
                                      summary: 'A reminder about the event they signed up for, not a pitch: no price, no checkout link. Skipped for anyone on SMS DND.',
                                      message: {
                                        channel: 'sms',
                                        body: "{{location.name}}: Hi {{contact.first_name}}, the replay of Thursday's workshop is up until Saturday evening. Watch it here: {{trigger_link.replay}}",
                                      },
                                    },
                                    {
                                      id: 'wait-replay-2',
                                      kind: 'wait',
                                      title: 'Wait',
                                      label: 'Replay opened? (30 hours)',
                                      mode: 'event',
                                      event: 'link_clicked',
                                      minutes: 30 * 60,
                                      summary: 'Clicks a trigger link, Workshop Replay, again. Timeout 30 hours, which ends Saturday at 8:15 PM Central, when the replay page comes down.',
                                      branches: {
                                        met: {
                                          label: 'Opened the replay',
                                          nodes: [
                                            {
                                              id: 'goto-watched',
                                              kind: 'goto',
                                              title: 'Go To',
                                              target: 'wait-watch',
                                              summary: 'Joins the replay path above: time to watch, card to Attended, tag, then the offer.',
                                            },
                                          ],
                                        },
                                        timeout: {
                                          label: 'Never opened it',
                                          nodes: [
                                            {
                                              id: 'tag-no-show',
                                              kind: 'action',
                                              action: 'add_tag',
                                              title: 'Add Contact Tag',
                                              label: 'workshop-no-show',
                                              summary: 'Registered, did not join, did not watch. The card stays in Registered.',
                                              effect: { addTags: ['workshop-no-show'] },
                                            },
                                            {
                                              id: 'email-next',
                                              kind: 'action',
                                              action: 'send_email',
                                              title: 'Send Email',
                                              label: 'Next Thursday?',
                                              summary: 'The last step, so the run is over by the time they click: Allow Re-entry lets the new registration start a fresh run.',
                                              message: {
                                                channel: 'email',
                                                subject: 'Next Thursday, 7 PM Central?',
                                                body: 'Hi {{contact.first_name}},\n\nThe replay of {{custom_values.workshop_title}} is down now. The workshop runs live every Thursday at 7 PM Central, and you are welcome at the next one: {{location.website}}/pivot-plan\n\nIf Thursday evenings do not work for you, reply and tell me what would. I read the replies.\n\n{{custom_values.founder_first_name}}',
                                              },
                                            },
                                          ],
                                        },
                                      },
                                    },
                                  ],
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
                otherwise: {
                  label: 'Opportunity Not Found',
                  nodes: [
                    {
                      id: 'create-opp',
                      kind: 'action',
                      action: 'create_opportunity',
                      title: 'Create Opportunity',
                      label: 'Registered',
                      summary: 'Enrollment › Registered, named "{{contact.name}} · Workshop", source Workshop page. Only reached when the contact has no card at all, so Duplicate Opportunity stays off.',
                      effect: { opportunity: { pipeline: 'Enrollment', stage: 'Registered', status: 'open' } },
                    },
                    {
                      id: 'goto-refind',
                      kind: 'goto',
                      title: 'Go To',
                      target: 'find-opp',
                      summary: 'A card made by Create Opportunity is not in context for Update Opportunity later in the run, so the contact goes back through Find, which now finds it.',
                    },
                  ],
                },
              },
            ],
          },
        ],
        otherwise: {
          label: 'No SMS consent',
          nodes: [
            {
              id: 'dnd-on',
              kind: 'action',
              action: 'dnd',
              title: 'Enable/Disable DND',
              label: 'Texts off',
              summary: 'Enable DND for SMS only, direction Outbound. Every text step below is skipped for this contact, and their own texts still reach us. Logged as "DND Enabled by Workflows", so nobody mistakes it for a STOP.',
              effect: { dnd: { sms: true } },
            },
            {
              id: 'goto-find',
              kind: 'goto',
              title: 'Go To',
              target: 'find-opp',
              summary: 'Back onto the main path at Find Opportunity. From here the only difference is that GHL does not send the texts.',
            },
          ],
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'attends',
      label: 'Joins live',
      summary: 'Registers on a Tuesday lunch break with the texts box ticked. Joins from the doors-open text three minutes after the start.',
      start: DAY + 12 * 60 + 40,
      contact: { fields: { sms_consent: 'Yes', sms_marketing_consent: 'No', current_role: 'Individual contributor', goal: 'A new industry' } },
      events: [{ at: fromWorkshop(DAY + 12 * 60 + 40, 3), type: 'link_clicked', value: 'join', label: 'Workshop Join, from the doors-open text' }],
      expect: {
        outcome: 'completed',
        visits: ['find-opp:else', 'create-opp', 'goto-refind', 'find-opp:0', 'email-confirm', 'email-1d', 'sms-1h', 'sms-doors', 'save-date', 'if-attended:0', 'opp-attended', 'field-attended', 'offer-check:else', 'email-offer'],
        tags: ['workshop-attended'],
        stage: 'Attended',
      },
    },
    {
      id: 'replay',
      label: 'Misses it, watches the replay',
      summary: 'Registers on Monday evening, texts ticked, and misses Thursday. Opens the replay 45 minutes after the Friday text.',
      start: 20 * 60 + 25,
      contact: { fields: { sms_consent: 'Yes', sms_marketing_consent: 'Yes', current_role: 'Manager', goal: 'A new role' } },
      events: [{ at: fromWorkshop(20 * 60 + 25, 20 * 60), type: 'link_clicked', value: 'replay', label: 'Workshop Replay, from the Friday text' }],
      expect: {
        outcome: 'completed',
        visits: ['if-attended:else', 'email-replay', 'wait-replay-1:timeout', 'sms-nudge', 'wait-replay-2:met', 'goto-watched', 'wait-watch', 'opp-replay', 'tag-replay', 'goto-offer', 'offer-check:else', 'email-offer'],
        tags: ['workshop-replay'],
        stage: 'Attended',
      },
    },
    {
      id: 'no-show',
      label: 'Registers and forgets',
      summary: 'Registers on Wednesday morning, texts ticked, then never clicks anything. Gets every reminder, the replay and the invitation to next week.',
      start: 2 * DAY + 7 * 60 + 10,
      contact: { fields: { sms_consent: 'Yes', sms_marketing_consent: 'No', current_role: 'Between roles', goal: 'Not sure yet' } },
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['if-attended:else', 'email-replay', 'wait-replay-1:timeout', 'sms-nudge', 'wait-replay-2:timeout', 'tag-no-show', 'email-next'],
        tags: ['workshop-no-show'],
        stage: 'Registered',
      },
    },
    {
      id: 'student-no-texts',
      label: 'Current student, no texts',
      summary: 'Bought the course in February and never ticked a texts box. Registers on Saturday for the next live Q&A, misses it and opens the replay that night.',
      start: 5 * DAY + 10 * 60 + 15,
      contact: {
        tags: ['workshop-attended'],
        opportunity: { pipeline: 'Enrollment', stage: 'Customer', status: 'won', value: 497, name: 'Marcus Lee · Workshop' },
        fields: { sms_consent: 'No', sms_marketing_consent: 'No', current_role: 'Manager', goal: 'A new role', purchase: 'Career Pivot Blueprint', attended: 'Yes' },
      },
      events: [{ at: fromWorkshop(5 * DAY + 10 * 60 + 15, 160), type: 'link_clicked', value: 'replay', label: 'Workshop Replay, from the 8:15 PM email' }],
      expect: {
        outcome: 'completed',
        visits: ['untag', 'can-text:else', 'dnd-on', 'goto-find', 'find-opp:0', 'if-attended:else', 'wait-replay-1:met', 'wait-watch', 'opp-replay', 'offer-check:0', 'email-student'],
        skips: ['sms-1h', 'sms-doors'],
        tags: ['workshop-replay'],
        stage: 'Customer',
      },
    },
    {
      id: 'buys-live',
      label: 'Asks a question, buys live',
      summary: 'Replies to the 1-hour text with a question, joins at 6:57 PM and pays through the link Morgan shares near the end. 03 takes over.',
      start: 7 * 60 + 50,
      contact: { fields: { sms_consent: 'Yes', sms_marketing_consent: 'No', current_role: 'Senior leader', goal: 'Freelancing' } },
      events: [
        { at: fromWorkshop(7 * 60 + 50, -56), type: 'reply', value: 'Will there be a replay if I have to leave at 8?' },
        { at: fromWorkshop(7 * 60 + 50, -3), type: 'link_clicked', value: 'join', label: 'Workshop Join, from the doors-open text' },
        { at: fromWorkshop(7 * 60 + 50, 52), type: 'order_submitted', value: 497, label: 'Career Pivot Blueprint, paid in full' },
      ],
      expect: { outcome: 'ended', visits: ['sms-1h', 'sms-doors', 'save-date'], stage: 'Registered' },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'SMS Consent', key: 'sms_consent', type: 'Checkbox', note: 'The reminders box on the form. Unticked by default, not required' },
      { name: 'Marketing Texts', key: 'sms_marketing_consent', type: 'Checkbox', note: 'A separate box. Not used here: this workflow sends no marketing texts' },
      { name: 'Workshop Date', key: 'workshop_date', type: 'Date', note: 'Current Date, written when the session starts' },
      { name: 'Attended Live', key: 'attended', type: 'Dropdown (single)', note: 'Yes · No. Reset to No at the session, Yes on a Join click' },
      { name: 'Current Role / Goal', key: 'current_role', type: 'Dropdown (single) ×2', note: 'From the form, used by 05 to pre-fill the application' },
      { name: 'Purchase', key: 'purchase', type: 'Single line', note: 'Set when they buy. Read here to keep the offer away from students' },
    ],
    tags: [
      { name: 'workshop-attended', note: 'Clicked Join at the latest session' },
      { name: 'workshop-replay', note: 'Opened the replay of the latest session' },
      { name: 'workshop-no-show', note: 'Neither. All three are cleared when they register again' },
    ],
    pipeline: business.pipeline,
    customValues: [
      { name: 'Workshop Title', key: 'workshop_title', value: 'The Career Pivot Plan' },
      { name: 'Workshop Room URL', key: 'workshop_room_url', value: 'The Zoom link behind the Join trigger link' },
      { name: 'Course Name / Price / Payment Plan', key: 'course_name', value: 'Career Pivot Blueprint · $497 · 3 payments of $179' },
      { name: 'Refund Policy', key: 'refund_policy', value: '14-day money-back guarantee' },
      { name: 'Founder First Name', key: 'founder_first_name', value: 'Morgan' },
    ],
  },
  build: [
    {
      title: 'Agree what "attended" means',
      body: 'Before building, I agreed one signal with Morgan: a click on the Join trigger link. It means they tried to join, not that they stayed, which is good enough to choose between the offer and the replay. The Zoom attendee report stays the source of truth for show-up numbers. We also set a budget: texts are reminders only, never more than three in 24 hours, and nothing is sold by text.',
    },
    {
      title: 'Trigger links before copy',
      body: 'Four trigger links: Join, Replay, Checkout and Apply. Join points at a Workshop Room URL custom value, so when the Zoom room changes Morgan updates one value and every email and text follows. Each link goes into messages through the Trigger Links picker. A pasted URL goes to the same page but records no click, and the whole post-session split depends on that click.',
    },
    {
      title: 'One clock: Event Start Date',
      body: 'Event Start Date sets Thursday at 7 PM as the reference, and four waits count from it: a day before, an hour before, five minutes before and 75 minutes after. GHL documents that this action uses the account time zone even when the workflow runs on contact time, which suits a live session. Each wait has "If this date has already passed" set to skip outbound messages until the next wait, so a Thursday-afternoon registrant does not get the day-before email.',
    },
    {
      title: 'Consent by DND, and what it costs',
      body: 'Anyone whose SMS Consent is not Yes gets SMS DND switched on at the top, then a Go To puts them back on the main path. One step replaces an If/Else in front of every text, and a text added next month is covered without anyone remembering. The cost: DND is contact-wide and outlives the run. It blocks texts from every workflow and from the team, so a later opt-in, for example at checkout, has to switch it off on purpose. It is set Outbound only, so their own texts still reach us. The workflow never switches DND off, because it cannot tell its own DND from a STOP.',
    },
    {
      title: 'Find the card before moving it',
      body: 'GHL does not carry a card made by Create Opportunity into later Update Opportunity steps. So Find Opportunity runs first (latest card in Enrollment, any status); if there is none, Create Opportunity makes one in Registered and a Go To runs Find again. A returning contact keeps their card, and a student’s won card is found and never dragged back, because backward moves are off.',
    },
    {
      title: 'After the session: two paths, one offer',
      body: 'At 8:15 PM the If/Else reads the Join click. Joiners get the offer email; everyone else gets the replay. The replay wait is split in two, 18 and 30 hours, so the one nudge text lands on Friday afternoon instead of Thursday night, and the second timeout matches the moment the replay page comes down. Replay viewers Go To the same student check and offer email as live attendees.',
    },
    {
      title: 'Settings on purpose',
      body: 'Allow Re-entry on, because the workshop is weekly. Stop on Response off, because a reply like "see you Thursday" must not cancel the replay. No Time Window, because it would hold the 8:15 PM emails. Paying fires 03, whose first step removes the contact from this workflow, so nobody gets a sales email for a course they just bought.',
    },
    {
      title: 'Test against the calendar',
      body: 'Five test contacts, one per scenario above, plus registrations on a Friday and on a Thursday afternoon to check the Event Start Date each one gets in Execution Logs. Then Morgan gets the schedule below, so she knows exactly who hears what, and when, without opening the builder.',
    },
  ],
  edgeCases: [
    {
      title: 'Registers on Thursday afternoon',
      body: 'The day-before wait has already passed, and its past-date setting skips outbound messages until the next wait. They get the confirmation, the 1-hour text and the doors-open text, not a "tomorrow" email on the day.',
    },
    {
      title: 'Clicks Join early, or leaves after five minutes',
      body: 'A click on Monday to test the link, or a short visit, still counts as joined, so they get the offer instead of the replay email. The offer’s P.S. links the replay, so nobody is left without the content.',
    },
    {
      title: 'Replies STOP to the 1-hour text',
      body: 'GHL switches on SMS DND by itself, so the doors-open text and the Friday nudge are skipped. Stop on Response is off, so the emails, including the replay, still arrive.',
    },
    {
      title: 'Registers again before the run ends',
      body: 'GHL does not let a contact re-enter a workflow they are still in, so a second submit between Thursday night and Saturday evening starts nothing. That is why next week is only linked from the last step, after which the run is over and the next registration starts clean, with last session’s tags cleared.',
    },
    {
      title: 'Buys during the session',
      body: 'Morgan shares the checkout link near the end of the hour. Paying fires 03, which removes the contact from this workflow before 8:15 PM, so a new student gets onboarding instead of an offer for what they just bought.',
    },
    {
      title: 'A current student registers',
      body: 'Find Opportunity finds their won card, and Update Opportunity cannot move it back from Customer. After the session the student check sends their course login instead of the offer.',
    },
  ],
  qa: [
    'Register on a Monday, on a Thursday at 4 PM and on a Friday: Execution Logs show Event Start Date as this Thursday, this Thursday and next Thursday at 7 PM',
    'Register on Thursday afternoon: no day-before email, and the 1-hour and doors-open texts still send',
    'Leave the texts box unticked: the contact shows SMS DND "Enabled by Workflows", Outbound only, and both texts show as not sent while every email arrives',
    'Click Join from the 1-hour text: at 8:15 PM the card is in Attended, Attended Live is Yes, the tag is there and the offer email’s checkout link opens the order form',
    'Do not click anything: the replay email at 8:15 PM, one text on Friday at 2:15 PM, the invitation on Saturday at 8:15 PM and the workshop-no-show tag',
    'Open the replay on Friday: the offer arrives about two hours later, the card moves to Attended and Attended Live stays No',
    'Pay during the session: Enrollment History shows the contact removed by 03, and no offer email goes out',
    'Every trigger link records a click on the activity timeline, every merge field renders in Gmail, Outlook and on a phone, and each text is one segment',
  ],
  snippets: [
    { title: 'Who hears what, and when', language: 'text', code: schedule, note: 'Goes to Morgan with the SOP, so she can answer "did they get a reminder?" without opening the builder.' },
    { title: 'Trigger links', language: 'text', code: triggerLinks, note: 'Created once in Marketing › Trigger Links. The Join link’s URL is a custom value, so a new Zoom room is a one-field change.' },
  ],
  features: [
    'Form Submitted',
    'Event Start Date',
    'Remove Contact Tag',
    'If/Else',
    'Enable/Disable DND',
    'Go To',
    'Find Opportunity',
    'Create Opportunity',
    'Send Email',
    'Wait · Event/Appointment Time',
    'Send SMS',
    'Update Contact Field',
    'Update Opportunity',
    'Add Contact Tag',
    'Wait · Clicks a trigger link',
    'Wait · Advance Window',
    'Trigger Links',
    'Allow Re-entry',
  ],
};
