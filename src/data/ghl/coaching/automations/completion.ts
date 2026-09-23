import type { Automation, Contact, RunContext } from '@/lib/ghl/types';

const DAY = 1440;
const WEEKDAYS = [0, 1, 2, 3, 4];

/** Minutes after Monday 00:00 of the sample week (Mon Mar 2 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** Tags 03 · Course Onboarding leaves on a student who needed a push. A graduate should not stay on those lists. */
const STALL_TAGS = ['course-stalled', 'course-not-started'];

/**
 * A student who came through the workshop and bought the course: 03 made
 * Jules the owner, won the card at Customer and walked Course Progress up to
 * "Skills inventory done". The rest of the course is what they just finished.
 */
const graduate = (fields: Contact['fields'], tags: string[], extra: Partial<Contact> = {}): Partial<Contact> => ({
  assignedTo: 'jules',
  opportunity: { pipeline: 'Enrollment', stage: 'Customer', status: 'won', value: 497 },
  tags: ['course-started', 'skills-inventory-done', ...tags],
  ...extra,
  fields: { purchase: 'Career Pivot Blueprint', payment_plan: 'No', sms_consent: 'Yes', course_progress: 'Skills inventory done', ...fields },
});

function recordCompletion({ contact }: RunContext) {
  const before = contact.fields.course_progress;
  return {
    effect: { fields: { course_progress: 'Completed' } },
    log: before ? `Course Progress was ${before}, now Completed.` : 'Course Progress is now Completed.',
  };
}

function clearStallTags({ contact }: RunContext) {
  const had = STALL_TAGS.filter((t) => contact.tags.includes(t));
  return {
    effect: { removeTags: STALL_TAGS },
    log: had.length
      ? `Removed ${had.join(' and ')}, so Jules’s follow-up list no longer shows a student who has finished.`
      : 'Neither tag is on the record, so there is nothing to remove.',
  };
}

const congratsSubject = 'You finished {{custom_values.course_name}}, {{contact.first_name}}';

const congratsBody = `Hi {{contact.first_name}},

You just finished {{custom_values.course_name}}. Congratulations. Most of this course happens away from the screen, in the skills inventory, the conversations with people in your new field and your 90-day plan, so finishing it means you did the work, not just the watching.

Your certificate comes in a separate email from our course portal. The lessons and templates stay in the portal whenever you want them: {{custom_values.course_login}}

One suggestion for this week: put the first three steps of your 90-day plan in your calendar, with dates. A plan is much easier to follow once it has dates on it.

If anything in the course did not work for you, reply and tell me. Jules and I read every reply.

{{custom_values.founder_first_name}}`;

const storySubject = 'How did the course go, {{contact.first_name}}?';

const storyBody = `Hi {{contact.first_name}},

Now that you have finished {{custom_values.course_name}}, would you tell us how it went? A few short questions, about five minutes:

{{custom_values.testimonial_link}}

We ask everyone who finishes, and we want the honest version. If something fell short, there is a box for that, and only our team sees it.

The form also asks whether we may quote you and how to show your name. Nothing is published without that yes, we never change what you meant, and you can ask us to take it down at any time.

There is no gift or discount for answering, and nothing changes for you if you skip it.

Thank you,
{{custom_values.founder_first_name}}`;

const inviteSubject = 'If you want help with your plan: {{custom_values.coaching_name}}';

const inviteBody = `Hi {{contact.first_name}},

You finished {{custom_values.course_name}} with a 90-day plan. The course is built so you can carry that plan out on your own.

Some people want a second person in it with them. That is what {{custom_values.coaching_name}} is: working with me one to one on your plan, on how you tell your story to the new field, and on the conversations that come out of it.

It is by application, so we can both check it is a fit before anyone pays anything. The application takes about ten minutes:

{{trigger_link.apply}}

Devon Brooks, our enrollment advisor, reads every application. If it looks like a fit, the next step is a strategy call. If it does not, Devon will say so and suggest what might fit better.

There is no deadline and no discount to rush for. If now is not the time, the application will still be there.

{{custom_values.founder_first_name}}`;

const storyForm = `Student Story form (Sites > Forms), linked from the Testimonial Link custom value

1  What were you doing before the course, and what did you want to change?   Paragraph
2  What did you do in the course that made the biggest difference?           Paragraph
3  Where are you now?                                                         Paragraph
4  Anything that did not work for you? Only our team sees this.              Paragraph
5  May we quote your answers to 1 to 3 on our website and in emails?         Checkbox, unticked, optional
6  If yes, show my name as                                                    First name and last initial /
                                                                              First name only / No name
7  Do you know anyone at Trailhead personally, or have we ever paid           Yes / No
   or given you anything?

Under the permission box:
"We may shorten your words for length, but we will never change what
you meant, and we will send you the final version before it goes
anywhere. To take it down later, reply to any of our emails."

The same form goes to every graduate. Nothing in workflow 06 reads
the answers, so the coaching invitation never depends on them.`;

const publishRules = `Before a student story goes on a page or in an email

[ ] Question 5 ticked, and the name shown the way they chose
[ ] Trimmed for length only; the student approved the final wording
[ ] No salary, raise, job offer at a named company or "hired in 30 days".
    A featured result reads as what buyers can expect, and Trailhead
    cannot show that most students get it. Take the figure out, or
    leave the story out.
[ ] Any connection is disclosed next to the quote: friend, family,
    employee, affiliate, or anything given in return (question 7)
[ ] Shown under "Student stories", never as if these were all the
    feedback we received
[ ] Answers to question 4 stay with the team and are never published

Why: the FTC Endorsement Guides (16 CFR Part 255) on typical results
and material connections, and the FTC rule on consumer reviews and
testimonials (16 CFR Part 465), in force since October 21, 2024.`;

export const completion: Automation = {
  id: 'completion',
  number: '06',
  name: 'Completion, testimonial and upgrade',
  kicker: 'Students',
  tagline:
    'A graduate gets congratulations the minute they finish, an honest request for their story two days later, and one invitation to coaching, and Devon hears about it the moment they click Apply.',
  problem:
    'Students who finished the course heard nothing. Nobody asked them how it went, so the sales page ran on three quotes from people Morgan already knew. The coaching offer went to workshop attendees but never to the people best placed to use it, students who had just done all the work, and when a graduate did click through to the application, Devon only found out if they submitted it.',
  evidence: {
    text: 'HighLevel’s article on course auto-progression says its settings “are enabled by default”, that with them “Text lessons are marked complete when learners navigate forward to the next lesson”, and: “If your course uses certificates or completion-based workflow triggers, review the full learner flow to confirm completion happens as expected.”',
    source: 'HighLevel Help Center, “Courses: Learner Experience Controls and Lesson Auto-Progression”',
    href: 'https://help.gohighlevel.com/support/solutions/articles/155000008170-courses-learner-experience-controls-and-lesson-auto-progression',
  },
  solution:
    'Finishing the course starts one workflow. In the same minute it records the completion, clears Jules’s stalled tags and sends Morgan’s congratulations. Two days later, on a weekday, every graduate gets the same request for their story: no reward, a private box for what fell short, and nothing published without permission. Five days after that, graduates who have not already applied and are not behind on a payment get one invitation to apply for 1:1 coaching. A click on Apply emails Devon with the context; no click in four days makes them alumni. Anyone on Email DND is left alone, and Jules is told why.',
  workflow: {
    name: '06 · Students · Completion, Testimonial and Upgrade',
    folder: 'Students',
    triggers: [{ title: 'Product Completed', filters: ['Product is any of Career Pivot Blueprint'], label: 'Product Completed (Career Pivot Blueprint)' }],
    settings: {
      allowReEntry: false,
      stopOnResponse: false,
      timezone: 'contact',
      senderName: 'Morgan Hale',
      notes: [
        'Trigger: Product Completed, Product is any of Career Pivot Blueprint. It fires when the whole course is complete, not a module (that is Category Completed) or a lesson. The course keeps its own Course Completion Certificate, which goes out at the same moment, so this workflow never uses Issue Certificate and nobody gets two.',
        'Auto-Complete Lessons is off for this course in its Learner Experience Controls. It is on by default and marks a text lesson complete when the learner moves forward, so clicking Next through the course would count as finishing it and start this workflow for someone who skimmed.',
        'Allow Re-entry off: GHL’s article on the trigger says it activates each time a product is completed. One congratulations, one story request and one invitation per person, even if the trigger fires for them again.',
        'Stop on Response off: replies to these emails are thanks, questions and stories. They land in Conversations for Jules, and the story request and the invitation still make sense after a thank-you.',
        'No workflow Time Window: the congratulations should arrive while they are still looking at the last lesson, even at 11 PM. The two later emails wait for weekday hours with Advance Windows instead, so replies reach Jules and Devon during the working day.',
        'Sender: From Name Morgan Hale, from morgan@trailheadcareers.example. Emails are signed with the Founder First Name custom value, not the assigned user, because the owner is Jules for most graduates and can change after an application.',
      ],
    },
    steps: [
      {
        id: 'progress',
        kind: 'action',
        action: 'update_field',
        title: 'Update Contact Field',
        label: 'Course Progress: Completed',
        summary: 'The last value of the field 03 started (Not started, Started, Skills inventory done). Smart Lists, reporting and Sasha’s notifications in 04 read it.',
        run: recordCompletion,
      },
      {
        id: 'untag',
        kind: 'action',
        action: 'remove_tag',
        title: 'Remove Contact Tag',
        label: 'Stalled tags',
        summary: 'Removes course-stalled and course-not-started from 03, so Jules’s follow-up lists only hold people who still need help.',
        run: clearStallTags,
      },
      {
        id: 'email-congrats',
        kind: 'action',
        action: 'send_email',
        title: 'Send Email',
        label: 'Congratulations',
        summary:
          'From Morgan, the minute they finish. Points to the certificate email and the portal, gives one concrete next step and invites replies. No ask of any kind. GHL skips it on its own for anyone on Email DND.',
        message: { channel: 'email', subject: congratsSubject, body: congratsBody },
      },
      {
        id: 'wait-2d',
        kind: 'wait',
        title: 'Wait',
        label: 'Two days, weekday hours',
        mode: 'time',
        minutes: 2 * DAY,
        window: { start: '09:00', end: '17:00', days: WEEKDAYS },
        summary:
          'A set period of time: 2 days. Advance Window: Resume On Monday to Friday, Resume Between Hours 9:00 AM and 5:00 PM, contact’s time zone. The story request invites replies, and those should reach Jules on a working day.',
      },
      {
        id: 'can-email',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Email DND?',
        branches: [
          {
            label: 'Email DND',
            when: { type: 'all', label: 'Contact has Email DND on', of: [{ type: 'dnd', channel: 'email' }] },
            nodes: [
              {
                id: 'notify-jules',
                kind: 'action',
                action: 'internal_notification',
                title: 'Internal Notification',
                label: 'Tell Jules',
                summary:
                  'Type Notification (in-app), To User Type Assigned User, Redirect Page: the contact. No email or text to the student. Jules decides whether a bounced address is worth asking about.',
                message: {
                  channel: 'internal',
                  to: '{{user.name}} (assigned user)',
                  subject: 'Graduate on Email DND: {{contact.name}}',
                  body: '{{contact.first_name}} finished {{custom_values.course_name}}, but Email DND is on, so no congratulations, story request or coaching invitation went out. If the address bounced, for example after a job change, ask for a new one next time you talk. If they unsubscribed, leave it.',
                },
              },
              {
                id: 'goto-alumni-dnd',
                kind: 'goto',
                title: 'Go To',
                target: 'tag-alumni',
                summary: 'Joins the no-click path at the alumni tag, so one step defines who counts as alumni.',
              },
            ],
          },
        ],
        otherwise: {
          label: 'Email allowed',
          nodes: [
            {
              id: 'email-story',
              kind: 'action',
              action: 'send_email',
              title: 'Send Email',
              label: 'Your story',
              summary:
                'The same request to every graduate, happy or not. Links the Student Story form through the Testimonial Link custom value. No reward, a private box for what fell short, permission and name display asked on the form.',
              message: { channel: 'email', subject: storySubject, body: storyBody },
            },
            {
              id: 'wait-5d',
              kind: 'wait',
              title: 'Wait',
              label: 'Five days, weekday hours',
              mode: 'time',
              minutes: 5 * DAY,
              window: { start: '09:00', end: '17:00', days: WEEKDAYS },
              summary:
                'A set period of time: 5 days, same Advance Window, Monday to Friday 9 AM to 5 PM. Keeps the invitation well apart from the story request, so it does not read as the price of a good review.',
            },
            {
              id: 'invite',
              kind: 'ifelse',
              title: 'If/Else',
              label: 'Invite to coaching?',
              branches: [
                {
                  label: 'Applied already',
                  when: { type: 'field', key: 'application_score', op: 'not_empty', label: 'Application Score is not empty' },
                  nodes: [
                    {
                      id: 'notify-applied',
                      kind: 'action',
                      action: 'internal_notification',
                      title: 'Internal Notification',
                      label: 'Tell Devon they finished',
                      summary: 'Type Email, To User Type Particular Users: Devon Brooks. No invitation to apply again; Devon gets something better to open the next call with.',
                      message: {
                        channel: 'internal',
                        to: 'Devon Brooks (Particular Users)',
                        subject: 'Your applicant finished the course: {{contact.name}}',
                        body: '{{contact.name}} just finished {{custom_values.course_name}}. They applied for {{custom_values.coaching_name}} earlier (Application Score {{contact.application_score}}), so they did not get the coaching invitation.\n\nWorth a mention in your next conversation with them.',
                      },
                    },
                  ],
                },
                {
                  label: 'Payment failing',
                  when: { type: 'tag', has: 'payment-failed' },
                  nodes: [
                    {
                      id: 'goto-alumni-billing',
                      kind: 'goto',
                      title: 'Go To',
                      target: 'tag-alumni',
                      summary: 'No coaching pitch while Sasha is asking them to update a card. Joins the no-click path at the alumni tag.',
                    },
                  ],
                },
              ],
              otherwise: {
                label: 'Invite',
                nodes: [
                  {
                    id: 'email-invite',
                    kind: 'action',
                    action: 'send_email',
                    title: 'Send Email',
                    label: 'Coaching invitation',
                    summary:
                      'From Morgan. What 1:1 coaching is, why it is by application, and what happens after applying. One link, the Apply trigger link, and no deadline or discount.',
                    message: { channel: 'email', subject: inviteSubject, body: inviteBody },
                  },
                  {
                    id: 'wait-click',
                    kind: 'wait',
                    title: 'Wait',
                    label: 'Clicked Apply?',
                    mode: 'event',
                    event: 'link_clicked',
                    value: 'apply',
                    minutes: 4 * DAY,
                    summary: 'The contact to take an action: Clicks a trigger link, Apply. Timeout 4 days. Opening the email does not count.',
                    branches: {
                      met: {
                        label: 'Clicked Apply',
                        nodes: [
                          {
                            id: 'notify-devon',
                            kind: 'action',
                            action: 'internal_notification',
                            title: 'Internal Notification',
                            label: 'Tell Devon',
                            summary:
                              'Type Email, To User Type Particular Users: Devon Brooks, the moment they click. Role, goal and contact details, and a plain reminder that a click is not an application yet.',
                            message: {
                              channel: 'internal',
                              to: 'Devon Brooks (Particular Users)',
                              subject: 'Graduate clicked Apply: {{contact.name}}',
                              body: '{{contact.name}} finished {{custom_values.course_name}} and clicked Apply in the coaching invitation. That is interest, not an application yet.\n\nCurrent role: {{contact.current_role}}\nGoal: {{contact.goal}}\nEmail: {{contact.email}}\nPhone: {{contact.phone}}\n\nIf no application has come in after two business days, a short personal note from you is welcome. This is a graduate, not a cold lead.',
                            },
                          },
                          {
                            id: 'tag-clicked',
                            kind: 'action',
                            action: 'add_tag',
                            title: 'Add Contact Tag',
                            label: 'upgrade-clicked',
                            summary: 'For Devon’s "Graduates who clicked Apply" Smart List. The owner stays Jules: the application itself goes through 05.',
                            effect: { addTags: ['upgrade-clicked'] },
                          },
                        ],
                      },
                      timeout: {
                        label: 'No click in 4 days',
                        nodes: [
                          {
                            id: 'tag-alumni',
                            kind: 'action',
                            action: 'add_tag',
                            title: 'Add Contact Tag',
                            label: 'alumni',
                            summary: 'Finished the course and not in the coaching funnel. The last step: the run ends here, and alumni hear about new workshops and courses through email campaigns.',
                            effect: { addTags: ['alumni'] },
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
  scenarios: [
    {
      id: 'applies',
      label: 'Finishes and clicks Apply',
      summary: 'Finishes late on a Wednesday and replies to say thanks. Sends in a story the following Monday, then clicks Apply at lunch a week later.',
      start: at(2, 21, 10),
      contact: graduate({ current_role: 'Manager', goal: 'A new industry', attended: 'Yes' }, ['workshop-attended']),
      events: [
        {
          at: 35,
          type: 'reply',
          channel: 'email',
          value: 'Thank you! The informational interview module was the one I needed.',
          label: 'Stop on Response is off, so the run carries on and Jules answers from Conversations',
        },
        {
          at: at(7, 19, 30) - at(2, 21, 10),
          type: 'form_submitted',
          value: 'Student Story',
          label: 'Student Story, with permission to quote. Nothing in this workflow reads it, so the invitation does not depend on it',
        },
        { at: at(14, 12, 24) - at(2, 21, 10), type: 'link_clicked', value: 'apply', label: 'Apply, from the coaching invitation' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['progress', 'untag', 'email-congrats', 'wait-2d', 'can-email:else', 'email-story', 'wait-5d', 'invite:else', 'email-invite', 'wait-click:met', 'notify-devon', 'tag-clicked'],
        tags: ['upgrade-clicked'],
      },
    },
    {
      id: 'ignores',
      label: 'Finishes, never clicks',
      summary: 'Stalled for weeks after the skills inventory, then came back and finished on a Monday. Opens the coaching invitation but never clicks Apply.',
      start: at(0, 12, 50),
      contact: graduate({ current_role: 'Individual contributor', goal: 'A new role' }, ['workshop-replay', 'course-stalled']),
      events: [{ at: at(7, 21, 15) - at(0, 12, 50), type: 'email_opened', label: 'Opens the coaching invitation. An open is not a click, so the wait keeps waiting' }],
      expect: {
        outcome: 'completed',
        visits: ['untag', 'email-story', 'invite:else', 'email-invite', 'wait-click:timeout', 'tag-alumni'],
        tags: ['alumni'],
      },
    },
    {
      id: 'dnd',
      label: 'Finishes on Email DND',
      summary: 'Signed up with a work address, then changed jobs. The address hard-bounced and GHL turned on Email DND. Finishes on a Friday night: no emails, and on Monday morning Jules is told why.',
      start: at(4, 23, 5),
      contact: graduate({ current_role: 'Manager', goal: 'A new role' }, ['workshop-attended'], { dnd: { email: true } }),
      events: [],
      expect: {
        outcome: 'completed',
        skips: ['email-congrats'],
        visits: ['wait-2d', 'can-email:0', 'notify-jules', 'goto-alumni-dnd', 'tag-alumni'],
        tags: ['alumni'],
      },
    },
    {
      id: 'applied',
      label: 'Applied before finishing',
      summary: 'Applied for coaching after the workshop and has a strategy call booked. Gets the congratulations and the story request, but no invitation to apply again; Devon hears they finished.',
      start: at(3, 7, 45),
      contact: graduate({ current_role: 'Senior leader', goal: 'Freelancing', application_score: 82 }, ['workshop-attended'], {
        opportunity: { pipeline: 'Enrollment', stage: 'Call Booked', status: 'open' },
      }),
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['email-congrats', 'email-story', 'invite:0', 'notify-applied'],
      },
    },
    {
      id: 'billing',
      label: 'Payment failing',
      summary: 'On the payment plan. Finishes on a Tuesday evening; a week later the third $179 installment declines and 04 tags payment-failed, so the invitation is not sent.',
      start: at(1, 18, 40),
      contact: graduate({ current_role: 'Between roles', goal: 'A new industry', payment_plan: 'Yes' }, ['workshop-attended']),
      events: [
        {
          at: at(8, 5, 12) - at(1, 18, 40),
          type: 'tag_added',
          value: 'payment-failed',
          label: 'Third $179 installment declines. 04 · Billing starts and tags payment-failed',
        },
      ],
      expect: {
        outcome: 'completed',
        visits: ['email-story', 'invite:1', 'goto-alumni-billing', 'tag-alumni'],
        tags: ['alumni', 'payment-failed'],
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Course Progress', key: 'course_progress', type: 'Dropdown (single)', note: 'Not started · Started · Skills inventory done · Completed. 03 writes the first three; this workflow writes Completed' },
      { name: 'Application Score', key: 'application_score', type: 'Number', note: 'Written by 05 · Coaching Application. Not empty means they have applied, so no invitation to apply' },
      { name: 'Current Role / Goal', key: 'current_role', type: 'Dropdown (single) ×2', note: 'From the workshop form. Quoted in Devon’s email, so a follow-up starts with context' },
    ],
    tags: [
      { name: 'alumni', note: 'Finished and not in the coaching funnel: no click on Apply, Email DND, or a failing payment. Gets new workshops and courses through email campaigns' },
      { name: 'upgrade-clicked', note: 'Clicked Apply in the coaching invitation. Devon’s Smart List; the application in 05 is the real signal' },
      { name: 'course-stalled / course-not-started', note: 'From 03. Removed here the moment they finish' },
      { name: 'payment-failed', note: 'From 04 · Billing. Read here: no coaching invitation while a payment is failing' },
    ],
    customValues: [
      { name: 'Testimonial Link', key: 'testimonial_link', value: 'trailheadcareers.example/share' },
      { name: 'Coaching Name', key: 'coaching_name', value: '1:1 Pivot Coaching' },
      { name: 'Course Name', key: 'course_name', value: 'Career Pivot Blueprint' },
      { name: 'Course Login', key: 'course_login', value: 'trailheadcareers.example/portal' },
      { name: 'Founder First Name', key: 'founder_first_name', value: 'Morgan' },
    ],
  },
  build: [
    {
      title: 'Agree what finished means',
      body: 'With Morgan and Jules: finished is all of Career Pivot Blueprint, every lesson marked complete by the student. I turned Auto-Complete Lessons off in the course’s Learner Experience Controls, because it is on by default and counts a text lesson as done when the learner clicks forward. The course keeps its Course Completion Certificate, so the certificate and this workflow start at the same moment and the workflow never issues a second one.',
    },
    {
      title: 'Testimonial rules before the email',
      body: 'Before writing the request, Morgan and I agreed the rules in the snippets below: every graduate gets the same ask, there is no reward, the form asks permission and how to show the name, and a story with a result is checked before it goes on a page. The Student Story form sits behind the Testimonial Link custom value, so no email has the URL typed in.',
    },
    {
      title: 'Trigger and settings',
      body: 'Product Completed with Product is any of Career Pivot Blueprint. Re-entry off, because the trigger fires every time a product is completed. Stop on Response off, so a thank-you does not cancel the rest. No workflow Time Window: the congratulations goes the minute they finish, and only the later emails wait for working hours.',
    },
    {
      title: 'The first minute',
      body: 'Update Contact Field sets Course Progress to Completed, the last value of the field 03 started. Remove Contact Tag clears course-stalled and course-not-started, so Jules’s lists only hold people who still need help. Then Morgan’s congratulations, with no ask in it, which GHL skips by itself for anyone on Email DND.',
    },
    {
      title: 'Waits that match the working week',
      body: 'Two days, then five days, each with an Advance Window of Monday to Friday, 9 AM to 5 PM in the contact’s time zone. The story request and the invitation both invite replies, and those should reach Jules and Devon while they are at work. The five-day gap also keeps the invitation from reading as the price of a good story.',
    },
    {
      title: 'Check before each ask',
      body: 'An If/Else on Email DND sits right before the story request, so it also catches an address that bounced or unsubscribed after the congratulations, and tells Jules in-app. A second If/Else before the invitation reads Application Score, written by 05, and the payment-failed tag from 04. Both no-invitation paths reuse the one alumni step with Go To.',
    },
    {
      title: 'Track the Apply click',
      body: 'The invitation uses the Apply link from Marketing > Trigger Links, inserted with the picker, because a raw URL records no click. A Wait for The contact to take an action, Clicks a trigger link: Apply, with a 4-day timeout, splits the run: a click emails Devon with the graduate’s role and goal and adds upgrade-clicked; no click adds alumni.',
    },
    {
      title: 'Test with shortened waits',
      body: 'A test copy of the workflow with the waits cut to minutes, and one test student per scenario above. As the student, in a private window, mark every lesson complete and check that the certificate and the congratulations both arrive. Then read Execution Logs for the DND skip, both If/Else results and the click wait. I click Apply from a personal inbox, because a work inbox’s link scanner can click it first.',
    },
  ],
  edgeCases: [
    {
      title: 'No reward tied to a good story',
      body: 'The FTC’s rule on consumer reviews and testimonials (16 CFR Part 465, in force since October 21, 2024) bans incentives conditioned on a review saying something positive or negative, and the Endorsement Guides (16 CFR Part 255) require any material connection, such as a gift for taking part, to be disclosed next to the endorsement. So the request offers nothing, and goes to every graduate, not only the happy ones. If Morgan ever adds a thank-you, everyone who answers gets it whatever they say, and every story it paid for says so.',
    },
    {
      title: 'A story with a big result',
      body: 'The Endorsement Guides treat a featured result as a claim that buyers can generally expect it. Trailhead cannot show what most students achieve, so a salary, a raise or a job-offer timeline is published without the figure or not at all, which matches the no-income-claims rule on the landing page. Quotes are trimmed for length, never reworded to change the meaning, and the student approves the final version.',
    },
    {
      title: 'Email DND: bounced or unsubscribed',
      body: 'GHL turns on Email DND after an unsubscribe, a spam complaint or a hard bounce, and skips every Send Email step for that contact. The If/Else before the story request sends them to alumni instead of leaving them in waits for emails that cannot go, and tells Jules. If they unsubscribe from the story request itself, GHL skips the invitation and the click wait runs out into alumni four days later.',
    },
    {
      title: 'Already applied, or already a client',
      body: 'Application Score is written by 05 when an application comes in, so if it is not empty the graduate gets no invitation to apply for something they applied for. Devon gets a note that they finished instead, which is a better opener for the next call than another form.',
    },
    {
      title: 'A payment is failing',
      body: 'If 04 · Billing has tagged payment-failed by the time the invitation is due, no coaching pitch goes out while Sasha is asking them to update a card. The check runs at that moment, not at entry, so a card that failed after they finished still counts. They become alumni.',
    },
    {
      title: 'A click is not an application',
      body: 'Some corporate email filters open every link to scan it, which can register as a trigger link click, and Apple Mail Privacy Protection preloads emails, which records opens nobody made. That is why opens never count here, and why Devon’s email says "clicked Apply", not "applied". The application in 05 is the real signal, and Devon checks for one before reaching out.',
    },
  ],
  qa: [
    'Mark the last lesson complete as a test student: Course Progress is Completed, course-stalled and course-not-started are gone, and the certificate and Morgan’s congratulations both arrive',
    'Click Next through a text lesson without marking it complete: it stays incomplete and Product Completed does not fire',
    'Finish on a Friday night: the story request and the invitation arrive Monday to Friday between 9 AM and 5 PM in the test contact’s time zone',
    'The story link opens the Student Story form, the permission box is unticked and optional, and nothing later in the run changes with the answers',
    'Click Apply from a personal inbox: the wait releases, Devon’s email shows role, goal, email and phone, and upgrade-clicked is added',
    'No click for four days: alumni is added and Devon gets nothing',
    'Test contacts with Email DND, with an Application Score and with payment-failed: the Execution Logs show the skipped email and Jules’s notification, Devon’s "finished the course" email, and no invitation for any of them',
    'Every merge field renders in Gmail and Outlook, and the Apply link in the sent email is a trigger link, not the raw application URL',
  ],
  snippets: [
    {
      title: 'Student Story form',
      language: 'text',
      code: storyForm,
      note: 'Question 4 gives an unhappy graduate somewhere to say so. Question 7 is how a friend’s or an affiliate’s story gets its disclosure.',
    },
    {
      title: 'Rules for publishing a student story',
      language: 'text',
      code: publishRules,
      note: 'Morgan checks each story against this list before it goes on the sales page, in an email or on social.',
    },
    {
      title: 'Coaching invitation email',
      language: 'text',
      code: `Subject: ${inviteSubject}\n\n${inviteBody}`,
      note: 'Sent at least five days after the story request, on a weekday, and only to graduates who have not applied and have no failing payment. The Apply link is the Apply trigger link, so the wait after it can see the click.',
    },
  ],
  features: [
    'Product Completed',
    'Update Contact Field',
    'Remove Contact Tag',
    'Send Email',
    'Wait · Advance Window',
    'If/Else',
    'Internal Notification',
    'Go To',
    'Trigger Links',
    'Wait · The contact to take an action',
    'Add Contact Tag',
    'Course Completion Certificate',
    'Learner Experience Controls',
  ],
};
