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
const CUSTOMER = STAGES.indexOf('Customer');
/** The course card's stages. Applied, Call Booked and Coaching Client belong to the separate coaching card that 05 makes. */
const COURSE_STAGES = STAGES.slice(0, CUSTOMER + 1);
const COACHING_LIST = STAGES.slice(CUSTOMER + 1).join(', ').replace(/, ([^,]*)$/, ' or $1');

/** Business name and postal address under every email (CAN-SPAM); the unsubscribe link comes from the sub-account setting. */
const footer = '\n\n{{location.name}}, {{location.full_address}}';

/** A session five weeks before the sample Thursday, for a contact who registered before. */
const EARLIER_SESSION = formatDay(3 * DAY - 5 * 7 * DAY);

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
Wednesday 7:00 PM     Email    Everyone                         Day-before reminder
Thursday 6:00 PM      SMS      Ticked the reminders box         Starts in 1 hour
Thursday 6:55 PM      SMS      Box ticked, not in the room yet  Room is open
Thursday 8:15 PM      Email    Clicked Join from 6 PM on        Offer, price, refund policy
Thursday 8:15 PM      Email    Did not click Join               Replay, up for 48 hours
Friday 2:15 PM        SMS      Box ticked, replay not opened    Replay nudge
Replay click + 2 hr   Email    Opened the replay                Same offer email
Saturday 8:15 PM      Email    Never opened the replay          Invitation to next Thursday

Current students get their course login instead of the offer, or
nothing while their course access is paused.
Texts carry reminders only. Nothing is sold by text: the offer goes by email.
Latest text: 7:55 PM Eastern. Most texts in any 24 hours: three.`;

const triggerLinks = `Trigger link      Points to                                    Used in
Workshop Join     Workshop Room URL custom value (Zoom)        Confirmation, day-before email, both texts
Workshop Replay   Replay page, up for 48 hours                 Replay email, Friday text, offer P.S.
Checkout          Two-Step Order form, Career Pivot Blueprint  Offer email
Apply             1:1 Pivot Coaching application               Offer email

Insert each one with the Trigger Links picker in the email or SMS editor.
A raw URL, or the custom value on its own, sends people to the same page
but records no click, and both Join waits and both Replay waits read that click.`;

export const webinar: Automation = {
  id: 'webinar',
  number: '01',
  name: 'Workshop registration and reminders',
  kicker: 'Workshop',
  tagline: 'Every registrant gets a confirmation and reminders pinned to Thursday at 7 PM, and after the session the workflow sends the offer to people who joined and the replay to people who did not.',
  problem:
    'Workshop reminders went out by hand from Morgan’s inbox, when there was time. Show-up was thin, people who missed the session heard nothing until the next promo, and people who had sat through the whole hour got the same "sorry we missed you" email as everyone else.',
  solution:
    'One run per registration. Event Start Date pins every reminder to the Thursday session, and texts go only to people who ticked the reminders box. From the 1-hour text until 8:15 PM, one signal, a click on the Join trigger link, decides what comes next: the offer with the price and refund policy, or the replay for 48 hours with one text nudge. Replay viewers get the same offer, current students get their login instead, and anyone who never watches is invited to next week.',
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
          by: 'Paying fires 03 · Students · Course Onboarding, whose first step is Remove from Workflow: 01 · Workshop · Registration and Reminders and 02 · Sales · Checkout Recovery. Someone who buys during the session never gets the offer email.',
        },
      ],
      notes: [
        'Allow Re-entry on: the workshop runs every week. GHL lets a contact back in only after their current run has finished, so a double submit never starts a second run.',
        'Stop on Response off: "see you Thursday" or a question about the replay must not cancel the reminders or the replay. Replies land in Conversations for a person, and STOP still turns on SMS DND by itself.',
        'Timezone: Contact. Event Start Date ignores this and always uses the account time zone, Central, which is what a live session needs. The contact zone only drives the Advance Window after a replay click.',
        'No workflow Time Window: it would also hold the 8:15 PM follow-up emails. The texts are pinned to the session instead, and the latest one lands at 7:55 PM Eastern. In Atlantic Canada that is 8:55 PM, five minutes before a session that starts at 9 PM there, and a reminder they asked for.',
        'Sender Details: From Name Morgan Hale, From Email morgan@trailheadcareers.example. Emails are signed with the Founder First Name custom value, not the name of the assigned user, because the assigned user changes when Devon picks up an application.',
        'Every email ends with the business name and {{location.full_address}}, and Include Unsubscribe Link (Business Profile › General) stays on. The offer, replay and invitation emails are commercial under CAN-SPAM; the confirmation and reminder carry the same footer so nothing depends on classifying them.',
        'One opportunity model across the case: the course card moves Registered, Attended, Checkout Started, Customer, and 03 marks it Won at Customer for $497; a coaching deal is a separate card that 05 creates at Applied, then Call Booked and Coaching Client. This workflow creates the course card at Registered and moves it to Attended. Allow Multiple Opportunities per Contact is on in Sub-Account Settings › Objects › Opportunities, so a contact whose only card is a coaching deal can still get a course card here.',
      ],
    },
    steps: [
      {
        id: 'event-date',
        kind: 'action',
        action: 'event_date',
        title: 'Event Start Date',
        label: 'Next Thursday, 7 PM',
        summary: 'Type Specific Day, by day of the week: Thursday at 7:00 PM. The waits below that count from the event use this date. GHL runs this action on the account time zone, Central, even with the workflow on contact time, which is right for a session that starts at one moment for everyone.',
        run: ({ now }) => {
          const at = nextWorkshop(now);
          return { eventStart: at, log: `Event start set to ${formatClock(at)}. The reminders below count from it.` };
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
            label: 'Ticked it this time',
            when: {
              type: 'all',
              label: 'SMS consent (service) is Yes, and Contact Tag includes sms-off-no-consent',
              of: [
                { type: 'field', key: 'sms_consent', op: 'eq', value: 'Yes' },
                { type: 'tag', has: 'sms-off-no-consent' },
              ],
            },
            nodes: [
              {
                id: 'dnd-off',
                kind: 'action',
                action: 'dnd',
                title: 'Enable/Disable DND',
                label: 'Texts back on',
                summary: 'Disable DND, SMS only, direction Outbound. Last time they left the box unticked and this workflow switched texts off; this time they ticked it, which is a new opt-in. Logged as "DND Disabled by Workflows".',
                effect: { dnd: { sms: false } },
              },
              {
                id: 'untag-dnd',
                kind: 'action',
                action: 'remove_tag',
                title: 'Remove Contact Tag',
                label: 'sms-off-no-consent',
                summary: 'The receipt is used up. From now on, any SMS DND on this contact is treated as their own.',
                effect: { removeTags: ['sms-off-no-consent'] },
              },
              {
                id: 'goto-find-on',
                kind: 'goto',
                title: 'Go To',
                target: 'find-opp',
                summary: 'Onto the main path at Find Opportunity, with texts on. The 1-hour text still carries the opt-out line.',
              },
            ],
          },
          {
            label: 'SMS consent',
            when: {
              type: 'all',
              label: 'SMS consent (service) is Yes, and Contact Tag does not include sms-off-no-consent',
              of: [
                { type: 'field', key: 'sms_consent', op: 'eq', value: 'Yes' },
                { type: 'no_tag', has: 'sms-off-no-consent' },
              ],
            },
            nodes: [
              {
                id: 'find-opp',
                kind: 'ifelse',
                title: 'Find Opportunity',
                label: 'Has a course card?',
                branches: [
                  {
                    label: 'Opportunity Found',
                    when: {
                      type: 'any',
                      label: `Latest opportunity where Pipeline is Enrollment and Stage is not ${COACHING_LIST}, any status`,
                      of: COURSE_STAGES.map((stage) => ({ type: 'opportunity' as const, stage })),
                    },
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
                          body: `Hi {{contact.first_name}},\n\nYou are registered for {{custom_values.workshop_title}}, a free 60-minute live workshop.\n\nWhen: Thursday at 7 PM Central (8 PM Eastern, 5 PM Pacific)\nJoin: {{trigger_link.join}}\nThe room opens 10 minutes early, and this same link works on the day.\n\nWhat we will cover:\n- How to describe the skills you already have in the words a new field uses\n- How to test a new field before you quit anything\n- A 90-day plan you can start the next morning\n\nCannot make it live? Everyone who registers gets the replay for 48 hours.\n\nOne favor: reply to this email with the one question you most want answered. I will take as many as I can in the live Q&A.\n\n{{custom_values.founder_first_name}}${footer}`,
                        },
                      },
                      {
                        id: 'wait-1d',
                        kind: 'wait',
                        title: 'Wait',
                        label: '1 day before',
                        mode: 'before_appointment',
                        offset: DAY,
                        ifPassed: 'skip_outbound',
                        summary: 'An upcoming appointment or booking: 1 day before the Event Start Date above (the Event Start Date article calls this wait Wait for Event/Appointment Time). If this date has already passed: Skip all outbound communication actions till next wait or event start date action, so someone who registers after 7 PM Wednesday gets no day-before email.',
                      },
                      {
                        id: 'email-1d',
                        kind: 'action',
                        action: 'send_email',
                        title: 'Send Email',
                        label: 'Day before',
                        summary: 'The Join link again, and two things to have ready so the hour is worth their time. It names the day instead of saying "tomorrow", so it reads right whenever it lands.',
                        message: {
                          channel: 'email',
                          subject: 'Thursday at 7 PM Central: two things to have ready',
                          body: `Hi {{contact.first_name}},\n\nA reminder that {{custom_values.workshop_title}} is live on Thursday at 7 PM Central.\n\nJoin here: {{trigger_link.join}}\n\nTwo things make the hour more useful. Write down your current job title and one role you are curious about, and have something to write on. We use both in the first 20 minutes.\n\nIf something comes up, the replay goes to everyone who registered.\n\nSee you Thursday,\n{{custom_values.founder_first_name}}${footer}`,
                        },
                      },
                      {
                        id: 'wait-1h',
                        kind: 'wait',
                        title: 'Wait',
                        label: '1 hour before',
                        mode: 'before_appointment',
                        offset: 60,
                        ifPassed: 'skip_outbound',
                        summary: 'An upcoming appointment or booking: 1 hour before. 6 PM Central is 7 PM Eastern and 4 PM Pacific. It is also the next wait, so it ends the skip for a Thursday registrant. If this date has already passed: Skip all outbound communication actions till next wait or event start date action, so "starts in 1 hour" can never go out after 6 PM.',
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
                          body: '{{location.name}}: Hi {{contact.first_name}}, the workshop starts in 1 hour (7 PM CT). Join: {{trigger_link.join}} Reply STOP to opt out.',
                        },
                      },
                      {
                        id: 'save-date',
                        kind: 'action',
                        action: 'update_field',
                        title: 'Update Contact Field',
                        label: 'Session date, attendance reset',
                        summary: 'Workshop Date = Current Date, written on the session day so it is always the session they were booked into (there is no merge field for the Event Start Date). Attended Live = No until a Join click says otherwise. The show-up report and Smart Lists read both.',
                        run: ({ now }) => ({
                          effect: { fields: { workshop_date: formatDay(now), attended: 'No' } },
                          log: `Workshop Date is now ${formatDay(now)}, and Attended Live is reset to No.`,
                        }),
                      },
                      {
                        id: 'untag-joined',
                        kind: 'action',
                        action: 'remove_tag',
                        title: 'Remove Contact Tag',
                        label: 'workshop-joined',
                        summary: 'Clears the tag 01a adds on a Join click, so only clicks from the 1-hour mark on count as being in the room. A test click on Tuesday is not attendance.',
                        effect: { removeTags: ['workshop-joined'] },
                      },
                      {
                        id: 'wait-doors',
                        kind: 'wait',
                        title: 'Wait',
                        label: '5 minutes before',
                        mode: 'before_appointment',
                        offset: 5,
                        ifPassed: 'skip_outbound',
                        summary: 'An upcoming appointment or booking: 5 minutes before the Event Start Date, 6:55 PM Central, for everyone, however late they registered. If this date has already passed: Skip all outbound communication actions till next wait or event start date action, so someone who registers at 6:58 PM never gets "we start in 5 minutes".',
                      },
                      {
                        id: 'in-room',
                        kind: 'ifelse',
                        title: 'If/Else',
                        label: 'In the room already?',
                        branches: [
                          {
                            label: 'Already clicked Join',
                            // In GHL this reads the tag 01a adds on a Join click; the simulator reads the click itself.
                            when: { type: 'event', event: 'link_clicked', value: 'join', label: 'Contact Tag includes workshop-joined' },
                            nodes: [
                              {
                                id: 'goto-live',
                                kind: 'goto',
                                title: 'Go To',
                                target: 'wait-end',
                                summary: 'Straight to the end-of-session wait. Someone already in the room does not need the doors-open text.',
                              },
                            ],
                          },
                        ],
                        otherwise: {
                          label: 'Not yet',
                          nodes: [
                            {
                              id: 'sms-doors',
                              kind: 'action',
                              action: 'send_sms',
                              title: 'Send SMS',
                              label: 'Room is open',
                              summary: 'Only for people who have not clicked Join yet. Not at 7:00, because 7 PM Central is 8 PM Eastern, the edge of the strictest state quiet-hours window: this lands at 7:55 PM on the East Coast. It carries the opt-out line because, for someone who registers in the last hour, the 1-hour text was skipped and this is their first text. Skipped for anyone on SMS DND.',
                              message: {
                                channel: 'sms',
                                body: '{{location.name}}: the room is open, {{contact.first_name}}. We start in 5 minutes: {{trigger_link.join}} Reply STOP to opt out.',
                              },
                            },
                            {
                              id: 'wait-end',
                              kind: 'wait',
                              title: 'Wait',
                              label: 'Until 8:15 PM',
                              mode: 'after_appointment',
                              offset: 75,
                              ifPassed: 'continue',
                              summary: 'An upcoming appointment or booking: 1 hour 15 minutes after the Event Start Date. The hour plus Q&A, so nobody gets the offer while Morgan is still answering questions. If this date has already passed: Continue to next action, so a Join click at 8:15 on the dot still gets the offer straight away.',
                            },
                            {
                              id: 'joined',
                              kind: 'ifelse',
                              title: 'If/Else',
                              label: 'Joined live?',
                              branches: [
                                {
                                  label: 'Joined',
                                  when: { type: 'event', event: 'link_clicked', value: 'join', label: 'Contact Tag includes workshop-joined' },
                                  nodes: [
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
                                      summary: 'For the "attended, not bought" Smart List and the show-up report.',
                                      effect: { addTags: ['workshop-attended'] },
                                    },
                                    {
                                      id: 'find-seen',
                                      kind: 'ifelse',
                                      title: 'Find Opportunity',
                                      label: 'Open course card?',
                                      branches: [
                                        {
                                          label: 'Opportunity Found',
                                          when: {
                                            type: 'any',
                                            label: `Latest opportunity where Pipeline is Enrollment, Stage is not ${COACHING_LIST}, and Status is Open`,
                                            of: COURSE_STAGES.map((stage) => ({ type: 'opportunity' as const, stage, status: 'open' as const })),
                                          },
                                          nodes: [
                                            {
                                              id: 'opp-attended',
                                              kind: 'action',
                                              action: 'update_opportunity',
                                              title: 'Update Opportunity',
                                              label: 'Attended',
                                              summary: 'Enrollment › Attended, live or replay, on the card this Find just picked. Allow Opportunity to Move to Any Previous Stage stays off and Status is not in the step, so a card already at Checkout Started stays there.',
                                              run: moveCard('Attended'),
                                            },
                                            {
                                              id: 'offer-check',
                                              kind: 'ifelse',
                                              title: 'If/Else',
                                              label: 'Already a student?',
                                              branches: [
                                                {
                                                  label: 'Access paused',
                                                  when: { type: 'tag', has: 'access-paused' },
                                                  nodes: [
                                                    {
                                                      id: 'end-paused',
                                                      kind: 'end',
                                                      title: 'End',
                                                      summary:
                                                        'The branch ends here, with a Sticky Note saying why: this student’s course access is paused while 04 · Billing · Failed Payment Recovery waits for an installment, so a "pick up where you left off" link would open nothing, and an offer for a course they own would be worse. 04’s emails already say how to restore access.',
                                                    },
                                                  ],
                                                },
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
                                                        body: `Hi {{contact.first_name}},\n\nThanks for coming back to the workshop. You already have {{custom_values.course_name}}, so there is nothing to buy here. Pick up where you left off: {{custom_values.course_login}}\n\nStuck on a module? Reply to this email and our student success team will help.\n\n{{custom_values.founder_first_name}}${footer}`,
                                                      },
                                                    },
                                                  ],
                                                },
                                                {
                                                  label: 'Watched the replay',
                                                  when: { type: 'tag', has: 'workshop-replay' },
                                                  nodes: [
                                                    {
                                                      id: 'email-offer-replay',
                                                      kind: 'action',
                                                      action: 'send_email',
                                                      title: 'Send Email',
                                                      label: 'The offer, after the replay',
                                                      summary: 'The same offer without the P.S. about the replay: it can land on Sunday morning, after the replay page has come down.',
                                                      message: {
                                                        channel: 'email',
                                                        subject: 'If you want the full plan: {{custom_values.course_name}}',
                                                        body: `Hi {{contact.first_name}},\n\nThanks for watching {{custom_values.workshop_title}}. The workshop gives you the map. {{custom_values.course_name}} is the full, self-paced version: the skills inventory, the 90-day plan and the templates from the workshop, to work through on your own schedule.\n\nIt is {{custom_values.course_price}} paid once, or {{custom_values.payment_plan}}, which comes to a little more in total. It comes with a {{custom_values.refund_policy}}: email {{custom_values.support_email}} within the guarantee period for a full refund.\n\nEnroll here: {{trigger_link.checkout}}\n\nThe price is the same next week. There is no countdown, so take the time you need.\n\nWant one-to-one help instead? {{custom_values.coaching_name}} is by application: {{trigger_link.apply}}\n\n{{custom_values.founder_first_name}}${footer}`,
                                                      },
                                                    },
                                                  ],
                                                },
                                              ],
                                              otherwise: {
                                                label: 'Attended live',
                                                nodes: [
                                                  {
                                                    id: 'email-offer',
                                                    kind: 'action',
                                                    action: 'send_email',
                                                    title: 'Send Email',
                                                    label: 'The offer',
                                                    summary: 'Price, payment plan and refund policy in plain words, one checkout link, no countdown and no claims about jobs or pay. The P.S. links the replay, for anyone who clicked Join but left early.',
                                                    message: {
                                                      channel: 'email',
                                                      subject: 'If you want the full plan: {{custom_values.course_name}}',
                                                      body: `Hi {{contact.first_name}},\n\nThanks for spending the hour on {{custom_values.workshop_title}}. The workshop gives you the map. {{custom_values.course_name}} is the full, self-paced version: the skills inventory, the 90-day plan and the templates from the workshop, to work through on your own schedule.\n\nIt is {{custom_values.course_price}} paid once, or {{custom_values.payment_plan}}, which comes to a little more in total. It comes with a {{custom_values.refund_policy}}: email {{custom_values.support_email}} within the guarantee period for a full refund.\n\nEnroll here: {{trigger_link.checkout}}\n\nThe price is the same next week. There is no countdown, so take the time you need.\n\nWant one-to-one help instead? {{custom_values.coaching_name}} is by application: {{trigger_link.apply}}\n\n{{custom_values.founder_first_name}}\n\nP.S. Missed part of it? The replay is here until Saturday evening: {{trigger_link.replay}}${footer}`,
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
                                            id: 'goto-offer',
                                            kind: 'goto',
                                            title: 'Go To',
                                            target: 'offer-check',
                                            summary: 'No open course card: a student’s card is Won, and a closed card is never reopened here. Nothing moves; on to the student check.',
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
                                    summary: 'At 8:15 PM. No guilt, one link, and a way in for someone with 20 minutes. The replay page stays up for 48 hours.',
                                    message: {
                                      channel: 'email',
                                      subject: 'Sorry we missed you: the replay is up until Saturday',
                                      body: `Hi {{contact.first_name}},\n\nWe missed you tonight, and that is fine. The full recording of {{custom_values.workshop_title}} is here until Saturday evening:\n\n{{trigger_link.replay}}\n\nIf you only have 20 minutes, watch the first 20. That is the skills map, and you can do it on paper while you watch.\n\n{{custom_values.founder_first_name}}${footer}`,
                                    },
                                  },
                                  {
                                    id: 'wait-replay-1',
                                    kind: 'wait',
                                    title: 'Wait',
                                    label: 'Replay opened? (18 hours)',
                                    mode: 'event',
                                    event: 'link_clicked',
                                    value: 'replay',
                                    minutes: 18 * 60,
                                    summary: 'The contact to take an action: Clicks a trigger link, Workshop Replay. Only that link counts, so a late click on Join does not. Timeout 18 hours, which ends Friday at 2:15 PM Central, a time a text can land anywhere from Eastern to Hawaii.',
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
                                            id: 'tag-replay',
                                            kind: 'action',
                                            action: 'add_tag',
                                            title: 'Add Contact Tag',
                                            label: 'workshop-replay',
                                            summary: 'Watched the replay, not live. Attended Live stays No, so live and replay are counted apart.',
                                            effect: { addTags: ['workshop-replay'] },
                                          },
                                          {
                                            id: 'goto-seen',
                                            kind: 'goto',
                                            title: 'Go To',
                                            target: 'find-seen',
                                            summary: 'Joins the live path at the card update: the same Find, the card to Attended, the same student check and the same offer email, so there is one offer to keep up to date.',
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
                                            summary: 'A reminder about the event they signed up for, not a pitch: no price, no checkout link. It carries the opt-out line because, for someone who registered in the last few minutes before the session, it is the first text. Skipped for anyone on SMS DND.',
                                            message: {
                                              channel: 'sms',
                                              body: "{{location.name}}: Hi {{contact.first_name}}, the replay of Thursday's workshop is up until Saturday evening: {{trigger_link.replay}} Reply STOP to opt out.",
                                            },
                                          },
                                          {
                                            id: 'wait-replay-2',
                                            kind: 'wait',
                                            title: 'Wait',
                                            label: 'Replay opened? (30 hours)',
                                            mode: 'event',
                                            event: 'link_clicked',
                                            value: 'replay',
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
                                                    summary: 'Joins the replay path above: time to watch, the tag, the card to Attended, then the offer.',
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
                                                      body: `Hi {{contact.first_name}},\n\nThe replay of {{custom_values.workshop_title}} is down now. The workshop runs live every Thursday at 7 PM Central, and you are welcome at the next one: {{location.website}}/pivot-plan\n\nIf Thursday evenings do not work for you, reply and tell me what would. I read the replies.\n\n{{custom_values.founder_first_name}}${footer}`,
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
                      summary: 'Enrollment › Registered, status Open, named "{{contact.name}} · Workshop", source Workshop page. Duplicate Opportunity on, because a contact whose only card is a coaching deal from 05 still needs a course card. It only runs when Find came back empty, so nobody gets two course cards.',
                      run: ({ contact }) => {
                        const prev = contact.opportunity;
                        return {
                          effect: { opportunity: { pipeline: 'Enrollment', stage: 'Registered', status: 'open', name: `${contact.firstName} ${contact.lastName} · Workshop` } },
                          log: `New course card in Enrollment › Registered, status Open.${prev ? ` The ${prev.stage} card (${prev.status}) stays as it is.` : ''}`,
                        };
                      },
                    },
                    {
                      id: 'goto-confirm',
                      kind: 'goto',
                      title: 'Go To',
                      target: 'email-confirm',
                      summary: 'On to the confirmation. Nothing leads back to Find Opportunity, so this cannot loop; the Attended update runs its own Find, because a card made by Create Opportunity is not in context for a later Update Opportunity.',
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
              summary: 'Enable DND, SMS only, direction Outbound. GHL then skips every Send SMS below for this contact, and their own texts still reach us. Logged as "DND Enabled by Workflows", so nobody mistakes it for a STOP.',
              effect: { dnd: { sms: true } },
            },
            {
              id: 'tag-dnd',
              kind: 'action',
              action: 'add_tag',
              title: 'Add Contact Tag',
              label: 'sms-off-no-consent',
              summary: 'The receipt for that DND: this workflow turned texts off for lack of consent, the contact did not reply STOP. Only this tag lets a later run turn texts back on, and a STOP never gets it.',
              effect: { addTags: ['sms-off-no-consent'] },
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
        visits: ['can-text:1', 'find-opp:else', 'create-opp', 'goto-confirm', 'email-confirm', 'email-1d', 'sms-1h', 'save-date', 'in-room:else', 'sms-doors', 'joined:0', 'wait-end', 'field-attended', 'tag-attended', 'find-seen:0', 'opp-attended', 'offer-check:else', 'email-offer'],
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
        visits: ['sms-doors', 'joined:else', 'email-replay', 'wait-replay-1:timeout', 'sms-nudge', 'wait-replay-2:met', 'goto-watched', 'wait-watch', 'tag-replay', 'goto-seen', 'find-seen:0', 'opp-attended', 'offer-check:2', 'email-offer-replay'],
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
        visits: ['email-1d', 'sms-1h', 'sms-doors', 'joined:else', 'email-replay', 'wait-replay-1:timeout', 'sms-nudge', 'wait-replay-2:timeout', 'tag-no-show', 'email-next'],
        tags: ['workshop-no-show'],
        stage: 'Registered',
      },
    },
    {
      id: 'student-no-texts',
      label: 'Current student, no texts',
      summary: 'Bought the course last month through a payment link and never ticked a texts box. Registers on Saturday for the live Q&A, misses it, tries the Join link at 8:25 PM after it has ended and opens the replay at 9:40 PM.',
      start: 5 * DAY + 10 * 60 + 15,
      contact: {
        opportunity: { pipeline: 'Enrollment', stage: 'Customer', status: 'won', value: 497, name: 'Marcus Lee · Career Pivot Blueprint' },
        fields: { sms_consent: 'No', sms_marketing_consent: 'No', current_role: 'Manager', goal: 'A new role', purchase: 'Career Pivot Blueprint', payment_plan: 'No' },
      },
      events: [
        { at: fromWorkshop(5 * DAY + 10 * 60 + 15, 85), type: 'link_clicked', value: 'join', label: 'Workshop Join at 8:25 PM, after the session. Not the Replay link, so the wait keeps waiting.' },
        { at: fromWorkshop(5 * DAY + 10 * 60 + 15, 160), type: 'link_clicked', value: 'replay', label: 'Workshop Replay, from the 8:15 PM email' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['untag', 'can-text:else', 'dnd-on', 'tag-dnd', 'goto-find', 'find-opp:0', 'in-room:else', 'joined:else', 'email-replay', 'wait-replay-1:met', 'wait-watch', 'tag-replay', 'goto-seen', 'find-seen:else', 'goto-offer', 'offer-check:1', 'email-student'],
        skips: ['sms-1h', 'sms-doors'],
        tags: ['workshop-replay', 'sms-off-no-consent'],
        stage: 'Customer',
      },
    },
    {
      id: 'student-paused',
      label: 'Student with access paused',
      summary: 'On the payment plan; an installment failed and 04 paused course access last week. Registers on Monday morning for the live Q&A and joins from the doors-open text. No offer and no login email afterward: the course is paused for them.',
      start: 9 * 60 + 5,
      contact: {
        tags: ['payment-failed', 'access-paused'],
        assignedTo: 'jules',
        opportunity: { pipeline: 'Enrollment', stage: 'Customer', status: 'won', value: 497, name: 'Marcus Lee · Career Pivot Blueprint' },
        fields: { sms_consent: 'Yes', sms_marketing_consent: 'No', current_role: 'Individual contributor', goal: 'A new role', purchase: 'Career Pivot Blueprint', payment_plan: 'Yes', course_progress: 'Started' },
      },
      events: [{ at: fromWorkshop(9 * 60 + 5, 2), type: 'link_clicked', value: 'join', label: 'Workshop Join, from the doors-open text' }],
      expect: {
        outcome: 'ended',
        visits: ['can-text:1', 'find-opp:0', 'sms-doors', 'joined:0', 'field-attended', 'tag-attended', 'find-seen:else', 'goto-offer', 'offer-check:0', 'end-paused'],
        tags: ['workshop-attended', 'access-paused'],
        stage: 'Customer',
      },
    },
    {
      id: 'returns-buys',
      label: 'Registers Thursday afternoon, buys live',
      summary: 'Registered for an earlier session without the texts box and never watched, so 01 left SMS DND on. Registers again at 1:50 PM on the day with the box ticked, too late for the day-before email. Replies to the 1-hour text with a question, joins from it at 6:06 PM and pays near the end. 03 takes over.',
      start: 3 * DAY + 13 * 60 + 50,
      contact: {
        tags: ['workshop-no-show', 'sms-off-no-consent'],
        dnd: { sms: true },
        opportunity: { pipeline: 'Enrollment', stage: 'Registered', status: 'open', name: 'Marcus Lee · Workshop' },
        fields: { sms_consent: 'Yes', sms_marketing_consent: 'No', current_role: 'Senior leader', goal: 'Freelancing', workshop_date: EARLIER_SESSION, attended: 'No' },
      },
      events: [
        {
          at: fromWorkshop(3 * DAY + 13 * 60 + 50, -56),
          type: 'reply',
          value: 'Will there be a replay if I have to leave at 8?',
          label: 'Stop on Response is off, so the run carries on. A person answers in Conversations.',
        },
        { at: fromWorkshop(3 * DAY + 13 * 60 + 50, -54), type: 'link_clicked', value: 'join', label: 'Workshop Join, from the 1-hour text' },
        { at: fromWorkshop(3 * DAY + 13 * 60 + 50, 52), type: 'order_submitted', value: 497, label: 'Career Pivot Blueprint, paid in full' },
      ],
      expect: {
        outcome: 'ended',
        visits: ['untag', 'can-text:0', 'dnd-off', 'untag-dnd', 'goto-find-on', 'find-opp:0', 'email-confirm', 'wait-1d', 'wait-1h', 'sms-1h', 'in-room:0', 'goto-live', 'wait-end'],
        skips: ['email-1d'],
        stage: 'Registered',
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'SMS consent (service)', key: 'sms_consent', type: 'Checkbox', note: 'The service box on the form: "workshop reminders and, if I enroll, course and billing notices". Unticked by default, not required. Not Yes means SMS DND on here' },
      { name: 'SMS consent (offers)', key: 'sms_marketing_consent', type: 'Checkbox', note: 'A separate box. Not read here: this workflow sends no marketing texts' },
      { name: 'Workshop Date', key: 'workshop_date', type: 'Date', note: 'Current Date, written at 6 PM on the session day' },
      { name: 'Attended Live', key: 'attended', type: 'Dropdown (single)', note: 'Yes · No. Reset to No on the session day, Yes on a Join click' },
      { name: 'Current Role / Goal', key: 'current_role', type: 'Dropdown (single) ×2', note: 'From the form, used by 05 to pre-fill the application' },
      { name: 'Purchase', key: 'purchase', type: 'Single line', note: 'Written by 03 when they buy. Read here to keep the offer away from students' },
    ],
    tags: [
      { name: 'workshop-joined', note: 'Added by 01a · Workshop · Join Clicked on a Join click; cleared here at the 1-hour mark and read at 6:55 and 8:15 PM' },
      { name: 'workshop-attended', note: 'Clicked Join at the latest session' },
      { name: 'workshop-replay', note: 'Opened the replay of the latest session' },
      { name: 'workshop-no-show', note: 'Neither. All three are cleared when they register again' },
      { name: 'sms-off-no-consent', note: 'This workflow turned SMS DND on for lack of consent. Removed, with the DND, when they tick the service box on a later registration or the texts box on the coaching application (05)' },
    ],
    pipeline: business.pipeline,
    customValues: [
      { name: 'Workshop Title', key: 'workshop_title', value: 'The Career Pivot Plan' },
      { name: 'Workshop Room URL', key: 'workshop_room_url', value: 'The Zoom link behind the Join trigger link' },
      { name: 'Course Name', key: 'course_name', value: 'Career Pivot Blueprint' },
      { name: 'Course Price', key: 'course_price', value: '$497' },
      { name: 'Payment Plan', key: 'payment_plan', value: '3 payments of $179' },
      { name: 'Refund Policy', key: 'refund_policy', value: '14-day money-back guarantee' },
      { name: 'Founder First Name', key: 'founder_first_name', value: 'Morgan' },
    ],
  },
  build: [
    {
      title: 'Agree what "attended" means',
      body: 'Before building, I agreed one signal with Morgan: a click on the Join trigger link between the 1-hour text and 8:15 PM. It means they tried to join, not that they stayed, which is good enough to choose between the offer and the replay. A click before Thursday at 6 PM does not count, so testing the link on Tuesday is not attendance. The Zoom attendee report stays the source of truth for show-up numbers. We also set a budget: texts are reminders only, never more than three in 24 hours, and nothing is sold by text.',
    },
    {
      title: 'Trigger links before copy',
      body: 'Four trigger links: Join, Replay, Checkout and Apply. Join points at a Workshop Room URL custom value, so when the Zoom room changes Morgan updates one value and every email and text follows. Each link goes into messages through the Trigger Links picker. A pasted URL goes to the same page but records no click, and every split after the session depends on that click.',
    },
    {
      title: 'One clock: Event Start Date',
      body: 'Event Start Date sets Thursday at 7 PM as the reference, and three waits of the type An upcoming appointment or booking count from it: a day before, an hour before and 75 minutes after. GHL documents that this action uses the account time zone even when the workflow runs on contact time, which suits a live session. Each wait sets "If this date has already passed" on purpose: both before-waits use Skip all outbound communication actions till next wait or event start date action, so a Thursday-afternoon registrant gets no day-before email and no "starts in 1 hour" text can go out late, and the 8:15 PM wait uses Continue to next action, so a late joiner still gets the offer.',
    },
    {
      title: 'Reading the Join click',
      body: 'An If/Else cannot read a trigger-link click, and a Wait for a click times out a set time after the contact reaches it, which drifts for anyone who registers in the last hour. So a one-action helper, 01a · Workshop · Join Clicked (trigger Trigger Link Clicked, Workshop Join; action Add Contact Tag workshop-joined), turns the click into a tag. This workflow clears the tag at the 1-hour mark, so a test click earlier in the week does not count, then reads it at two moments pinned to the Event Start Date: 6:55 PM, when only people not yet in the room get the doors-open text, and 8:15 PM, when the If/Else splits attended from the replay. A Goal Event on the click was the other option, but a goal pulls the contact forward from wherever they are, so a Tuesday test click would skip every reminder. Both replay waits listen only for the Replay link, so a late click on Join does not count as watching.',
    },
    {
      title: 'Consent by DND, and what it costs',
      body: 'Anyone whose SMS consent (service) is not Yes gets SMS DND switched on at the top, plus a tag, sms-off-no-consent, as the receipt. A Go To then puts them back on the main path. One step replaces an If/Else in front of every text, and a text added next month is covered without anyone remembering. The cost: DND is contact-wide and outlives the run, so it blocks texts from every workflow and from the team. 02 does not lift it, so someone who ticked only the offers box gets no cart text. 05 does lift it when they tick the application’s texts box, the same way this workflow does. It is Outbound only, so their own texts still reach us. The tag is what makes it reversible: when a tagged contact registers again with the box ticked, the workflow switches SMS DND off and removes the tag. A STOP never carries the tag, so a STOP is never undone.',
    },
    {
      title: 'One course card, found twice, never looped',
      body: 'Enrollment holds two kinds of card: the course card (Registered, Attended, Checkout Started, Customer), which 01 to 03 move, and a separate coaching card (Applied, Call Booked, Coaching Client) that 05 creates. At the top, Find Opportunity looks for a course card of any status (Stage is not Applied, Call Booked or Coaching Client). If there is none, Create Opportunity makes one at Registered with Duplicate Opportunity on and Go To carries on to the confirmation, never back to Find. A card made by Create Opportunity is not in context for a later Update Opportunity, so a second Find, open course cards only, runs right before the move to Attended. A student’s Won card fails that filter and is never touched.',
    },
    {
      title: 'The replay path, and one offer',
      body: 'The replay wait is split in two, 18 and 30 hours, so the one nudge text lands on Friday afternoon instead of Thursday night, and the second timeout matches the moment the replay page comes down. Replay viewers get two hours to watch, then Go To the same Find, card update, student check and offer email as live attendees, so there is one offer to keep up to date.',
    },
    {
      title: 'Settings on purpose, then test against the calendar',
      body: 'Allow Re-entry on, because the workshop is weekly. Stop on Response off, because a reply like "see you Thursday" must not cancel the replay. No Time Window, because it would hold the 8:15 PM emails. Paying fires 03, whose first step removes the contact from this workflow. Then one test contact per scenario above (the Thursday-afternoon one included), plus a Friday registration to check that Event Start Date moves to the following Thursday in Execution Logs. Morgan gets the schedule below: who hears what, and when, without opening the builder.',
    },
  ],
  edgeCases: [
    {
      title: 'Registers on Thursday afternoon',
      body: 'The day-before time has already passed, and that wait is set to Skip all outbound communication actions till next wait or event start date action. The day-before email is skipped, the 1-hour wait ends the skip, and they get the confirmation, the 1-hour text and the doors-open text. The last test contact above runs exactly this.',
    },
    {
      title: 'Clicks Join early, registers late, or leaves after five minutes',
      body: 'A click before 6 PM Thursday, like a test on Tuesday, is ignored because the workflow clears the workshop-joined tag at the 1-hour mark. A click at 6:02 PM counts and skips the doors-open text. Someone who registers at 6:30 PM gets the doors-open text at 6:55 like everyone else, and someone who registers at 6:58 PM gets none, because both checks are pinned to the Event Start Date, not to when they arrived. A five-minute visit counts as joined, so they get the offer instead of the replay email, and the offer’s P.S. links the replay.',
    },
    {
      title: 'Replies STOP to the 1-hour text',
      body: 'GHL switches on SMS DND by itself, so the doors-open text and the Friday nudge are skipped. Stop on Response is off, so the emails, including the replay, still arrive. That DND has no sms-off-no-consent tag, so ticking the box at a later registration does not undo it; only their own START does.',
    },
    {
      title: 'Comes back and ticks the box this time',
      body: 'Last time they left it unticked, so SMS DND and the sms-off-no-consent tag are still on. The first If/Else sees both, switches SMS DND off, removes the tag and sends them down the main path, and the first text repeats how to opt out. The one gap is someone who texted STOP while tagged: the new tick is a newer opt-in, and it wins.',
    },
    {
      title: 'Registers again before the run ends',
      body: 'GHL does not let a contact re-enter a workflow they are still in, so a second submit between Thursday night and Saturday evening starts nothing. That is why next week is only linked from the last step, after which the run is over and the next registration starts clean. If someone signs up in that window anyway, the SOP says to remove them from this workflow and add them back from their contact record, which starts a run for next Thursday.',
    },
    {
      title: 'Buys during the session, or already a student',
      body: 'Paying fires 03, which removes the contact from this workflow before 8:15 PM, so a new student gets onboarding instead of an offer for what they just bought. A student who registers later already has a course card, so the first Find stops a second one; the Attended Find looks only at open cards, so their Won card stays in Customer, and after the session they get their course login instead of the offer. A student whose access 04 has paused gets neither: the run ends quietly, because a login link would open nothing.',
    },
  ],
  qa: [
    'Register on a Monday, on a Thursday at 4 PM and on a Friday: Execution Logs show Event Start Date as this Thursday, this Thursday and next Thursday at 7 PM',
    'Register on Thursday afternoon: no day-before email, and the 1-hour and doors-open texts still send',
    'Leave the texts box unticked: the contact shows SMS DND "Enabled by Workflows", Outbound only, and the sms-off-no-consent tag, and both texts show as skipped while every email arrives. Register the same contact again with the box ticked: "DND Disabled by Workflows", the tag is gone and the 1-hour text arrives',
    'Reply STOP to the 1-hour text, then register again with the box ticked: SMS DND stays on and no text goes out',
    'Click Join from the 1-hour text at 6:05 PM: no doors-open text, and at 8:15 PM the card is in Attended, Attended Live is Yes, the tag is there and the offer’s checkout link opens the order form',
    'Click nothing: the replay email at 8:15 PM, one text on Friday at 2:15 PM, the invitation on Saturday at 8:15 PM and the workshop-no-show tag. Click Join at 8:30 PM on a second test contact: nothing changes, because the replay waits count only the Replay link',
    'Open the replay on Friday: the offer arrives about two hours later, the card moves to Attended and Attended Live stays No. Pay during the session on a third: Enrollment History shows the contact removed by 03 and no offer email',
    'A student tagged access-paused who joins live: no offer and no login email, and the run ends at the student check',
    'Register a contact with no card, a student with a Won course card and a contact whose only card is a coaching card: afterward each has exactly one course card, the new ones at Registered, and the Won card has not moved',
    'Every trigger link records a click on the activity timeline, every merge field renders in Gmail, Outlook and on a phone, each text stays within two segments with an 11-letter first name and the real trigger-link URL, and every email carries the unsubscribe link and the Chicago mailing address',
  ],
  snippets: [
    { title: 'Who hears what, and when', language: 'text', code: schedule, note: 'Goes to Morgan and the team with the SOP, so anyone can answer "did they get a reminder?" without opening the builder.' },
    { title: 'Trigger links', language: 'text', code: triggerLinks, note: 'Created once in Marketing › Trigger Links. The Join link’s URL is a custom value, so a new Zoom room is a one-field change.' },
  ],
  features: [
    'Form Submitted',
    'Event Start Date',
    'Remove Contact Tag',
    'If/Else',
    'Trigger Link Clicked (helper 01a)',
    'Enable/Disable DND',
    'Add Contact Tag',
    'Go To',
    'Find Opportunity',
    'Create Opportunity',
    'Send Email',
    'Wait · An upcoming appointment or booking',
    'Send SMS',
    'Update Contact Field',
    'Wait · The contact to take an action',
    'Update Opportunity',
    'Wait · Advance Window',
    'Trigger Links',
    'Allow Re-entry',
  ],
};
