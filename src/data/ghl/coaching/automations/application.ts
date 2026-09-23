import type { Automation, Contact, RunContext } from '@/lib/ghl/types';
import { formatClock, nextWeekdayAt } from '@/lib/ghl/engine';
import { business } from '../business';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];

/** Minutes after Monday 00:00 of the sample week (Mon Mar 2 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** Enrollment pipeline, in order. Update Opportunity only moves a card forward. */
const STAGES = business.pipeline.stages;
const COACHING = business.env.customValues.coaching_name;
const userName = (key: string) => business.env.users[key]?.name ?? key;

/* ---------- Readiness score: the same tables as the Custom Code step ---------- */

const TIMELINE: Record<string, number> = { 'In the next 3 months': 30, '3-6 months': 20, '6-12 months': 10, 'Just exploring': 0 };
const HOURS: Record<string, number> = { 'More than 8 hours': 25, '5-8 hours': 20, '2-4 hours': 10, 'Under 2 hours': 0 };
const BUDGET: Record<string, number> = { 'Over $3,000': 30, '$1,500-$3,000': 25, '$500-$1,500': 10, 'Under $500': 0 };
const ROLE: Record<string, number> = { 'Senior leader': 15, Manager: 15, 'Individual contributor': 10, 'Between roles': 10 };
const CAP = 60;

/** Same logic as the Custom Code step below, so the simulator scores exactly like the build. */
function readiness(c: Contact) {
  const answer = (v: unknown) => String(v ?? '').trim();
  const timeline = answer(c.fields.pivot_timeline);
  const budget = answer(c.fields.coaching_budget);
  const parts = {
    timeline: TIMELINE[timeline] || 0,
    hours: HOURS[answer(c.fields.weekly_hours)] || 0,
    budget: BUDGET[budget] || 0,
    role: ROLE[answer(c.fields.current_role)] || 0,
  };
  const sum = parts.timeline + parts.hours + parts.budget + parts.role;
  const reason = budget === 'Under $500' ? 'the budget is under $500' : timeline === 'Just exploring' ? 'they are just exploring' : '';
  return { score: reason ? Math.min(sum, CAP) : sum, sum, parts, reason };
}

const scoreCode = `// Custom Code step, JavaScript. Properties added in the step:
//   timeline = {{contact.pivot_timeline}}
//   hours    = {{contact.weekly_hours}}
//   budget   = {{contact.coaching_budget}}
//   role     = {{contact.current_role}}
// GHL wraps this in an async function and reads the result from \`output\`.
// The keys below are the survey's dropdown options, spelled exactly the same.
const TIMELINE = { 'In the next 3 months': 30, '3-6 months': 20, '6-12 months': 10, 'Just exploring': 0 };
const HOURS = { 'More than 8 hours': 25, '5-8 hours': 20, '2-4 hours': 10, 'Under 2 hours': 0 };
const BUDGET = { 'Over $3,000': 30, '$1,500-$3,000': 25, '$500-$1,500': 10, 'Under $500': 0 };
const ROLE = { 'Senior leader': 15, 'Manager': 15, 'Individual contributor': 10, 'Between roles': 10 };

const answer = (v) => String(v || '').trim();
const timeline = answer(inputData.timeline);
const budget = answer(inputData.budget);

let score =
  (TIMELINE[timeline] || 0) +
  (HOURS[answer(inputData.hours)] || 0) +
  (BUDGET[budget] || 0) +
  (ROLE[answer(inputData.role)] || 0);

// Two answers mean "the course first", whatever the rest adds up to.
// Without this, strong answers everywhere else reach exactly 70.
const capped = budget === 'Under $500' || timeline === 'Just exploring';
if (capped) score = Math.min(score, 60);

output = { application_score: score, capped: capped };`;

/* ---------- Card moves ---------- */

/** Update Opportunity: stage Applied, renamed for the coaching deal, value 0. Backward moves are off. */
function toApplied({ contact }: RunContext) {
  const current = contact.opportunity?.stage ?? '';
  const name = `${contact.firstName} ${contact.lastName} · ${COACHING}`;
  if (current === 'Applied') return { log: 'The card is already in Applied, so nothing changes.' };
  if (STAGES.indexOf(current) > STAGES.indexOf('Applied')) return { log: `The card is already in ${current}. Backward moves are off, so it stays there.` };
  return { effect: { opportunity: { stage: 'Applied', name, value: 0 } }, log: `Enrollment › Applied, moved from ${current}. Renamed "${name}", value 0 until a package is agreed.` };
}

function toCallBooked({ contact }: RunContext) {
  const current = contact.opportunity?.stage ?? '';
  if (current === 'Call Booked') return { log: 'The card is already in Call Booked, so nothing changes.' };
  if (STAGES.indexOf(current) > STAGES.indexOf('Call Booked')) return { log: `The card is already in ${current}. Backward moves are off, so it stays there.` };
  return { effect: { opportunity: { stage: 'Call Booked' } }, log: `Enrollment › Call Booked, moved from ${current}.` };
}

/** Texts about a sales call need the offers consent, and no SMS DND. */
const canText = (c: Contact) => c.fields.sms_marketing_consent === 'Yes' && !c.dnd.sms;

/** Add Task with Due In 1 day, Due Time 11:00 AM and Skip Weekends on. */
function callTask({ contact, now }: RunContext) {
  return {
    log: `Task for Devon Brooks, due ${formatClock(nextWeekdayAt(now, 11 * 60))}: reach ${contact.firstName} ${contact.lastName} about the coaching application (score ${contact.fields.application_score}). No call booked in 2 days. Check Conversations first and answer any reply before calling. ${canText(contact) ? 'Call or text.' : 'Call or email only: no consent to texts about offers.'}`,
  };
}

/* ---------- Test contacts ---------- */

interface Answers {
  role: string;
  timeline: string;
  hours: string;
  budget: string;
  /** The survey's texts box, which writes SMS consent (offers). */
  texts: 'Yes' | 'No';
  story: string;
}

/** What the survey writes to the contact. Help Wanted is always the coaching option: the other one is disqualified before 05. */
const answers = (a: Answers): Contact['fields'] => ({
  current_role: a.role,
  help_wanted: 'Coaching through a career change',
  pivot_timeline: a.timeline,
  weekly_hours: a.hours,
  coaching_budget: a.budget,
  pivot_story: a.story,
  sms_marketing_consent: a.texts,
});

/** A workshop registrant as 01 left them: an open Enrollment card, no owner. */
const registrant = (stage: string, tags: string[], a: Answers, extra: Contact['fields'] = {}, dnd: Contact['dnd'] = {}): Partial<Contact> => ({
  tags,
  dnd,
  opportunity: { pipeline: 'Enrollment', stage, status: 'open', name: 'Marcus Lee · Workshop' },
  fields: { sms_consent: 'Yes', ...extra, ...answers(a) },
});

/** A student as 03 left them: the course card at Customer and Won, Jules as owner. */
const student = (tags: string[], a: Answers, progress: string): Partial<Contact> => ({
  tags,
  assignedTo: 'jules',
  opportunity: { pipeline: 'Enrollment', stage: 'Customer', status: 'won', value: 497, name: 'Marcus Lee · Career Pivot Blueprint' },
  fields: { purchase: 'Career Pivot Blueprint', payment_plan: 'No', course_progress: progress, sms_consent: 'No', ...answers(a) },
});

/* ---------- Copy ---------- */

/** Postal address on every email to the applicant (CAN-SPAM); the unsubscribe link comes from the sub-account setting. */
const footer = '\n\n{{location.name}}, {{location.full_address}}';

const devonSign = `{{user.name}}\nEnrollment advisor, {{location.name}}${footer}`;

const inviteBody = `Hi {{contact.first_name}},

Thank you for applying for {{custom_values.coaching_name}}. From your answers, the right next step is a strategy call with me.

It is 30 minutes on video. We talk about where you are now, the change you want to make and the time you can give it. If coaching looks like a fit, I explain how it works and what it costs. If the course or the free workshop would serve you better right now, I will say that instead. You do not need to decide anything on the call.

Pick a time that suits you: {{custom_values.call_booking_link}}

Once you book, you get a confirmation email with the details and a reminder the day before.

${devonSign}`;

const followUpBody = `Hi {{contact.first_name}},

I don't see a strategy call on the calendar yet, so here is the link again in case my first email got buried: {{custom_values.call_booking_link}}

If none of those times work, reply with two or three that do and I'll set it up for you. And if now isn't the right time, just say so and I'll close out your application. You can apply again whenever you're ready.

${devonSign}`;

const courseFirstBody = `Hi {{contact.first_name}},

Thank you for applying for {{custom_values.coaching_name}}, and for being straight about your timeline, your hours and your budget.

Based on those answers, 1:1 coaching isn't the right first step for you yet. That is about timing, not about you. Coaching works best with a few hours every week, a move you want to make in the next few months and room in the budget for it, and from your answers at least one of those isn't in place yet.

What I would suggest instead is {{custom_values.course_name}}: the skills inventory, the 90-day plan and the templates, to work through on your own schedule. It is {{custom_values.course_price}}, or {{custom_values.payment_plan}}, with a {{custom_values.refund_policy}}.

Enroll here: {{trigger_link.checkout}}

If you would rather not spend anything right now, the free workshop runs every Thursday at 7 PM Central: {{location.website}}/pivot-plan

When things change, apply again and your new answers are looked at fresh: {{trigger_link.apply}}

If these answers don't describe your situation, reply and tell me. A person reads every reply.

{{custom_values.founder_first_name}}${footer}`;

const keepGoingBody = `Hi {{contact.first_name}},

Thank you for applying for {{custom_values.coaching_name}}.

You already have {{custom_values.course_name}}, and based on your answers, the most useful next step is to put its 90-day plan to work before adding coaching. If you are still working through the lessons, pick up where you left off: {{custom_values.course_login}}

When your timeline, hours or budget change, apply again and your new answers are looked at fresh: {{trigger_link.apply}}

Stuck on a module? Reply to this email and our student success team will help.

{{custom_values.founder_first_name}}${footer}`;

const setupSheet = `Coaching Application            Sites › Surveys
  Slides        One question per slide, built by hand (not One Question at
                a Time, so slide 2 can also hold a hidden text block).
                Progress bar on. Sticky Contact on, in Survey Settings.
  Questions     Name, email, phone          standard fields
                Where are you now?          Current Role          current_role
                What help do you want?      Help Wanted           help_wanted
                  + Text element, hidden until rule 1 shows it:
                    "We coach people through a career change. We don't
                    place people in jobs, and nobody can promise a job
                    offer. The free workshop is a good place to start:
                    trailheadcareers.example/pivot-plan"
                When do you want to move?   Pivot Timeline        pivot_timeline
                Hours a week for this       Weekly Hours          weekly_hours
                Budget for coaching         Coaching Budget       coaching_budget
                Two or three sentences      Pivot Story           pivot_story
                Texts about my application  SMS consent (offers)  sms_marketing_consent
                                            unticked, optional
  Conditional Logic (v2), both on Help Wanted Is Equal To
  "A recruiter to find me a job":
                1  Show/Hide Fields   show the Text element above
                2  Disqualify Lead
                GHL runs only the first matching Redirect, Display Message
                or Disqualify rule, so the explanation is a Show/Hide rule,
                which always evaluates, not a second message rule.
  Snapshots     Conditional Logic rules are not included in snapshots, and
                v2 only exists on new or cloned surveys. Rebuild both rules
                in any account this survey is copied to.

05 trigger      Survey Submitted
                  Survey is Coaching Application
                  Disqualified is false

05a · Sales · Strategy Call Booked
  Trigger 1     Appointment Status
                  In Calendar: Strategy Call, Appointment Status: New
  Trigger 2     Appointment Status
                  In Calendar: Strategy Call, Appointment Status: Confirmed
  Action        Add Contact Tag: call-booked
  Why           Appointment Status also fires when Devon books the call for
                them. Customer Booked Appointment only fires when the contact
                books it themselves. A calendar can book straight into
                Confirmed, so trigger 2 covers that; a later confirmation
                adds a tag that is already there.

The waits in 05 that read the tag
  Booked within 2 days?     Specific conditions to be met
                            Contact Tag includes call-booked, Timeout 2 days
  Booked after the nudge?   Same condition, Timeout 7 days`;

export const application: Automation = {
  id: 'application',
  number: '05',
  name: 'Coaching application',
  kicker: 'Sales',
  tagline:
    'Every application is scored the moment it arrives. Ready applicants get Devon and a booking link within the minute, and everyone else gets an honest recommendation instead of a sales call.',
  problem:
    'Coaching applications landed in Morgan’s inbox and waited for her to forward them to Devon. Good applicants sometimes heard nothing for three days. People who were clearly not ready still got a sales call, which wasted their evening and Devon’s, and nobody could say who had booked a call and who had gone quiet.',
  evidence: {
    text: 'HighLevel’s article on the trigger lists two filters, Survey is and Disqualified (“is true or is false”), and answers “Can I use logic based on survey answers?” with: “While this trigger doesn’t directly evaluate answers, you can use custom fields or tags applied via survey to build logic.”',
    source: 'HighLevel Help Center, “Workflow Trigger - Survey Submitted”',
    href: 'https://help.gohighlevel.com/support/solutions/articles/155000003259-workflow-trigger-survey-submitted',
  },
  solution:
    'The survey handles the one hard no itself, with a Disqualify Lead rule, and the trigger’s Disqualified filter keeps those submissions out. Everything else is scored 0 to 100 by a Custom Code step from four answers. At 70 or more the card moves to Applied, Devon becomes the owner and gets the answers by email, and the applicant gets the booking link by email, and by text if they agreed to texts about offers. A booked Strategy Call moves the card to Call Booked. No booking in two days gives Devon a task and sends a personal follow-up. Under 70, the applicant gets a kind email that recommends the course first, or tells a current student to keep going, and says how to apply again.',
  workflow: {
    name: '05 · Sales · Coaching Application',
    folder: 'Sales',
    triggers: [{ title: 'Survey Submitted', filters: ['Survey is Coaching Application', 'Disqualified is false'], label: 'Survey Submitted (coaching application)' }],
    settings: {
      allowReEntry: true,
      stopOnResponse: false,
      timezone: 'contact',
      senderName: 'Devon Brooks',
      notes: [
        'Allow Re-entry on: someone who is "not a fit yet" can apply again after the course, and the new answers are scored fresh. GHL does not let a contact re-enter while still active, so a second submit during the follow-up starts nothing; the new answers still land on the record for Devon.',
        'Stop on Response off: a reply is usually a question about the call ("is this a sales pitch?"), and the booking still has to be tracked afterwards. Replies land in Devon’s Conversations inbox because he owns the contact, and the follow-up email still reads fine after a conversation. STOP still switches on SMS DND by itself.',
        'Timezone: Contact Timezone. The texting-hours and weekday-hours windows use the applicant’s time zone. A contact with no time zone falls back to the account’s, Central.',
        'No workflow Time Window: the invitation email should reach the applicant while they are still on the thank-you page, day or night. Only the text waits, behind its own Advance Window.',
        'Sender Details: From Name Devon Brooks, From Email devon@trailheadcareers.example. The two "not yet" emails set From Name Morgan Hale and From Email morgan@trailheadcareers.example on the step, because they are not a sales conversation. Every email to the applicant ends with the postal address, and the sub-account’s unsubscribe link (on by default in Business Profile › General) stays on.',
        'Allow Multiple Opportunities per Contact is on in Sub-Account Settings › Objects › Opportunities, so a student’s Won course card and a coaching card can sit in Enrollment together. The workflow’s own Allow multiple Opportunities toggle is left alone: it only matters for opportunity triggers.',
        'Custom Code is a premium action, so every application adds one billed execution.',
      ],
    },
    steps: [
      {
        id: 'clear-tags',
        kind: 'action',
        action: 'remove_tag',
        title: 'Remove Contact Tag',
        label: 'Clear the last application',
        summary: 'Removes call-booked, not-a-fit-yet and applied-no-call left by an earlier application, so the booking wait below only sees a call booked for this one.',
        effect: { removeTags: ['call-booked', 'not-a-fit-yet', 'applied-no-call'] },
      },
      {
        id: 'score',
        kind: 'action',
        action: 'custom_code',
        title: 'Custom Code',
        label: 'Readiness score',
        summary: 'Scores readiness 0 to 100 from timeline, weekly hours, budget and current role. A budget under $500 or "Just exploring" caps the score at 60.',
        run: ({ contact }) => {
          const r = readiness(contact);
          const parts = `timeline ${r.parts.timeline}, hours ${r.parts.hours}, budget ${r.parts.budget}, role ${r.parts.role}`;
          return {
            vars: { application_score: r.score, capped: !!r.reason },
            log: r.reason
              ? `Returned application_score ${r.score}: the answers add up to ${r.sum} (${parts}), capped at ${CAP} because ${r.reason}.`
              : `Returned application_score ${r.score} (${parts}).`,
          };
        },
        code: { language: 'javascript', source: scoreCode },
      },
      {
        id: 'save-score',
        kind: 'action',
        action: 'update_field',
        title: 'Update Contact Field',
        label: 'Save the score',
        summary: 'Application Score = the code output, so the If/Else, the notification, Smart Lists and 06 all read the same number.',
        run: ({ vars }) => ({ effect: { fields: { application_score: vars.application_score } }, log: `Application Score is now ${vars.application_score}.` }),
      },
      {
        id: 'if-score',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Ready for 1:1?',
        branches: [
          {
            label: '70 or more',
            when: { type: 'field', key: 'application_score', op: 'gte', value: 70, label: 'Application Score is greater than or equal to 70' },
            nodes: [
              {
                id: 'assign',
                kind: 'action',
                action: 'assign_user',
                title: 'Assign To User',
                label: 'Devon',
                summary:
                  'Devon Brooks, the enrollment advisor. Only Apply to Unassigned Contacts is off on purpose: a current student owned by Jules moves to Devon for the sales conversation. It runs before the card and the emails, so a new card gets him as owner and the emails come from him.',
                run: ({ contact }) =>
                  contact.assignedTo === 'devon'
                    ? { log: 'Already assigned to Devon Brooks.' }
                    : { effect: { assignTo: 'devon' }, log: `Assigned to Devon Brooks${contact.assignedTo ? `, from ${userName(contact.assignedTo)}` : ''}.` },
              },
              {
                id: 'find-opp',
                kind: 'ifelse',
                title: 'Find Opportunity',
                label: 'Find the open card',
                branches: [
                  {
                    label: 'Opportunity Found',
                    when: { type: 'all', label: 'Latest opportunity with Pipeline is Enrollment and Status is Open', of: [{ type: 'opportunity', status: 'open' }] },
                    nodes: [
                      {
                        id: 'opp-applied',
                        kind: 'action',
                        action: 'update_opportunity',
                        title: 'Update Opportunity',
                        label: 'Applied',
                        summary:
                          'Enrollment › Applied on the card Find Opportunity picked, renamed "{contact name} · 1:1 Pivot Coaching", Opportunity Value 0 until Devon agrees a package on the call. Allow Opportunity to Move to Any Previous Stage stays off, and Status is not touched.',
                        run: toApplied,
                      },
                      {
                        id: 'notify',
                        kind: 'action',
                        action: 'internal_notification',
                        title: 'Internal Notification',
                        label: 'Tell Devon',
                        summary: 'Type Email, To User Type Assigned User. The score, every answer and the applicant’s own words, so Devon can prepare before a time is even picked.',
                        message: {
                          channel: 'internal',
                          to: '{{user.name}} (assigned user)',
                          subject: 'New application: {{contact.name}}, score {{contact.application_score}}',
                          body: '{{contact.first_name}} applied for {{custom_values.coaching_name}} and is getting the booking link by email now.\n\nRole: {{contact.current_role}}\nWants to move: {{contact.pivot_timeline}}\nHours a week: {{contact.weekly_hours}}\nBudget: {{contact.coaching_budget}}\nOK to text about offers: {{contact.sms_marketing_consent}}\n\nIn their words: "{{contact.pivot_story}}"\n\n{{contact.phone}} · {{contact.email}}\nNo call booked in 2 days means a task for you.',
                        },
                      },
                      {
                        id: 'email-invite',
                        kind: 'action',
                        action: 'send_email',
                        title: 'Send Email',
                        label: 'Book your call',
                        summary: 'Straight away, from Devon. What the call covers, that nothing has to be decided on it, the booking link, and no promise about outcomes.',
                        message: {
                          channel: 'email',
                          subject: 'Your {{custom_values.coaching_name}} application: next step',
                          body: inviteBody,
                        },
                      },
                      {
                        id: 'quiet',
                        kind: 'wait',
                        title: 'Wait',
                        label: 'Texting hours',
                        mode: 'time',
                        minutes: 0,
                        window: { start: '08:00', end: '20:00', days: ALL_WEEK },
                        summary: "A set period of time: 0 minutes, with an Advance Window that only resumes between 8 AM and 8 PM in the contact's time zone, so a 10 PM applicant gets the text at 8 AM. It sits before the consent check, so a booking made overnight is seen before any text goes out.",
                      },
                      {
                        id: 'can-text',
                        kind: 'ifelse',
                        title: 'If/Else',
                        label: 'Text them too?',
                        branches: [
                          {
                            label: 'Ticked it this time',
                            when: {
                              type: 'all',
                              label: 'SMS consent (offers) is Yes, Contact Tag includes sms-off-no-consent, and Contact Tag does not include call-booked',
                              of: [
                                { type: 'field', key: 'sms_marketing_consent', op: 'eq', value: 'Yes' },
                                { type: 'tag', has: 'sms-off-no-consent' },
                                { type: 'not', of: { type: 'event', event: 'appointment_booked', value: 'Strategy Call' } },
                              ],
                            },
                            nodes: [
                              {
                                id: 'dnd-off',
                                kind: 'action',
                                action: 'dnd',
                                title: 'Enable/Disable DND',
                                label: 'Texts back on',
                                summary:
                                  'Disable DND, SMS only, direction Outbound. 01 switched texts off when they registered without ticking the reminders box; the tag is its receipt. Ticking the texts box on the application is a new opt-in. Logged as "DND Disabled by Workflows". A STOP never carries the tag, so this never undoes an opt-out.',
                                effect: { dnd: { sms: false } },
                              },
                              {
                                id: 'untag-dnd',
                                kind: 'action',
                                action: 'remove_tag',
                                title: 'Remove Contact Tag',
                                label: 'sms-off-no-consent',
                                summary: 'The receipt is used up, the same way 01 handles it. From now on any SMS DND on this contact is their own.',
                                effect: { removeTags: ['sms-off-no-consent'] },
                              },
                              {
                                id: 'goto-sms',
                                kind: 'goto',
                                title: 'Go To',
                                target: 'sms-invite',
                                summary: 'Onto the text path at the booking-link text, which carries the opt-out line.',
                              },
                            ],
                          },
                          {
                            label: 'Consent, no call yet',
                            when: {
                              type: 'all',
                              label: 'SMS consent (offers) is Yes, not DND for SMS, and Contact Tag does not include call-booked',
                              of: [
                                { type: 'field', key: 'sms_marketing_consent', op: 'eq', value: 'Yes' },
                                { type: 'not', of: { type: 'dnd', channel: 'sms' } },
                                { type: 'not', of: { type: 'event', event: 'appointment_booked', value: 'Strategy Call' } },
                              ],
                            },
                            nodes: [
                              {
                                id: 'sms-invite',
                                kind: 'action',
                                action: 'send_sms',
                                title: 'Send SMS',
                                label: 'Booking link',
                                summary: 'The first text this workflow sends, so it names the business and carries the opt-out line. One link, from Devon’s number.',
                                message: {
                                  channel: 'sms',
                                  body: "Hi {{contact.first_name}}, it's {{user.first_name}} from {{location.name}}. Thanks for applying for 1:1 coaching. Book your 30-min strategy call here: {{custom_values.call_booking_link}} Reply STOP to opt out.",
                                },
                              },
                              {
                                id: 'wait-book',
                                kind: 'wait',
                                title: 'Wait',
                                label: 'Booked within 2 days?',
                                // In GHL this waits for the call-booked tag that 05a adds when a
                                // Strategy Call appointment is created. The simulator runs one
                                // workflow at a time, so it watches the booking itself.
                                mode: 'event',
                                event: 'appointment_booked',
                                value: 'Strategy Call',
                                minutes: 2 * DAY,
                                summary: 'Specific conditions to be met: Contact Tag includes call-booked, which 05a adds the moment a Strategy Call appointment is created, whoever books it. Timeout 2 days.',
                                branches: {
                                  met: {
                                    label: 'Booked',
                                    nodes: [
                                      {
                                        id: 'find-booked',
                                        kind: 'ifelse',
                                        title: 'Find Opportunity',
                                        label: 'Find the card to move',
                                        branches: [
                                          {
                                            label: 'Opportunity Found',
                                            when: { type: 'all', label: 'Latest opportunity with Pipeline is Enrollment and Status is Open', of: [{ type: 'opportunity', status: 'open' }] },
                                            nodes: [
                                              {
                                                id: 'opp-booked',
                                                kind: 'action',
                                                action: 'update_opportunity',
                                                title: 'Update Opportunity',
                                                label: 'Call Booked',
                                                summary: 'Enrollment › Call Booked on the card this Find picked, which is also a card Create Opportunity made earlier in the run. Confirmation and reminders come from the Strategy Call calendar’s own notifications, so this workflow sends nothing more.',
                                                run: toCallBooked,
                                              },
                                            ],
                                          },
                                        ],
                                        otherwise: {
                                          label: 'Opportunity Not Found',
                                          nodes: [
                                            {
                                              id: 'notify-closed',
                                              kind: 'action',
                                              action: 'internal_notification',
                                              title: 'Internal Notification',
                                              label: 'Card is closed',
                                              summary: 'Type Email, To User Type Assigned User. Only reached when Devon has closed the card since the application, usually after a "not now". Nothing is created or reopened automatically: Devon decides whether the call is on.',
                                              message: {
                                                channel: 'internal',
                                                to: '{{user.name}} (assigned user)',
                                                subject: '{{contact.name}} booked a strategy call, but their card is closed',
                                                body: '{{contact.name}} just booked a Strategy Call. Their coaching card in Enrollment is closed, so nothing moved.\n\nThe call is on your calendar. If it goes ahead, reopen the card and move it to Call Booked. If they booked by mistake, cancel it from the calendar.',
                                              },
                                            },
                                          ],
                                        },
                                      },
                                    ],
                                  },
                                  timeout: {
                                    label: 'No call in 2 days',
                                    nodes: [
                                      {
                                        id: 'office-hours',
                                        kind: 'wait',
                                        title: 'Wait',
                                        label: 'Weekday hours',
                                        mode: 'time',
                                        minutes: 0,
                                        window: { start: '09:00', end: '17:00', days: WEEKDAYS },
                                        summary: "A set period of time: 0 minutes, with an Advance Window that only resumes Monday to Friday, 9 AM to 5 PM in the contact's time zone. A personal email from Devon should not arrive at 11 PM on a Sunday.",
                                      },
                                      {
                                        id: 'task-devon',
                                        kind: 'action',
                                        action: 'add_task',
                                        title: 'Add Task',
                                        label: 'Reach out',
                                        summary: 'Assign To Devon Brooks, Due In 1 day, Due Time 11:00 AM, Skip Weekends on. The description carries the score, says to answer any reply first, and says whether texting is allowed.',
                                        run: callTask,
                                      },
                                      {
                                        id: 'email-followup',
                                        kind: 'action',
                                        action: 'send_email',
                                        title: 'Send Email',
                                        label: 'Personal follow-up',
                                        summary: 'Plain text from Devon, no button. It says only what is true (no call on the calendar yet), reads fine after a conversation, and makes "not now" an easy answer.',
                                        message: {
                                          channel: 'email',
                                          subject: 'Your coaching application',
                                          body: followUpBody,
                                        },
                                      },
                                      {
                                        id: 'wait-late',
                                        kind: 'wait',
                                        title: 'Wait',
                                        label: 'Booked after the nudge?',
                                        // Same stand-in as wait-book: GHL waits for the call-booked tag.
                                        mode: 'event',
                                        event: 'appointment_booked',
                                        value: 'Strategy Call',
                                        minutes: 7 * DAY,
                                        summary: 'The same call-booked condition, Timeout 7 days. A booking after the follow-up still moves the card.',
                                        branches: {
                                          met: {
                                            label: 'Booked late',
                                            nodes: [
                                              {
                                                id: 'goto-booked',
                                                kind: 'goto',
                                                title: 'Go To',
                                                target: 'find-booked',
                                                summary: 'The same Find and Update Opportunity as a booking in the first two days.',
                                              },
                                            ],
                                          },
                                          timeout: {
                                            label: 'Still no call',
                                            nodes: [
                                              {
                                                id: 'tag-no-call',
                                                kind: 'action',
                                                action: 'add_tag',
                                                title: 'Add Contact Tag',
                                                label: 'applied-no-call',
                                                summary: 'Qualified, followed up, no call after 9 days. The card stays in Applied; the Smart List for this tag is Devon’s Monday review, where he closes it out or calls.',
                                                effect: { addTags: ['applied-no-call'] },
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
                        ],
                        otherwise: {
                          label: 'Email only',
                          nodes: [
                            {
                              id: 'goto-book',
                              kind: 'goto',
                              title: 'Go To',
                              target: 'wait-book',
                              summary: 'No consent to texts about offers, SMS DND of their own, or a call already booked: straight to the booking wait. From here the path is the same, minus the text.',
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
                      label: 'Applied',
                      summary:
                        'Enrollment › Applied, named "{contact name} · 1:1 Pivot Coaching", value 0, status Open, Duplicate Opportunity on. Only reached when there is no open card: no card at all, or a closed one such as a student’s Won course sale, which stays as it is.',
                      run: ({ contact }) => {
                        const prev = contact.opportunity;
                        const name = `${contact.firstName} ${contact.lastName} · ${COACHING}`;
                        return {
                          effect: { opportunity: { pipeline: 'Enrollment', stage: 'Applied', status: 'open', value: 0, name } },
                          log: `New card "${name}" in Enrollment › Applied.${prev ? ` The ${prev.stage} card (${prev.status}) stays as it is, so the course sale still counts as ${prev.status}.` : ''}`,
                        };
                      },
                    },
                    {
                      id: 'goto-notify',
                      kind: 'goto',
                      title: 'Go To',
                      target: 'notify',
                      summary:
                        'Joins the main path at Tell Devon, past the Applied update. Not back through Find: a created card is not in context for later updates, so the booking branch runs its own Find, and this path can never loop.',
                    },
                  ],
                },
              },
            ],
          },
        ],
        otherwise: {
          label: 'Under 70: not yet',
          nodes: [
            {
              id: 'tag-not-yet',
              kind: 'action',
              action: 'add_tag',
              title: 'Add Contact Tag',
              label: 'not-a-fit-yet',
              summary: 'For reporting: Morgan and Devon look at the "not yet" list each month to check that the line at 70 is in the right place. The card is not touched and nobody is assigned.',
              effect: { addTags: ['not-a-fit-yet'] },
            },
            {
              id: 'is-student',
              kind: 'ifelse',
              title: 'If/Else',
              label: 'Already a student?',
              branches: [
                {
                  label: 'Student',
                  when: { type: 'field', key: 'purchase', op: 'not_empty', label: 'Purchase is not empty' },
                  nodes: [
                    {
                      id: 'stop-06',
                      kind: 'action',
                      action: 'remove_from_workflow',
                      title: 'Remove from Workflow',
                      label: 'Stop 06',
                      summary:
                        'Another Workflow: 06 · Students · Completion, Testimonial and Upgrade. A graduate who applies on their own and scores under 70 would otherwise get this "not yet" and 06’s coaching invitation days apart. For a student who is not in 06, it does nothing.',
                      run: ({ contact }) => ({
                        log:
                          contact.fields.course_progress === 'Completed'
                            ? 'Removed from 06, so no coaching invitation follows this "not yet".'
                            : `Not in 06: Course Progress is ${contact.fields.course_progress ?? 'empty'}, so there is nothing to stop. 06 starts when they finish, which is when an invitation to apply again makes sense.`,
                      }),
                    },
                    {
                      id: 'email-student',
                      kind: 'action',
                      action: 'send_email',
                      title: 'Send Email',
                      label: 'Keep going',
                      summary: 'From Morgan. No pitch for a course they already own: put the 90-day plan to work, their login if they are mid-course, and how to apply again.',
                      message: {
                        channel: 'email',
                        subject: 'About your coaching application',
                        body: keepGoingBody,
                      },
                    },
                  ],
                },
              ],
              otherwise: {
                label: 'Not a student',
                nodes: [
                  {
                    id: 'email-course',
                    kind: 'action',
                    action: 'send_email',
                    title: 'Send Email',
                    label: 'The course first',
                    summary: 'From Morgan. A plain "not yet" with the reason, the course with its price and refund policy, the free workshop, and the Apply link for later. No outcome or income promises.',
                    message: {
                      channel: 'email',
                      subject: 'About your coaching application',
                      body: courseFirstBody,
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
  scenarios: [
    {
      id: 'books',
      label: 'Strong applicant books',
      summary: 'Went to last Thursday’s workshop, applies on a Tuesday lunch break with texts ticked, and books a Thursday call from the link 25 minutes later.',
      start: at(1, 12, 35),
      contact: registrant('Attended', ['workshop-attended'], {
        role: 'Manager',
        timeline: 'In the next 3 months',
        hours: '5-8 hours',
        budget: '$1,500-$3,000',
        texts: 'Yes',
        story: 'Eight years running store operations. I want to move into supply chain planning without starting over at entry level.',
      }, { goal: 'A new industry', attended: 'Yes' }),
      events: [{ at: 25, type: 'appointment_booked', value: 'Strategy Call', appointmentAt: at(3, 10) - at(1, 12, 35), label: 'Strategy Call, Thursday 10:00 AM, from the link in the text' }],
      expect: {
        outcome: 'completed',
        visits: ['clear-tags', 'if-score:0', 'assign', 'find-opp:0', 'opp-applied', 'notify', 'email-invite', 'quiet', 'can-text:1', 'sms-invite', 'wait-book:met', 'find-booked:0', 'opp-booked'],
        stage: 'Call Booked',
      },
    },
    {
      id: 'no-booking',
      label: 'Strong applicant never books',
      summary:
        'Registered without ticking reminder texts, so 01 switched texts off. Ticks the texts box on the application at 10:10 PM on a Friday: texts come back on at 8 AM with the first one. Asks about the call on Saturday, never books, and gets Devon’s follow-up on Monday.',
      start: at(4, 22, 10),
      contact: registrant(
        'Attended',
        ['workshop-replay', 'sms-off-no-consent'],
        {
          role: 'Individual contributor',
          timeline: '3-6 months',
          hours: 'More than 8 hours',
          budget: '$1,500-$3,000',
          texts: 'Yes',
          story: 'I am a nurse and want to move into health tech product work. I have the evenings but no idea how to explain my experience.',
        },
        { goal: 'A new role', attended: 'No', sms_consent: 'No' },
        { sms: true },
      ),
      events: [
        {
          at: at(5, 9, 14) - at(4, 22, 10),
          type: 'reply',
          value: 'Before I book: is the call a sales pitch? And roughly what does coaching cost?',
          label: 'Stop on Response is off, so the run carries on. Devon answers from Conversations.',
        },
      ],
      expect: {
        outcome: 'completed',
        visits: ['quiet', 'can-text:0', 'dnd-off', 'untag-dnd', 'goto-sms', 'sms-invite', 'wait-book:timeout', 'office-hours', 'task-devon', 'email-followup', 'wait-late:timeout', 'tag-no-call'],
        tags: ['applied-no-call'],
        stage: 'Applied',
      },
    },
    {
      id: 'not-a-fit',
      label: 'Not a fit yet: budget under $500',
      summary: 'Applies from the offer email right after Thursday’s workshop. Ready to move and has the time, but a budget under $500. Without the cap the answers would score exactly 70.',
      start: at(3, 20, 31),
      contact: registrant('Attended', ['workshop-attended'], {
        role: 'Manager',
        timeline: 'In the next 3 months',
        hours: 'More than 8 hours',
        budget: 'Under $500',
        texts: 'No',
        story: 'Teacher for eleven years, ready to leave the classroom this summer for instructional design.',
      }, { goal: 'A new role', attended: 'Yes' }),
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['if-score:else', 'tag-not-yet', 'is-student:else', 'email-course'],
        tags: ['not-a-fit-yet'],
        stage: 'Attended',
      },
    },
    {
      id: 'student-reapplies',
      label: 'Student says not now, then books',
      summary:
        'Got "not yet" in January, bought the course and applies again on a Sunday afternoon without ticking texts. Answers Tuesday’s follow-up with "not this month", so Devon closes the card, then books a call on Thursday night after all.',
      start: at(6, 15, 20),
      contact: student(['not-a-fit-yet'], {
        role: 'Senior leader',
        timeline: '3-6 months',
        hours: '5-8 hours',
        budget: 'Over $3,000',
        texts: 'No',
        story: 'Finished the 90-day plan. I know I want to move from finance leadership into climate nonprofits and want help with the move itself.',
      }, 'Skills inventory done'),
      events: [
        {
          at: at(8, 18, 40) - at(6, 15, 20),
          type: 'reply',
          channel: 'email',
          value: "Thanks Devon. Month-end close has me buried, so let's leave it for now.",
          label: 'Reply by email. Stop on Response is off, so the run carries on.',
        },
        { at: at(9, 9, 15) - at(6, 15, 20), type: 'opportunity_lost', label: 'Devon closes the coaching card as Lost, as his email offered' },
        {
          at: at(10, 21, 5) - at(6, 15, 20),
          type: 'appointment_booked',
          value: 'Strategy Call',
          appointmentAt: at(15, 12, 30) - at(6, 15, 20),
          label: 'Strategy Call, Tuesday 12:30 PM, from the link in the follow-up email',
        },
      ],
      expect: {
        outcome: 'completed',
        visits: ['clear-tags', 'assign', 'find-opp:else', 'create-opp', 'goto-notify', 'notify', 'email-invite', 'can-text:else', 'goto-book', 'wait-book:timeout', 'task-devon', 'email-followup', 'wait-late:met', 'goto-booked', 'find-booked:else', 'notify-closed'],
        stage: 'Applied',
      },
    },
    {
      id: 'student-not-yet',
      label: 'Student, not a fit yet',
      summary: 'A current student applies on a Wednesday morning with little time and a small budget. Gets "keep going with the course", not a pitch for it.',
      start: at(2, 7, 45),
      contact: student([], {
        role: 'Individual contributor',
        timeline: '6-12 months',
        hours: 'Under 2 hours',
        budget: '$500-$1,500',
        texts: 'No',
        story: 'Halfway through the course. Thinking about UX research but not sure yet.',
      }, 'Started'),
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['if-score:else', 'tag-not-yet', 'is-student:0', 'stop-06', 'email-student'],
        tags: ['not-a-fit-yet'],
        stage: 'Customer',
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Current Role', key: 'current_role', type: 'Dropdown (single)', note: 'Individual contributor · Manager · Senior leader · Between roles. The same field the workshop form fills' },
      { name: 'Help Wanted', key: 'help_wanted', type: 'Dropdown (single)', note: 'Coaching through a career change · A recruiter to find me a job (disqualified in the survey)' },
      { name: 'Pivot Timeline', key: 'pivot_timeline', type: 'Dropdown (single)', note: 'In the next 3 months · 3-6 months · 6-12 months · Just exploring' },
      { name: 'Weekly Hours', key: 'weekly_hours', type: 'Dropdown (single)', note: 'Under 2 hours · 2-4 hours · 5-8 hours · More than 8 hours' },
      { name: 'Coaching Budget', key: 'coaching_budget', type: 'Dropdown (single)', note: 'Under $500 · $500-$1,500 · $1,500-$3,000 · Over $3,000' },
      { name: 'Pivot Story', key: 'pivot_story', type: 'Multi line', note: 'In their words. Not scored: Devon reads it before the call' },
      { name: 'SMS consent (offers)', key: 'sms_marketing_consent', type: 'Checkbox', note: 'The workshop form’s offers box and the survey’s texts box both write here. A text inviting someone to a sales call is marketing, so this is the only consent the booking text reads' },
      { name: 'Application Score', key: 'application_score', type: 'Number', note: 'Written by the Custom Code step, 0 to 100. 06 reads it too' },
    ],
    tags: [
      { name: 'not-a-fit-yet', note: 'Scored under 70 and got a "not yet" email. Cleared when they apply again' },
      { name: 'call-booked', note: 'Added by 05a when a Strategy Call is created. The If/Else and the waits read it, and each new application clears it' },
      { name: 'applied-no-call', note: 'Qualified, followed up, still no call after 9 days' },
      { name: 'sms-off-no-consent', note: 'From 01: it switched texts off for lack of consent. 05 removes it, and turns texts back on, only when the applicant ticks the texts box' },
    ],
    pipeline: business.pipeline,
    customValues: [
      { name: 'Coaching Name', key: 'coaching_name', value: '1:1 Pivot Coaching' },
      { name: 'Call Booking Link', key: 'call_booking_link', value: 'trailheadcareers.example/strategy-call' },
      { name: 'Course Price', key: 'course_price', value: '$497' },
      { name: 'Payment Plan', key: 'payment_plan', value: '3 payments of $179' },
      { name: 'Refund Policy', key: 'refund_policy', value: '14-day money-back guarantee' },
      { name: 'Founder First Name', key: 'founder_first_name', value: 'Morgan' },
    ],
  },
  build: [
    {
      title: 'Agree what "ready" means',
      body: 'Before building, I sat down with Morgan and Devon and turned "a good fit for 1:1" into four questions and a line: timeline, hours a week, budget and current role, weighted 30, 25, 30 and 15, with 70 as the line. Two answers cap the score at 60 whatever else they say: a budget under $500, because the $497 course fits it better, and "Just exploring", because coaching needs a decision to move. Only one answer is a hard no, wanting a recruiter, and the survey handles it. Everyone else gets a real reply, and nothing anywhere promises a job, a salary or a timeline.',
    },
    {
      title: 'The survey, with its own Disqualify rule',
      body: 'One question per slide in Sites › Surveys, each mapped to a custom field whose dropdown options are spelled exactly as the scoring code compares them. Current Role is the same field the workshop form fills, and Sticky Contact pre-fills name, email and phone for anyone who registered from the same browser. On the recruiter answer, a Show/Hide rule reveals a short explanation on the same slide and a Disqualify Lead rule marks the submission. I did not use Display Custom Message for the explanation: GHL runs only the first matching Redirect, Display Message or Disqualify rule. The last question is an unticked, optional texts box that writes to SMS consent (offers).',
    },
    {
      title: 'A trigger with both filters',
      body: 'Survey Submitted with Survey is Coaching Application and Disqualified is false. Without the second filter, a submission the survey disqualified would still start this workflow and get a sales email. The trigger does not read answers, so everything after it reads the custom fields the survey wrote.',
    },
    {
      title: 'Score with Custom Code, branch on a field',
      body: 'Four properties go in through inputData and the score comes out through output. GHL only makes a Custom Code output available to later steps after a successful test, so I tested it in Test Setup with answer sets that should land at 65, 70 and 75, and with a capped set. Update Contact Field writes the score to Application Score, and the If/Else reads that field, so the number Devon sees and the number that routed the applicant are the same number.',
    },
    {
      title: 'Find the card, and never loop back to Find',
      body: 'Assign To User runs first, so a new card gets Devon as owner. Find Opportunity (Latest, Pipeline is Enrollment, Status is Open) picks up a registrant’s workshop card and Update Opportunity moves it to Applied. A student’s course card is Won, so Find comes back empty and Create Opportunity adds a coaching card at Applied, with Duplicate Opportunity on. A created card is not in context for later updates, but I do not send the contact back through the same Find: if Create ever failed, that Go To would loop. The booking branch runs its own Find instead, which also notices a card Devon has closed in the meantime.',
    },
    {
      title: 'Invite by email, text only with the right consent',
      body: 'The email goes out at once, from Devon. The text waits for an 8 AM to 8 PM Advance Window, then checks SMS consent (offers), SMS DND and whether a call is already booked. The workshop-reminder box does not count: a text inviting someone to a sales call is marketing. 01 switches SMS DND on for registrants who skipped the reminders box and tags them sms-off-no-consent, so an applicant who ticks the texts box now gets DND turned off first, only when that tag shows the DND was ours. The Strategy Call calendar sends the confirmation and reminder by email; its SMS notifications stay off, because they do not read the consent field.',
    },
    {
      title: 'Watch for the booking with a helper',
      body: 'A Wait can hold until a time relative to an appointment that already exists, but it cannot wait for one to be booked, and the If/Else appointment filters only appear in appointment-triggered workflows. So a one-step helper, 05a · Sales · Strategy Call Booked, adds call-booked on Appointment Status for the Strategy Call calendar, status New or Confirmed, which also covers calls Devon books by hand. A Goal Event on Appointment Status could catch the booking, but the If/Else before the text could not read it; the tag serves both. The waits are Specific conditions to be met on that tag: 2 days, then a task and a personal email from Devon inside weekday hours, then 7 more days so a late booking still moves the card.',
    },
    {
      title: 'Test, publish, hand off',
      body: 'Five test contacts, one per scenario above, plus one that picks the recruiter answer, checked against Execution Logs, Enrollment History and the pipeline board. Then a Loom for Devon: where applications show up, what the score means, how to overrule it, and what the "card is closed" email asks of him. If he thinks a "not yet" deserves a call, he books it himself, and 05a tags it like any other booking.',
    },
  ],
  edgeCases: [
    {
      title: 'Wants a recruiter, not a coach',
      body: 'Picking "A recruiter to find me a job" shows a short explanation on the same slide: Trailhead does not place people in jobs, nobody can promise a job offer, and the free workshop is a good start. The Disqualify Lead rule marks the submission, and the trigger’s Disqualified is false filter keeps it out of 05, so there is no card, no owner and no sales email.',
    },
    {
      title: 'Strong on paper, budget under $500',
      body: 'Timeline, hours and role can add up to exactly 70 on their own. The cap holds the score at 60, so they get the course-first email with its $497 price, the payment plan and the refund policy, instead of a call about coaching they said they cannot afford.',
    },
    {
      title: 'Applies at 10 PM',
      body: 'The invitation email and Devon’s notification go out straight away. The text waits for 8 AM in their time zone, and if they booked from the email overnight, the call-booked tag is already there, so no "book your call" text goes out and the condition wait releases at once. The two-day follow-up only lands between 9 AM and 5 PM on a weekday.',
    },
    {
      title: 'Books by message, not by the link',
      body: 'They reply "can we do Tuesday at 4?" and Devon books it from the calendar. Customer Booked Appointment would miss that, because it only fires when the contact books. Appointment Status fires for any booking, and 05a listens for both New and Confirmed, so the tag lands whether or not the calendar confirms bookings on its own.',
    },
    {
      title: 'No reminder texts, yes to application texts',
      body: '01 switched SMS DND on when they registered without ticking the reminders box, and tagged sms-off-no-consent as the receipt. Ticking the texts box on the application is a new opt-in, so 05 turns DND off and removes the tag right before the first text. Someone who replied STOP has DND without that tag, so their opt-out stands and they get email only.',
    },
    {
      title: 'A current student or a graduate applies',
      body: 'Their course card is Won, so Find Opportunity finds no open card and Create Opportunity adds a second card for the coaching deal; the course sale stays Won in revenue reports. Ownership moves from Jules to Devon for the sales conversation. Under 70 they get "put the plan to work", not an offer for a course they own, and Remove from Workflow takes a graduate out of 06, so no coaching invitation lands days after the "not yet".',
    },
  ],
  qa: [
    'Score check: test answer sets that should land at 65, 70 and 75 give exactly those numbers in Execution Logs and route to not yet, call and call. A capped set shows 60',
    'Pick the recruiter answer: the explanation appears on the slide, the submission is marked disqualified, and Enrollment History for 05 has no entry',
    'Qualified with SMS consent (offers) at 2 PM: card in Applied named "... · 1:1 Pivot Coaching" with Devon as owner, notification email with every answer, invitation email, and a text with the opt-out line that stays within two segments with an 11-letter first name and the real booking URL',
    'A registrant 01 switched texts off, who ticks the texts box at 10 PM: the text waits in Execution Logs until 8 AM, then the log shows DND Disabled by Workflows and sms-off-no-consent removed before it sends. A contact who texted STOP gets email only',
    'Book through the link, have Devon book another test contact by hand, and book a third on a copy of the calendar that confirms bookings: all three get call-booked from 05a and all three cards move to Call Booked',
    'Do not book: two days later, inside weekday hours, Devon has a task due the next weekday at 11 AM and the follow-up email is in Conversations. After 9 days, applied-no-call is on the contact. Close a test card as Lost, then book: Devon gets the "card is closed" email and nothing moves',
    'Student test contact: two cards in Enrollment, the course card still Won in Customer and the new one in Applied, and Execution Logs show Find Opportunity once before the booking. A graduate under 70 shows Remove from Workflow in 06’s Enrollment History',
    'Every merge field renders in Gmail, Outlook and on a phone, each email ends with the postal address and the unsubscribe link, and Morgan signs off all four emails for tone and for no outcome or income claims',
  ],
  snippets: [
    { title: 'Readiness score (Custom Code step)', language: 'javascript', code: scoreCode, note: 'Properties are added in the step and read as inputData.<key>. The object assigned to output becomes the step output; Update Contact Field maps application_score to the Application Score field.' },
    { title: 'Survey, trigger and the 05a helper', language: 'text', code: setupSheet, note: 'Goes in the SOP with the scoring table, so the survey, the trigger filters and the helper can be rebuilt or audited without opening each one.' },
    {
      title: 'Texts box on the application',
      language: 'text',
      code: 'Text me about my application and strategy call, and about future workshops and offers, from Trailhead Career Coaching. Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out. Consent is not a condition of purchase.',
      note: 'Unticked by default and not required to submit. It writes to SMS consent (offers), the same field as the workshop form’s offers box, so the wording covers everything that field allows. The same wording goes in the A2P campaign registration.',
    },
  ],
  features: [
    'Survey Submitted',
    'Survey Conditional Logic · Show/Hide Fields, Disqualify Lead',
    'Remove Contact Tag',
    'Custom Code',
    'Update Contact Field',
    'If/Else',
    'Assign To User',
    'Find Opportunity',
    'Update Opportunity',
    'Create Opportunity',
    'Go To',
    'Internal Notification',
    'Send Email',
    'Wait · Advance Window',
    'Enable/Disable DND',
    'Send SMS',
    'Wait · Specific conditions to be met',
    'Add Task',
    'Add Contact Tag',
    'Remove from Workflow',
    'Appointment Status',
    'Allow Re-entry',
  ],
};
