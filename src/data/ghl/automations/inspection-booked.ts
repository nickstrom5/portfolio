import type { Automation, Contact } from '@/lib/ghl/types';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** First name of the contact's owner, for task and log lines. Users are keyed by first name. */
const owner = (c: Contact) => (c.assignedTo ? c.assignedTo[0].toUpperCase() + c.assignedTo.slice(1) : 'the assigned estimator');

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
    text: 'When an appointment moves from New, Confirmed or Showed to Cancelled, Invalid or No-show, GHL treats it as cancelled: "The customer will be pulled out of the workflow, and no further actions will occur."',
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
      { title: 'Appointment Status', filters: ['In Calendar is Roof Inspection', 'Appointment Status is Cancelled'], label: 'Appointment Status (cancelled)' },
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
                        id: 'task-noshow',
                        kind: 'action',
                        action: 'add_task',
                        title: 'Add Task',
                        label: 'Call to rebook',
                        summary: 'For the assigned estimator, due in 1 day with Skip Weekends on. A call rebooks more people than a text alone.',
                        run: ({ contact }) => ({ log: `Task for ${owner(contact)}: call ${contact.firstName} to rebook, due in one business day.` }),
                      },
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
                        label: 'inspection-cancelled',
                        summary: 'Same idea as the no-show tag, kept separate so the two can be counted apart.',
                        effect: { addTags: ['inspection-cancelled'] },
                      },
                      {
                        id: 'notify-cancel',
                        kind: 'action',
                        action: 'internal_notification',
                        title: 'Internal Notification',
                        label: 'Tell the estimator',
                        summary: 'In-app and email to the assigned user, so the slot can be refilled and someone can call.',
                        message: {
                          channel: 'internal',
                          to: '{{user.name}} (assigned user)',
                          subject: 'Inspection cancelled: {{contact.name}}',
                          body: 'The visit on {{appointment.only_start_date}} at {{appointment.only_start_time}} is cancelled. The card is back in Contacted and a rebook text goes out between 8 AM and 8 PM. Worth a call: {{contact.phone}}',
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
                          body: "Hi {{contact.first_name}}, your roof inspection on {{appointment.only_start_date}} is cancelled. If you'd like a new time, book here: {{custom_values.booking_link}} or reply and we'll set it up. Reply STOP to opt out.",
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
                      summary: 'Removes inspection-no-show and inspection-cancelled, so those tags always mean "still needs rebooking".',
                      effect: { removeTags: ['inspection-no-show', 'inspection-cancelled'] },
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
                        body: "Hi {{contact.first_name}},\n\nYour free roof inspection is booked for {{appointment.only_start_date}} at {{appointment.only_start_time}}. {{user.name}} will meet you at the property.\n\nWhat to expect:\n- It takes about 45 minutes, and someone needs to be home.\n- We check the shingles, flashing, vents and gutters, and the attic if you're OK with us taking a look.\n- At the end, {{user.first_name}} walks you through the photos. Your written estimate follows within 24 hours.\n\nAdd it to your calendar: {{appointment.add_to_google_calendar}}\nNeed a different time? {{appointment.reschedule_link}}\n\nQuestions? Call us at {{custom_values.office_phone}}.\n\nHarbor & Pine Roofing",
                      },
                    },
                    {
                      id: 'wait-24h',
                      kind: 'wait',
                      title: 'Wait',
                      label: '24 hours before',
                      mode: 'before_appointment',
                      offset: DAY,
                      summary: 'An upcoming appointment: 24 hours before it starts. If that has already passed, it skips outbound messages until the next wait.',
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
                      summary: 'An upcoming appointment: 1 hour before it starts, with the same past-date setting. Slots begin at 9 AM, so this never lands before 8 AM.',
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
                      summary: 'An upcoming appointment: 3 hours after it starts, and Continue to next action if that has passed. Time for the visit and for the estimator to set the status. Showed cuts this short.',
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
                              id: 'opp-inspected',
                              kind: 'action',
                              action: 'update_opportunity',
                              title: 'Update Opportunity',
                              label: 'Inspected',
                              summary: 'Roofing Sales › Inspected, backward moves off. The board shows who is waiting for an estimate.',
                              effect: { opportunity: { stage: 'Inspected', status: 'open' } },
                            },
                            {
                              id: 'task-estimate',
                              kind: 'action',
                              action: 'add_task',
                              title: 'Add Task',
                              label: 'Send the estimate',
                              summary: 'For the assigned estimator, due in 1 day. Moving the card to Estimate Sent afterwards starts 04 · Estimate Follow-Up.',
                              run: ({ contact }) => ({ log: `Task for ${owner(contact)}: send ${contact.firstName}'s estimate within 24 hours, then move the card to Estimate Sent (that starts 04).` }),
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
                            summary: 'Show rates in reporting are only as good as the statuses, so an unset one gets chased the same day. No-show set after this still sends the rebook text, because that trigger fires on the change.',
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
              label: 'New card',
              summary: 'Roofing Sales › New Lead, source Roof Inspection calendar. Duplicate Opportunity on, and multiple opportunities per contact allowed in the account, so a past customer with a closed deal still gets a new card.',
              effect: { opportunity: { pipeline: 'Roofing Sales', stage: 'New Lead', status: 'open' } },
            },
            {
              id: 'goto-find',
              kind: 'goto',
              title: 'Go To',
              target: 'find-opp',
              summary: 'A created opportunity is not in context for later updates, so the contact goes back through Find Opportunity, which now finds it. This only loops if Create makes nothing, which is why the account setting above is on the build checklist.',
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
      expect: { outcome: 'goal', visits: ['sms-confirm', 'email-confirm', 'sms-24h', 'sms-1h', 'goal-showed', 'if-showed:0', 'task-estimate'], stage: 'Inspected' },
    },
    {
      id: 'office',
      label: 'Booked by the office, no card yet',
      summary: 'Phoned in and was booked on the spot, so there is no opportunity. The workflow makes one, then runs as normal.',
      start: DAY + 11 * 60 + 15,
      trigger: 1,
      appointment: { at: 3 * DAY + 14 * 60 - (DAY + 11 * 60 + 15) },
      contact: { assignedTo: 'luis', source: 'Phone call', fields: { service_needed: 'Storm damage', roof_age: 'Over 20 years' } },
      events: [{ at: 3 * DAY + 14 * 60 + 55 - (DAY + 11 * 60 + 15), type: 'appointment_showed', label: 'Luis set it from the mobile app before leaving' }],
      expect: { outcome: 'goal', visits: ['find-opp:else', 'create-opp', 'goto-find', 'find-opp:0', 'opp-booked', 'if-showed:0'], stage: 'Inspected' },
    },
    {
      id: 'no-show',
      label: 'Nobody home',
      summary: 'Friday 9 AM visit. Maya waits, calls once and sets No-show, which starts a new run on the rebook path.',
      start: 4 * DAY + 9 * 60 + 20,
      trigger: 2,
      appointment: { at: -20 },
      contact: { assignedTo: 'maya', opportunity: { pipeline: 'Roofing Sales', stage: 'Inspection Booked', status: 'open' } },
      events: [{ at: 0, type: 'appointment_noshow', label: 'Maya waited 15 minutes and called once, then set it from the app' }],
      expect: { outcome: 'completed', visits: ['router:0', 'opp-noshow', 'task-noshow', 'sms-noshow'], tags: ['inspection-no-show'], stage: 'Contacted' },
    },
    {
      id: 'cancels',
      label: 'Cancels at 10 PM',
      summary: "Cancels Tuesday's visit from the calendar invite on Sunday night. The estimator hears now; the rebook text waits for 8 AM.",
      start: 6 * DAY + 22 * 60 + 12,
      trigger: 3,
      appointment: { at: 8 * DAY + 13 * 60 - (6 * DAY + 22 * 60 + 12) },
      contact: { assignedTo: 'luis', opportunity: { pipeline: 'Roofing Sales', stage: 'Inspection Booked', status: 'open' } },
      events: [{ at: 0, type: 'appointment_cancelled', label: 'Cancelled from the link in the calendar invite' }],
      expect: { outcome: 'completed', visits: ['router:1', 'notify-cancel', 'quiet-cancel', 'sms-cancel'], tags: ['inspection-cancelled'], stage: 'Contacted' },
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
        tags: ['inspection-cancelled'],
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
      { name: 'inspection-cancelled', note: 'Cancelled and has not rebooked. Removed when they book again' },
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
      body: 'GHL pulls a contact out of an appointment workflow when that appointment is cancelled or marked No-show, so a No-show branch at the end of the reminders would never run. Those statuses start a new run instead, and an If/Else near the top reads the status and picks the path. The first thing I verify in a live account is that GHL removes only the booking run, not the new run for the same appointment. If it removed both, triggers 3 and 4 and the two rebook paths would move to a small workflow of their own, unchanged.',
    },
    {
      title: 'Find the deal before updating it',
      body: 'An appointment trigger carries no opportunity, and Update Opportunity is skipped when it has none. Find Opportunity picks the latest open deal in Roofing Sales. If there is none, Create Opportunity makes one and a Go To sends the contact back through Find, because a card created in the run is not in context for later updates. That loop is only safe if Create always creates, so Duplicate Opportunity is on in the action and the account allows multiple opportunities per contact.',
    },
    {
      title: 'Reminders tied to the appointment',
      body: 'Both reminders use the "An upcoming appointment or booking" wait. "If this date has already passed" is set to skip outbound messages until the next wait, so a booking made less than a day ahead gets its confirmation and the 1-hour reminder, not two texts a minute apart.',
    },
    {
      title: 'One Goal Event, spent on Showed',
      body: 'GHL allows one Goal Event per workflow. I used it for Showed: when the estimator sets it from the mobile app, the contact jumps from the post-visit wait straight to the Inspected stage and the estimate task. If nothing is set three hours after the start, the estimator gets a nudge.',
    },
    {
      title: 'Settings and consent',
      body: 'Allow Re-entry on, for reschedules and for the second run a No-show or Cancelled starts. Stop on Response off, because "see you Tuesday" should not cancel the reminders. No workflow time window, because it would hold the booking confirmation too; the rebook texts get their own 8 AM to 8 PM window. Every text is about a visit the homeowner booked, with no offers. The booking form says appointment texts will follow, the first one carries the opt-out line, and anyone who says no to texts on the phone gets SMS DND from the office, which leaves them the emails.',
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
      body: 'Someone who phoned the office and was booked on the spot has no card. Find Opportunity takes Not Found, Create Opportunity adds one, and the Go To runs Find again. A past customer whose only card is Won gets a new card as well, so the old job stays in the revenue report.',
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
    'Set No-show on one booking and Showed on another: Contacted, tag, task and one rebook text for the first; Inspected and an estimate task due in a day for the second',
    'A contact with no opportunity and one with only a Won card: exactly one new card each, Find Opportunity twice in Execution Logs, then Inspection Booked',
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
