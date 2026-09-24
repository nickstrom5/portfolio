import type { ActionNode, Automation, Condition, Contact } from '@/lib/ghl/types';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** Every email ends with the business name and postal address. */
const footer = '\n\n{{location.name}}, {{location.full_address}}';

/**
 * Add Task's Assign To takes one named user, so a task for the estimator on
 * the appointment splits on Assigned User first. The simulator reads the
 * owner recorded at the first step.
 */
const ownerIsLuis: Condition = { type: 'var', key: 'owner', op: 'eq', value: 'luis', label: 'Assigned User is Luis Grant' };

const NAMES = { maya: 'Maya Ortiz', luis: 'Luis Grant' } as const;

const noshowTask = 'Due In 1 day, Skip Weekends on. The homeowner gets a text they can answer in their own time and a call from the person who drove out.';
const noshowLog = (c: Contact) => `call ${c.firstName} to rebook, due in one business day.`;
const estimateTask = 'Due In 1 day. Moving the card to Estimate Sent afterward starts 04 · Estimate Follow-Up.';
const estimateLog = (c: Contact) => `send ${c.firstName}'s estimate within 24 hours, then move the card to Estimate Sent (that starts 04).`;

/** One Add Task per estimator. */
const task = (id: string, key: keyof typeof NAMES, label: string, summary: string, log: (c: Contact) => string): ActionNode => ({
  id,
  kind: 'action',
  action: 'add_task',
  title: 'Add Task',
  label,
  summary: `Assign To ${NAMES[key]}, ${summary}`,
  run: ({ contact }) => ({ log: `Task for ${NAMES[key]}: ${log(contact)}` }),
});

const statusMap = `What happens                     Trigger or step                      Path
Homeowner books from the link    Customer Booked Appointment          New booking
Office books on the calendar     Appointment Status: New, by a User   New booking
Estimator sets Showed            Goal Event in the running booking    Inspected + estimate task
Estimator sets No-show           Appointment Status: No-show          No-show path
Homeowner or office cancels      Appointment Status: Cancelled        Cancelled path
Office marks it Invalid          None (GHL ends the booking run)      Nothing is sent
Appointment is rescheduled       Old run ends; new time re-enters     New booking (on the test list)`;

const estimatorSop = `Before you leave the driveway, set the appointment status in the app.

Showed    The card moves to Inspected and you get a task:
          estimate out within 24 hours.
No-show   Wait 15 minutes and call once first. Then set No-show:
          the homeowner gets a rebook text within a minute and
          you get a call-back task. Check before you tap it.

Never cancel a visit to tidy your calendar. Cancelled sends the
homeowner a rebook text. Move it or ask the office instead.
Invalid is for spam and test bookings only. It sends nothing.`;

export const inspectionBooked: Automation = {
  id: 'inspection-booked',
  number: '03',
  name: 'Inspection booked',
  kicker: 'Appointments',
  tagline: 'Every booked inspection gets a confirmation and two reminders, and whatever happens on the day moves the pipeline card and tells the right person.',
  problem:
    'Homeowners booked an inspection and forgot about it. Estimators drove out to empty driveways, nobody chased the no-shows, and cards sat in Inspection Booked long after the visit.',
  solution:
    'One workflow for every visit on the Roof Inspection calendar. A booking gets a confirmation and two reminders naming the estimator, and the card moves by itself. Showed starts the estimate task straight away; No-show and Cancelled each get a rebook text and a person to follow up. It finds the deal before it updates it, and it is built around the GHL rule that a cancellation ends the reminder run.',
  evidence: {
    text: 'When an appointment moves from New, Confirmed or Showed to Cancelled, Invalid or No-show, GHL treats it as "Cancelled": "The customer will be pulled out of the workflow, and no further actions will occur."',
    source: 'HighLevel Help Center, "Appointment scenarios in Workflow"',
    href: 'https://help.gohighlevel.com/support/solutions/articles/155000002697-appointment-scenarios-in-workflow',
  },
  workflow: {
    name: '03 · Appointments · Inspection Booked',
    folder: 'Appointments',
    triggers: [
      { title: 'Customer Booked Appointment', filters: ['In Calendar is Roof Inspection'], label: 'Customer Booked Appointment' },
      {
        title: 'Appointment Status',
        filters: ['In Calendar is Roof Inspection', 'Appointment Status is New', 'Modified By is User: Jordan Blake, Maya Ortiz, Luis Grant'],
        label: 'Appointment Status (booked by the office)',
      },
      { title: 'Appointment Status', filters: ['In Calendar is Roof Inspection', 'Appointment Status is No-show'], label: 'Appointment Status (no-show)' },
      { title: 'Appointment Status', filters: ['In Calendar is Roof Inspection', 'Appointment Status is Cancelled'], label: 'Appointment Status (canceled)' },
    ],
    settings: {
      allowReEntry: true,
      stopOnResponse: false,
      timezone: 'contact',
      notes: [
        'Allow Re-entry on: every new appointment gets its own run whatever this says, but GHL says a rescheduled appointment re-enters only with it on, and the No-show and Cancelled runs are also a second entry for an appointment that already had one.',
        'Stop on Response off: a reply like "see you Tuesday" must not cancel the reminders. Replies still land in Conversations.',
        'No workflow Time Window: it would hold the booking confirmation too. The two rebook texts have their own 8 AM to 8 PM Advance Window.',
        'Cancelled and No-show end the run a booking started (GHL rule), so triggers 3 and 4 start a new run on the rebook path.',
      ],
    },
    steps: [
      {
        id: 'remove',
        kind: 'action',
        action: 'remove_from_workflow',
        title: 'Remove from Workflow',
        label: 'Stop lead follow-up',
        summary: 'Another Workflow: 01 · Speed to Lead, 02 · Missed-Call Text-Back and 07 · Database Reactivation, before anything else runs. Nobody with an inspection on the calendar gets a "still interested?" text.',
        run: ({ contact }) => ({ vars: { owner: contact.assignedTo ?? '' } }),
      },
      {
        id: 'settle',
        kind: 'wait',
        title: 'Wait',
        label: 'Let the record settle',
        mode: 'time',
        minutes: 1,
        summary: "One minute, as GHL's race-condition guide advises. The calendar saves the appointment, its status and the estimator it assigns in the same second the trigger fires, and every step below reads them.",
      },
      {
        id: 'consent',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Text consent on file?',
        branches: [
          {
            label: 'Ticked it this time',
            when: {
              type: 'all',
              label: 'SMS consent (service) is Yes and Contact Tag includes sms-off-no-consent',
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
                summary: 'Direction Outbound, Disable, selected channel SMS. An earlier form or booking had no consent, so SMS DND went on with the sms-off-no-consent tag as a receipt. The box is ticked now, which is a new opt-in.',
                effect: { dnd: { sms: false } },
              },
              {
                id: 'untag-nosms',
                kind: 'action',
                action: 'remove_tag',
                title: 'Remove Contact Tag',
                label: 'sms-off-no-consent',
                summary: 'The receipt goes with the DND it explained.',
                effect: { removeTags: ['sms-off-no-consent'] },
              },
              { id: 'goto-find-on', kind: 'goto', title: 'Go To', target: 'find-opp', summary: 'On to Find Opportunity with texts allowed.' },
            ],
          },
          {
            label: 'No consent on file',
            when: {
              type: 'all',
              label: 'SMS consent (service) is not Yes and Contact is not DND for SMS',
              of: [
                { type: 'field', key: 'sms_consent', op: 'neq', value: 'Yes' },
                { type: 'not', of: { type: 'dnd', channel: 'sms' } },
              ],
            },
            nodes: [
              {
                id: 'dnd-on',
                kind: 'action',
                action: 'dnd',
                title: 'Enable/Disable DND',
                label: 'Texts off',
                summary: 'Direction Outbound, Enable, selected channel SMS. Nobody ticked the box on the booking form or said yes to the office, so this and every later workflow sends email and calls only.',
                effect: { dnd: { sms: true } },
              },
              {
                id: 'tag-nosms',
                kind: 'action',
                action: 'add_tag',
                title: 'Add Contact Tag',
                label: 'sms-off-no-consent',
                summary: 'A receipt for the DND above, so a tick on a later booking can lift it. A STOP never gets this tag here.',
                effect: { addTags: ['sms-off-no-consent'] },
              },
              { id: 'goto-find-off', kind: 'goto', title: 'Go To', target: 'find-opp', summary: 'On to Find Opportunity, email only.' },
            ],
          },
        ],
        otherwise: {
          label: 'Consent on file, or texts already off',
          nodes: [
            {
              id: 'find-opp',
              kind: 'ifelse',
              title: 'Find Opportunity',
              label: 'Find the open deal',
              branches: [
                {
                  label: 'Opportunity Found',
                  when: { type: 'all', label: 'Latest opportunity in Roofing Sales with status Open', of: [{ type: 'opportunity', status: 'open' }] },
                  nodes: [
                    {
                      id: 'router',
                      kind: 'ifelse',
                      title: 'If/Else',
                      label: 'Booking, no-show or cancellation?',
                      branches: [
                        {
                          label: 'No-show',
                          when: { type: 'appointment', status: 'noshow' },
                          nodes: [
                            {
                              id: 'opp-noshow',
                              kind: 'action',
                              action: 'update_opportunity',
                              title: 'Update Opportunity',
                              label: 'Back to Contacted',
                              summary: 'Roofing Sales › Contacted, with Allow Opportunity to Move to Any Previous Stage on. Safe because only first inspections go on this calendar. The card now says "needs rebooking", not "booked".',
                              effect: { opportunity: { stage: 'Contacted', status: 'open' } },
                            },
                            {
                              id: 'tag-noshow',
                              kind: 'action',
                              action: 'add_tag',
                              title: 'Add Contact Tag',
                              label: 'inspection-no-show',
                              summary: 'For the "missed and not rebooked" smart list. Removed again when they book.',
                              effect: { addTags: ['inspection-no-show'] },
                            },
                            {
                              id: 'whose-noshow',
                              kind: 'ifelse',
                              title: 'If/Else',
                              label: 'Whose visit?',
                              branches: [
                                {
                                  label: 'Luis',
                                  when: ownerIsLuis,
                                  nodes: [
                                    task('task-noshow-luis', 'luis', 'Call to rebook', noshowTask, noshowLog),
                                    { id: 'goto-noshow', kind: 'goto', title: 'Go To', target: 'quiet-noshow', summary: 'Joins the Maya branch at the rebook text, so there is one copy of it.' },
                                  ],
                                },
                              ],
                              otherwise: {
                                label: 'Maya',
                                nodes: [
                                  task('task-noshow-maya', 'maya', 'Call to rebook', noshowTask, noshowLog),
                                  {
                                    id: 'quiet-noshow',
                                    kind: 'wait',
                                    title: 'Wait',
                                    label: 'Quiet hours',
                                    mode: 'time',
                                    minutes: 0,
                                    window: { start: '08:00', end: '20:00', days: ALL_WEEK },
                                    summary: "No delay, but the Advance Window resumes only between 8 AM and 8 PM in the contact's time zone. A status set at 9 PM gets its text at 8 AM.",
                                  },
                                  {
                                    id: 'sms-noshow',
                                    kind: 'action',
                                    action: 'send_sms',
                                    title: 'Send SMS',
                                    label: 'Sorry we missed you',
                                    summary: 'From the estimator, no blame, one link to a new time.',
                                    message: {
                                      channel: 'sms',
                                      body: "Hi {{contact.first_name}}, it's {{user.first_name}} from Harbor & Pine. Sorry we missed you for your roof inspection. Pick a new time here: {{custom_values.booking_link}} or reply with a day that suits you. Reply STOP to opt out.",
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                        {
                          label: 'Cancelled',
                          when: { type: 'appointment', status: 'cancelled' },
                          nodes: [
                            {
                              id: 'opp-cancel',
                              kind: 'action',
                              action: 'update_opportunity',
                              title: 'Update Opportunity',
                              label: 'Back to Contacted',
                              summary: 'Roofing Sales › Contacted, with Allow Opportunity to Move to Any Previous Stage on.',
                              effect: { opportunity: { stage: 'Contacted', status: 'open' } },
                            },
                            {
                              id: 'tag-cancel',
                              kind: 'action',
                              action: 'add_tag',
                              title: 'Add Contact Tag',
                              label: 'inspection-canceled',
                              summary: 'Same idea as the no-show tag, kept separate so the two can be counted apart.',
                              effect: { addTags: ['inspection-canceled'] },
                            },
                            {
                              id: 'notify-cancel',
                              kind: 'action',
                              action: 'internal_notification',
                              title: 'Internal Notification',
                              label: 'Tell the estimator',
                              summary: 'Type Notification (the bell), To User Type Assigned User, Redirect Page the contact, so the slot can be refilled and someone can call.',
                              message: {
                                channel: 'internal',
                                to: '{{user.name}} (assigned user)',
                                subject: 'Inspection canceled: {{contact.name}}',
                                body: 'The visit on {{appointment.only_start_date}} at {{appointment.only_start_time}} is canceled. The card is back in Contacted and a rebook text goes out between 8 AM and 8 PM. Worth a call: {{contact.phone}}',
                              },
                            },
                            {
                              id: 'quiet-cancel',
                              kind: 'wait',
                              title: 'Wait',
                              label: 'Quiet hours',
                              mode: 'time',
                              minutes: 0,
                              window: { start: '08:00', end: '20:00', days: ALL_WEEK },
                              summary: "No delay, but the Advance Window resumes only between 8 AM and 8 PM in the contact's time zone. A cancellation at 10 PM gets its text at 8 AM.",
                            },
                            {
                              id: 'sms-cancel',
                              kind: 'action',
                              action: 'send_sms',
                              title: 'Send SMS',
                              label: 'Rebook offer',
                              summary: 'Confirms the cancellation and makes rebooking one tap.',
                              message: {
                                channel: 'sms',
                                body: "Hi {{contact.first_name}}, your roof inspection on {{appointment.only_start_date}} is canceled. If you'd like a new time, book here: {{custom_values.booking_link}} or reply and we'll set it up. Reply STOP to opt out.",
                              },
                            },
                          ],
                        },
                      ],
                      otherwise: {
                        label: 'New booking',
                        nodes: [
                          {
                            id: 'untag',
                            kind: 'action',
                            action: 'remove_tag',
                            title: 'Remove Contact Tag',
                            label: 'Clear rebook tags',
                            summary: 'Removes inspection-no-show and inspection-canceled, so those tags always mean "still needs rebooking".',
                            effect: { removeTags: ['inspection-no-show', 'inspection-canceled'] },
                          },
                          {
                            id: 'opp-booked',
                            kind: 'action',
                            action: 'update_opportunity',
                            title: 'Update Opportunity',
                            label: 'Inspection Booked',
                            summary: 'Roofing Sales › Inspection Booked. Backward moves stay off here, so a card someone already moved past Inspection Booked stays where it is.',
                            effect: { opportunity: { stage: 'Inspection Booked', status: 'open' } },
                          },
                          {
                            id: 'sms-confirm',
                            kind: 'action',
                            action: 'send_sms',
                            title: 'Send SMS',
                            label: 'Booking confirmed',
                            summary: 'Goes straight away, day or night: it answers a booking they just made. Carries the reschedule link, not the cancel link.',
                            message: {
                              channel: 'sms',
                              body: "Hi {{contact.first_name}}, you're booked: free roof inspection on {{appointment.only_start_date}} at {{appointment.only_start_time}} with {{user.first_name}} from Harbor & Pine Roofing. Need a different time? {{appointment.reschedule_link}} Reply STOP to opt out.",
                            },
                          },
                          {
                            id: 'email-confirm',
                            kind: 'action',
                            action: 'send_email',
                            title: 'Send Email',
                            label: 'What to expect',
                            summary: "The details in writing, with an Add to Google Calendar link. The calendar's own booking email is off, so this is the only one.",
                            message: {
                              channel: 'email',
                              subject: 'Your roof inspection: {{appointment.only_start_date}} at {{appointment.only_start_time}}',
                              body: "Hi {{contact.first_name}},\n\nYour free roof inspection is booked for {{appointment.only_start_date}} at {{appointment.only_start_time}}. {{user.name}} will meet you at the property.\n\nWhat to expect:\n- It takes about 45 minutes, and someone needs to be home.\n- We check the shingles, flashing, vents and gutters, and the attic if you're OK with us taking a look.\n- At the end, {{user.first_name}} walks you through the photos. Your written estimate follows within 24 hours.\n\nAdd it to your calendar: {{appointment.add_to_google_calendar}}\nNeed a different time? {{appointment.reschedule_link}}\n\nQuestions? Call us at {{custom_values.office_phone}}." + footer,
                            },
                          },
                          {
                            id: 'wait-24h',
                            kind: 'wait',
                            title: 'Wait',
                            label: '24 hours before',
                            mode: 'before_appointment',
                            offset: DAY,
                            summary: 'An upcoming appointment or booking, Type Appointment / Calendar Event, Before 1 day. If this date has already passed: Skip all outbound communication actions till next wait, so a booking made for tomorrow morning gets no "tomorrow" text.',
                            ifPassed: 'skip_outbound',
                          },
                          {
                            id: 'sms-24h',
                            kind: 'action',
                            action: 'send_sms',
                            title: 'Send SMS',
                            label: 'Day-before reminder',
                            summary: 'Names the estimator and the time, with the reschedule link.',
                            message: {
                              channel: 'sms',
                              body: "Hi {{contact.first_name}}, reminder: {{user.first_name}} from Harbor & Pine is coming tomorrow at {{appointment.only_start_time}} for your roof inspection. Can't make it? Move it here: {{appointment.reschedule_link}}",
                            },
                          },
                          {
                            id: 'wait-1h',
                            kind: 'wait',
                            title: 'Wait',
                            label: '1 hour before',
                            mode: 'before_appointment',
                            offset: 60,
                            summary: 'Same wait type, Before 1 hour, with the same past-date option. Slots begin at 9 AM, so this never lands before 8 AM.',
                            ifPassed: 'skip_outbound',
                          },
                          {
                            id: 'sms-1h',
                            kind: 'action',
                            action: 'send_sms',
                            title: 'Send SMS',
                            label: 'Same-day reminder',
                            summary: 'Short, and invites a reply if they are running late.',
                            message: {
                              channel: 'sms',
                              body: 'Hi {{contact.first_name}}, {{user.first_name}} from Harbor & Pine will be with you at {{appointment.only_start_time}} today for your roof inspection. It takes about 45 minutes. Running late? Just reply here.',
                            },
                          },
                          {
                            id: 'wait-after',
                            kind: 'wait',
                            title: 'Wait',
                            label: '3 hours after the start',
                            mode: 'after_appointment',
                            offset: 180,
                            summary: 'Same wait type, After 3 hours. If this date has already passed: Continue to next action. Time for the visit and for the estimator to set the status; Showed cuts it short.',
                            ifPassed: 'continue',
                          },
                          {
                            id: 'goal-showed',
                            kind: 'goal',
                            title: 'Goal Event',
                            label: 'Marked Showed',
                            event: 'appointment_showed',
                            ifNotMet: 'continue',
                            summary: 'Appointment Status is Showed, Roof Inspection calendar. Listens from the moment of booking. If it is still unset when the contact gets here: Continue anyway.',
                          },
                          {
                            id: 'if-showed',
                            kind: 'ifelse',
                            title: 'If/Else',
                            label: 'Did they show?',
                            branches: [
                              {
                                label: 'Showed',
                                when: { type: 'appointment', status: 'showed' },
                                nodes: [
                                  {
                                    // Latest, Roofing Sales, Status Open, right before the card moves. A card this run
                                    // created is not in context for Update Opportunity, and days have passed since the
                                    // first Find, so the workflow looks again instead of trusting it.
                                    id: 'find-inspected',
                                    kind: 'ifelse',
                                    title: 'Find Opportunity',
                                    label: 'Find the card again',
                                    branches: [
                                      {
                                        label: 'Opportunity Found',
                                        when: { type: 'all', label: 'Latest opportunity in Roofing Sales with status Open', of: [{ type: 'opportunity', status: 'open' }] },
                                        nodes: [
                                          {
                                            id: 'opp-inspected',
                                            kind: 'action',
                                            action: 'update_opportunity',
                                            title: 'Update Opportunity',
                                            label: 'Inspected',
                                            summary: 'Roofing Sales › Inspected, backward moves off. The board shows who is waiting for an estimate.',
                                            effect: { opportunity: { stage: 'Inspected', status: 'open' } },
                                          },
                                          {
                                            id: 'whose-estimate',
                                            kind: 'ifelse',
                                            title: 'If/Else',
                                            label: 'Whose estimate?',
                                            branches: [{ label: 'Luis', when: ownerIsLuis, nodes: [task('task-estimate-luis', 'luis', 'Send the estimate', estimateTask, estimateLog)] }],
                                            otherwise: { label: 'Maya', nodes: [task('task-estimate-maya', 'maya', 'Send the estimate', estimateTask, estimateLog)] },
                                          },
                                        ],
                                      },
                                    ],
                                    otherwise: {
                                      label: 'Opportunity Not Found',
                                      nodes: [
                                        {
                                          id: 'notify-nocard',
                                          kind: 'action',
                                          action: 'internal_notification',
                                          title: 'Internal Notification',
                                          label: 'Showed, but no open card',
                                          summary: 'Type Notification to the Assigned User, Redirect Page the contact. Someone closed the deal before setting Showed, so nothing moves and no estimate task is made.',
                                          message: {
                                            channel: 'internal',
                                            to: '{{user.name}} (assigned user)',
                                            subject: 'Showed, but no open card: {{contact.name}}',
                                            body: 'The inspection is marked Showed, but {{contact.name}} has no open Roofing Sales card, so the workflow moved nothing and made no estimate task. If they chose someone else, leave the card Lost. If it was closed by mistake, reopen it at Inspected and send the estimate as usual.',
                                          },
                                        },
                                      ],
                                    },
                                  },
                                ],
                              },
                            ],
                            otherwise: {
                              label: 'No status yet',
                              nodes: [
                                {
                                  id: 'notify-status',
                                  kind: 'action',
                                  action: 'internal_notification',
                                  title: 'Internal Notification',
                                  label: 'Set the status',
                                  summary: 'Type Notification to the Assigned User, Redirect Page the contact. Show rates in reporting are only as good as the statuses, so an unset one gets chased the same day. No-show set after this still sends the rebook text, because that trigger fires on the change.',
                                  message: {
                                    channel: 'internal',
                                    to: '{{user.name}} (assigned user)',
                                    subject: 'Set the status: {{contact.name}}',
                                    body: 'The inspection on {{appointment.only_start_date}} at {{appointment.only_start_time}} has no status yet. Set Showed or No-show on the appointment; No-show sends the rebook text. If they showed, move the card to Inspected and send the estimate as usual.',
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
                    label: 'New card, already booked',
                    summary: 'Roofing Sales › Inspection Booked, source Roof Inspection calendar. It starts at Inspection Booked because the Update Opportunity on the booking path cannot see a card made in this run. Duplicate Opportunity on, and multiple opportunities per contact allowed in the account, so a past customer with a closed deal still gets a new card.',
                    effect: { opportunity: { pipeline: 'Roofing Sales', stage: 'Inspection Booked', status: 'open' } },
                  },
                  {
                    id: 'goto-confirm',
                    kind: 'goto',
                    title: 'Go To',
                    target: 'sms-confirm',
                    summary: 'Joins the booking path at the confirmation, past its stage update, which the new card does not need. Nothing leads back to Find Opportunity, so this cannot loop.',
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'shows',
      label: 'Books online, shows up',
      summary: "Books Monday evening from the link in 01's first text and answers the confirmation, which does not stop the reminders. Maya marks Showed at the end of the Wednesday visit.",
      start: 19 * 60 + 42,
      trigger: 0,
      appointment: { at: 2 * DAY + 10 * 60 - (19 * 60 + 42) },
      contact: {
        assignedTo: 'maya',
        opportunity: { pipeline: 'Roofing Sales', stage: 'New Lead', status: 'open' },
        fields: { service_needed: 'Leak or repair', roof_age: '10-20 years', sms_consent: 'Yes' },
      },
      events: [
        { at: 9, type: 'reply', value: 'Great, see you Wednesday. You can park in the driveway.' },
        { at: 2 * DAY + 10 * 60 + 52 - (19 * 60 + 42), type: 'appointment_showed', label: 'Maya set it from the mobile app at the end of the visit' },
      ],
      expect: { outcome: 'goal', visits: ['sms-confirm', 'email-confirm', 'sms-24h', 'sms-1h', 'goal-showed', 'if-showed:0', 'find-inspected:0', 'whose-estimate:else', 'task-estimate-maya'], stage: 'Inspected' },
    },
    {
      id: 'office',
      label: 'Booked by the office, no card yet',
      summary: 'Phoned in and was booked on the spot, so there is no opportunity, and nobody asked about texts on the call. With no consent on file, 03 switches SMS DND on and everything goes by email. It makes a card at Inspection Booked and finds it again before moving it to Inspected.',
      start: DAY + 11 * 60 + 15,
      trigger: 1,
      appointment: { at: 3 * DAY + 14 * 60 - (DAY + 11 * 60 + 15) },
      contact: { assignedTo: 'luis', source: 'Phone call', fields: { service_needed: 'Storm damage', roof_age: 'Over 20 years' } },
      events: [{ at: 3 * DAY + 14 * 60 + 55 - (DAY + 11 * 60 + 15), type: 'appointment_showed', label: 'Luis set it from the mobile app before leaving' }],
      expect: { outcome: 'goal', visits: ['consent:1', 'dnd-on', 'tag-nosms', 'find-opp:else', 'create-opp', 'goto-confirm', 'email-confirm', 'if-showed:0', 'find-inspected:0', 'opp-inspected', 'whose-estimate:0', 'task-estimate-luis'], skips: ['sms-confirm', 'sms-24h', 'sms-1h'], tags: ['sms-off-no-consent'], stage: 'Inspected' },
    },
    {
      id: 'no-show',
      label: 'Nobody home',
      summary: 'Friday 9 AM visit. Maya waits, calls once and sets No-show, which starts a new run on the rebook path.',
      start: 4 * DAY + 9 * 60 + 20,
      trigger: 2,
      appointment: { at: -20 },
      contact: { assignedTo: 'maya', opportunity: { pipeline: 'Roofing Sales', stage: 'Inspection Booked', status: 'open' }, fields: { sms_consent: 'Yes' } },
      events: [{ at: 0, type: 'appointment_noshow', label: 'Maya waited 15 minutes and called once, then set it from the app' }],
      expect: { outcome: 'completed', visits: ['router:0', 'opp-noshow', 'whose-noshow:else', 'task-noshow-maya', 'sms-noshow'], tags: ['inspection-no-show'], stage: 'Contacted' },
    },
    {
      id: 'no-show-late',
      label: 'No-show set from home at 8:40 PM',
      summary: "Luis's 3 PM Saturday visit. He forgets the status until the evening, so the task is created at once and the rebook text waits for 8 AM on Sunday.",
      start: at(5, 20, 40),
      trigger: 2,
      appointment: { at: at(5, 15) - at(5, 20, 40) },
      contact: { assignedTo: 'luis', opportunity: { pipeline: 'Roofing Sales', stage: 'Inspection Booked', status: 'open' }, fields: { sms_consent: 'Yes' } },
      events: [{ at: 0, type: 'appointment_noshow', label: 'Luis set it from the app at home' }],
      expect: { outcome: 'completed', visits: ['router:0', 'whose-noshow:0', 'task-noshow-luis', 'goto-noshow', 'quiet-noshow', 'sms-noshow'], tags: ['inspection-no-show'], stage: 'Contacted' },
    },
    {
      id: 'cancels',
      label: 'Cancels at 10 PM',
      summary: "Cancels Tuesday's visit from the calendar invite on Sunday night. The estimator hears now; the rebook text waits for 8 AM.",
      start: 6 * DAY + 22 * 60 + 12,
      trigger: 3,
      appointment: { at: 8 * DAY + 13 * 60 - (6 * DAY + 22 * 60 + 12) },
      contact: { assignedTo: 'luis', opportunity: { pipeline: 'Roofing Sales', stage: 'Inspection Booked', status: 'open' }, fields: { sms_consent: 'Yes' } },
      events: [{ at: 0, type: 'appointment_cancelled', label: 'Canceled from the link in the calendar invite' }],
      expect: { outcome: 'completed', visits: ['router:1', 'notify-cancel', 'quiet-cancel', 'sms-cancel'], tags: ['inspection-canceled'], stage: 'Contacted' },
    },
    {
      id: 'lost-at-visit',
      label: 'Showed, but the deal is lost',
      summary: "Thursday 4 PM visit. At the door the homeowner says their insurer is sending its own contractor, so Maya marks the deal Lost in the app, then sets Showed. The card is not moved and nobody is told to send an estimate.",
      start: at(1, 20, 5),
      trigger: 0,
      appointment: { at: at(3, 16) - at(1, 20, 5) },
      contact: {
        assignedTo: 'maya',
        opportunity: { pipeline: 'Roofing Sales', stage: 'Contacted', status: 'open' },
        fields: { service_needed: 'Storm damage', roof_age: '10-20 years', sms_consent: 'Yes' },
      },
      events: [
        { at: at(3, 16, 35) - at(1, 20, 5), type: 'opportunity_lost', label: 'Insurer is sending its own contractor; Maya marks the deal Lost' },
        { at: at(3, 16, 37) - at(1, 20, 5), type: 'appointment_showed', label: 'Maya sets Showed before she leaves' },
      ],
      expect: { outcome: 'goal', visits: ['opp-booked', 'goal-showed', 'if-showed:0', 'find-inspected:else', 'notify-nocard'], stage: 'Inspection Booked' },
    },
    {
      id: 'ticks-now',
      label: 'Ticks the texts box this time',
      summary: 'Filled in the inspection form last month without ticking the texts box, so 01 switched SMS DND on and left its receipt tag. Books from the email link on Wednesday and ticks the box on the booking form: that is a new opt-in, so DND comes off and the confirmation and reminders go by text. Nobody sets the status.',
      start: at(2, 19, 30),
      trigger: 0,
      appointment: { at: at(4, 10) - at(2, 19, 30) },
      contact: {
        assignedTo: 'maya',
        tags: ['stl-no-response', 'sms-off-no-consent'],
        dnd: { sms: true },
        opportunity: { pipeline: 'Roofing Sales', stage: 'New Lead', status: 'open' },
        fields: { service_needed: 'Leak or repair', roof_age: 'Under 10 years', sms_consent: 'Yes' },
      },
      events: [],
      expect: { outcome: 'completed', visits: ['consent:0', 'dnd-off', 'untag-nosms', 'goto-find-on', 'opp-booked', 'sms-confirm', 'sms-24h', 'sms-1h', 'if-showed:else', 'notify-status'], stage: 'Inspection Booked' },
    },
    {
      id: 'rebooks',
      label: 'Rebooks with texts off',
      summary: 'Replied STOP to an earlier rebook text, then booked again online. Email only, and nobody sets the status.',
      start: 3 * DAY + 12 * 60 + 30,
      trigger: 0,
      appointment: { at: 5 * DAY + 11 * 60 - (3 * DAY + 12 * 60 + 30) },
      contact: {
        assignedTo: 'luis',
        tags: ['inspection-canceled'],
        dnd: { sms: true },
        opportunity: { pipeline: 'Roofing Sales', stage: 'Contacted', status: 'open' },
      },
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['untag', 'email-confirm', 'goal-showed', 'if-showed:else', 'notify-status'],
        skips: ['sms-confirm', 'sms-24h', 'sms-1h'],
        stage: 'Inspection Booked',
      },
    },
  ],
  dataModel: {
    tags: [
      { name: 'inspection-no-show', note: 'Missed the visit and has not rebooked. Removed when they book again' },
      { name: 'inspection-canceled', note: 'Canceled and has not rebooked. Removed when they book again' },
    ],
    pipeline: { name: 'Roofing Sales', stages: ['New Lead', 'Contacted', 'Inspection Booked', 'Inspected', 'Estimate Sent', 'Job Scheduled', 'Job Complete'] },
    customValues: [
      { name: 'Booking Link', key: 'booking_link', value: 'harborpine.example/book' },
      { name: 'Office Phone', key: 'office_phone', value: '(312) 555-0142' },
    ],
  },
  build: [
    {
      title: 'Calendar first',
      body: "Roof Inspection is a Round Robin calendar for Maya and Luis: 45-minute visits, Monday to Saturday, 9 AM to 5 PM. Assign Contacts to Their Respective Calendar Team Members is on, so the estimator named in every message is the one who is coming (01's round robin picks who calls; the calendar picks who visits), and a contact's future appointments stay with that estimator. Cancellation and rescheduling are allowed, so both links ride in the calendar invite. The calendar's own emails to the homeowner are off, so they hear from one place. Only first inspections go on this calendar; estimate walk-throughs use the estimators' own calendars.",
    },
    {
      title: 'Four triggers, one workflow',
      body: 'Customer Booked Appointment catches bookings from the link. Appointment Status: New, with Modified By set to the three people who book (Jordan, Maya and Luis), catches bookings the office makes; a link booking is Modified By Customer, so it never matches both. Two more Appointment Status triggers, No-show and Cancelled, bring the contact back in for the rebook paths.',
    },
    {
      title: 'Build around the cancellation rule',
      body: 'GHL pulls a contact out of an appointment workflow when that appointment is canceled or marked No-show, so a No-show branch at the end of the reminders would never run. Those statuses start a new run instead, and an If/Else near the top reads the status and picks the path. The first thing I verify in a live account is that GHL removes only the booking run, not the new run for the same appointment. If it removed both, triggers 3 and 4 and the two rebook paths would move to a small workflow of their own, unchanged.',
    },
    {
      title: 'Find the deal before updating it',
      body: 'An appointment trigger carries no opportunity, and Update Opportunity is skipped when it has none. Find Opportunity picks the latest open deal in Roofing Sales. If there is none, Create Opportunity makes one straight at Inspection Booked and a Go To joins the booking path at the confirmation: a card created in the run is not in context for a later Update Opportunity (the Update Opportunity FAQ says so), so the new card starts where the update would have put it. Before the move to Inspected, a second Find Opportunity looks for the open card again. Nothing leads back into a Find, so there is no loop to guard. Duplicate Opportunity is on in the action and the account allows multiple opportunities per contact, so a past customer gets a new card.',
    },
    {
      title: 'Reminders tied to the appointment',
      body: 'Both reminders use the "An upcoming appointment or booking" wait, Type Appointment / Calendar Event. "If this date has already passed" is set to Skip all outbound communication actions till next wait or event start date action, so a booking made less than a day ahead gets its confirmation and the 1-hour reminder, not two texts a minute apart. The wait after the visit is set to Continue to next action, so a booking entered after the fact still reaches the status check.',
    },
    {
      title: 'One Goal Event, spent on Showed',
      body: 'GHL allows one Goal Event per workflow. I used it for Showed: when the estimator sets it from the mobile app, the contact jumps from the post-visit wait straight to the Inspected stage and the estimate task. If nothing is set three hours after the start, the estimator gets a nudge.',
    },
    {
      title: 'Settings and consent',
      body: 'Allow Re-entry on, for reschedules and for the second run a No-show or Cancelled starts. Stop on Response off, because "see you Tuesday" should not cancel the reminders. No workflow time window, because it would hold the booking confirmation too; the rebook texts get their own 8 AM to 8 PM window. Every text is about a visit the homeowner booked, with no offers. Texts need consent on file. The calendar\'s booking form carries the same unticked, optional SMS consent (service) box as the landing page, the office asks "can we text you about the visit?" on the phone and ticks the field on a yes, and 03 checks the field before anything else: no consent means SMS DND on, with an sms-off-no-consent tag as the receipt, so 03 and every later workflow send email only. A tick on a later booking is a new opt-in, so 03 lifts a DND that carries the receipt; a STOP never does. The first text carries the opt-out line.',
    },
    {
      title: 'Test with real bookings',
      body: 'On a test contact I book through the link, book as staff, reschedule from the link and from the calendar, cancel from the invite, and set Showed and No-show, reading Enrollment History and Execution Logs after each: one run per booking, the booking run removed on a cancel, the Cancelled run still going, the right path after it. Then the status map and the estimator card below go to the office.',
    },
  ],
  edgeCases: [
    {
      title: 'Cancels during the reminders',
      body: 'GHL ends the booking run the moment the status changes, so no reminder follows a cancellation. The Cancelled trigger starts a new run: the card goes back to Contacted, the estimator is told at once, and the rebook text waits for 8 AM if they cancelled at night. Invalid, for spam bookings, ends the run the same way and sends nothing.',
    },
    {
      title: 'Reschedules instead',
      body: "GHL's Appointment Status FAQ says a rescheduled appointment is treated as a new one and re-enters from the beginning, so it gets a fresh confirmation and new reminders. An office reschedule matches trigger 2. A homeowner's reschedule is Modified By Customer, which trigger 2 skips on purpose, so it relies on Customer Booked Appointment firing for it. That is the first item on the test list; if it does not fire, trigger 2 also gets Modified By Customer and a new link booking is re-tested for a double entry.",
    },
    {
      title: 'Books for tomorrow morning',
      body: 'The 24-hour wait has already passed, and its past-date setting skips outbound messages until the next wait. They get the confirmation and the 1-hour reminder only.',
    },
    {
      title: 'No opportunity yet',
      body: 'Someone who phoned the office and was booked on the spot has no card. Find Opportunity takes Not Found, Create Opportunity adds one at Inspection Booked, and the Go To joins the confirmation. The Find before Inspected picks it up. A past customer whose only card is Won gets a new card as well, so the old job stays in the revenue report.',
    },
    {
      title: 'Estimator forgets the status, or sets the wrong one',
      body: 'Three hours after the start, a notification asks for Showed or No-show, and No-show set later still sends the rebook text. A wrong No-show is worse: the homeowner is texted within a minute, and changing it to Showed starts nothing because the booking run has ended. The SOP says to check before tapping, and the card is then fixed by hand.',
    },
    {
      title: 'Texts are off, or the reply is "Cancel"',
      body: 'A contact on SMS DND gets every email and no texts; the confirmation email has an Add to Google Calendar link so their own calendar does the reminding. A homeowner who answers a reminder with just "Cancel" ends up there too: CANCEL is a carrier opt-out keyword, so SMS DND goes on and the visit stays booked. That is why no message asks for a reply to cancel. The reply still shows in the estimator\'s Conversations, so they can call.',
    },
  ],
  qa: [
    'Book through the link: one text, one email and one run in Enrollment History; the text names the estimator on the appointment, and replying "see you then" does not stop the reminders',
    'Book on the calendar as staff: the same messages through the Appointment Status trigger, and still one run',
    'Book less than 24 hours ahead: no day-before text, and the 1-hour reminder still sends',
    'Cancel from the invite mid-reminders: the booking run shows as removed, a new Cancelled run starts and is not removed with it, and a 10 PM cancel gets its rebook text at 8 AM',
    'Reschedule from the link and from the calendar: the old run ends, and the new time gets a fresh confirmation and reminders',
    'Set No-show on one booking and Showed on another, one for each estimator: Contacted, tag, task and one rebook text for the first; Inspected and an estimate task due in a day for the second, each task with the estimator on the appointment',
    'A contact with no opportunity and one with only a Won card: exactly one new card each, created at Inspection Booked, and moved to Inspected by the second Find after Showed',
    'Mark a test card Lost, then set Showed: the second Find takes Not Found, the card stays Lost and the estimator gets the "no open card" alert, not an estimate task',
    'Every appointment merge field (date, time, reschedule link, Add to Google Calendar) renders on a real phone and in Gmail and Outlook',
  ],
  snippets: [
    { title: 'What each status change does', language: 'text', code: statusMap, note: 'Goes to the office with the SOP, so nobody needs the builder open to know what a status change will do.' },
    { title: 'Estimator card (SOP)', language: 'text', code: estimatorSop, note: 'Statuses drive the pipeline, the texts and the show-rate report, so the SOP is about setting them, not about the workflow.' },
  ],
  features: [
    'Round Robin calendar',
    'Customer Booked Appointment',
    'Appointment Status',
    'Remove from Workflow',
    'Find Opportunity',
    'Create Opportunity',
    'Go To',
    'If/Else',
    'Update Opportunity',
    'Remove Contact Tag',
    'Send SMS',
    'Send Email',
    'Appointment merge fields',
    'Wait · upcoming appointment',
    'Goal Event',
    'Add Contact Tag',
    'Add Task',
    'Internal Notification',
    'Wait · Advance Window',
  ],
};
