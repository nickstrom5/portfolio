import type { Automation, Contact } from '@/lib/ghl/types';
import { dateFieldValue, formatDay, nextWeekdayAt } from '@/lib/ghl/engine';

const DAY = 1440;
const MON_SAT = [0, 1, 2, 3, 4, 5];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** The simulated date the way a GHL date field stores it: MM-DD-YYYY. */
const dateField = dateFieldValue;

/** A homeowner whose roof is finished: 05 has tagged the job, set Job Date and moved the card to Job Complete. */
const finished = (start: number, assignedTo: string, amount: number, over: Partial<Contact> = {}): Partial<Contact> => ({
  assignedTo,
  tags: ['estimate-signed', 'job-complete'],
  ...over,
  fields: { service_needed: 'Full replacement', roof_age: 'Over 20 years', sms_consent: 'Yes', estimate_amount: amount, job_date: dateField(start), ...over.fields },
  opportunity: { pipeline: 'Roofing Sales', stage: 'Job Complete', status: 'won', value: amount, name: 'Dana Whitfield · Roof replacement' },
});

/** Every email ends with the business name and postal address (CAN-SPAM). GHL adds the unsubscribe link. */
const footer = '\n\n{{location.name}}, {{location.full_address}}';

const S = {
  saturday: at(5, 16, 30),
  quiet: at(3, 11, 15),
  low: at(1, 15, 40),
  textsOff: at(2, 13, 20),
};

const templates = `SMS request · Reputation › Settings › SMS Requests (Live template)
When to send SMS after check-in: Immediately
Recurring Review Requests: off, so each request sends once
Default sender number: the main line, (312) 555-0142

  Hi {{contact.first_name}}, this is Harbor & Pine Roofing. Thank you for
  trusting us with your roof. Would you share an honest review of the job?
  It helps other homeowners: {{reputation.review_link}} Reply STOP to opt out.

Email request · Reputation › Settings › Email Requests (Live template)
When to send Email after check-in: Immediately   Recurring: off
Subject: Your review of Harbor & Pine Roofing

  Hi {{contact.first_name}},

  Thank you again for choosing Harbor & Pine Roofing. If you have two minutes,
  we would be grateful for an honest review of the job on Google. Good or bad,
  it helps the next homeowner decide, and it tells us what to keep doing and
  what to fix.

  [ Leave a review ]   the Review Link element, which uses the link below

  Harbor & Pine Roofing, 1200 W Lake St, Oak Park, IL 60302

Review Link · Reputation › Settings › Review Link
  Custom Link: the Google review form for Harbor & Pine, which opens straight
  to the stars, not the Maps listing. {{reputation.review_link}} fills from it.`;

const survey = `Survey: Job check-in                    Sites › Surveys
Sticky Contact: on

1  Rating element   "How did we do?"
                    Icon: stars   Count: 5   Labels: Poor / Excellent
                    Data storage: Absolute Value
                    Custom field: Satisfaction (Number)   Required
2  Paragraph        "Anything we should fix?"            Optional
3  Phone            Required. The account matches existing contacts on
                    phone (Business Profile › Find Existing Contacts
                    Based On), so the score lands on this customer's
                    record. Sticky Contact pre-fills it on a browser
                    that has used one of our forms before.

On submit: "Thank you. Jordan reads every answer."
Published on harborpine.example/how-did-we-do, the Feedback Link custom value`;

const replySop = `Replying to reviews · one page for the office

Every review gets a reply within two business days, good or bad.
Reviews AI runs in Suggestive mode: it drafts, a person posts.
Jordan approves every reply to a 1, 2 or 3 star review.

Always:  thank them by first name, say what we will do about it,
         give the office number, (312) 555-0142.
Never:   offer anything to change or remove a review,
         argue the details in public,
         mention the address, the price or anything from the file.

A 1 to 3 star review from a customer tagged service-recovery:
Jordan replies publicly once, then calls. The fix happens on the phone.

The review widget on the website shows every rating. A 4-and-5-star
filter under "What our customers say" is the kind of display the FTC
review rule (16 CFR 465.7(b)) is about.`;

export const reviewsReferrals: Automation = {
  id: 'reviews-referrals',
  number: '06',
  name: 'Reviews and referrals',
  kicker: 'Reputation',
  tagline: 'Every finished roof gets the same review request, whatever the customer thinks. A low check-in score adds a call from the owner; it never takes the link away.',
  problem:
    'Reviews came in by luck. Nobody asked on purpose, and when someone did, it was an estimator texting the Google link to the customers they got on well with. Harbor & Pine had fewer reviews than roofers half its size, and the owner heard about problems when they showed up in public.',
  solution:
    'When a card reaches Job Complete, every customer gets the same review request the next day by text, and one email reminder if they have not clicked. A few days later a short check-in asks how the job went. A score below 4 puts Jordan on the phone within a business day. A 4 or 5 gets a referral email a week later, and so does anyone who has not answered in ten days. The review request never depends on the score: it has gone to everyone before the check-in is even sent.',
  evidence: {
    text: 'Since October 21, 2024, the FTC\'s rule on consumer reviews bans giving anything in exchange for reviews that express a particular sentiment (§465.4). It also bans using threats or intimidation to keep reviews down, and presenting the reviews you show as most or all of the ones you received while negative ones are held back (§465.7). The FTC can seek civil penalties for each violation.',
    source: '16 CFR Part 465, Trade Regulation Rule on the Use of Consumer Reviews and Testimonials (FTC)',
    href: 'https://www.ecfr.gov/current/title-16/part-465',
  },
  workflow: {
    name: '06 · Reputation · Reviews & Referrals',
    folder: 'Reputation',
    triggers: [
      {
        title: 'Pipeline Stage Changed',
        filters: ['In Pipeline is Roofing Sales', 'Pipeline Stage is Job Complete'],
        label: 'Pipeline Stage Changed (Job Complete)',
      },
    ],
    settings: {
      allowReEntry: false,
      stopOnResponse: false,
      allowMultipleOpportunities: false,
      timezone: 'contact',
      timeWindow: { start: '10:00', end: '19:00', days: MON_SAT },
      senderName: 'Jordan Blake, Harbor & Pine Roofing',
      notes: [
        'Stop on Response off: "thanks, the crew was great" is a reply, and the customer who sends it should still get the check-in and the referral email. Replies land in Conversations for Jordan.',
        'Time Window Monday to Saturday, 10 AM to 7 PM, contact time zone. It holds the texts and emails. The alert and the task for Jordan are internal, so they go out the moment a low score comes in, at any hour.',
        'Allow Re-entry off: one review request per homeowner, even if a card is moved back to Job Scheduled and forward again.',
        'Allow multiple Opportunities off (new workflows start with it on): a second finished card for the same homeowner does not start a second run either.',
        'Sender Details: From Name Jordan Blake, From Email jordan@harborpine.example, for the check-in and referral emails. The review requests use the default sender number and email set in Reputation › Settings: the main line and Jordan\'s address.',
      ],
    },
    steps: [
      {
        id: 'wait-1d',
        kind: 'wait',
        title: 'Wait',
        mode: 'time',
        minutes: DAY,
        summary: 'The day after the crew signs off: the yard is clean and they have seen the roof in daylight.',
      },
      {
        id: 'ask-sms',
        kind: 'action',
        action: 'review_request',
        title: 'Send Review Request',
        label: 'By text',
        summary: 'Review Type SMS: the Live template from Reputation › Settings, the same words and the same {{reputation.review_link}} for every customer. GHL tracks clicks on that link.',
        message: {
          channel: 'sms',
          body: 'Hi {{contact.first_name}}, this is Harbor & Pine Roofing. Thank you for trusting us with your roof. Would you share an honest review of the job? It helps other homeowners: {{reputation.review_link}} Reply STOP to opt out.',
        },
      },
      { id: 'wait-3d', kind: 'wait', title: 'Wait', mode: 'time', minutes: 3 * DAY, summary: 'Three days.' },
      {
        id: 'ask-email',
        kind: 'action',
        action: 'review_request',
        title: 'Send Review Request',
        label: 'Reminder by email',
        summary: 'Review Type Email. The only reminder, on another channel, with the same link. Anyone who clicked the link in the text skips it through the Goal Event below.',
        message: {
          channel: 'email',
          subject: 'Your review of Harbor & Pine Roofing',
          body: 'Hi {{contact.first_name}},\n\nThank you again for choosing Harbor & Pine Roofing. If you have two minutes, we would be grateful for an honest review of the job on Google. Good or bad, it helps the next homeowner decide, and it tells us what to keep doing and what to fix.\n\nLeave a review: {{reputation.review_link}}\n\n{{custom_values.owner_name}}\nOwner' + footer,
        },
      },
      {
        id: 'goal-clicked',
        kind: 'goal',
        title: 'Goal Event',
        label: 'Review Request Clicked',
        event: 'review_clicked',
        summary: 'Goal type Review Request Clicked, any channel. A click during the wait skips the email reminder; without one, Continue anyway. Nobody is asked about a review after this point.',
        ifNotMet: 'continue',
      },
      {
        id: 'wait-4d',
        kind: 'wait',
        title: 'Wait',
        mode: 'time',
        minutes: 4 * DAY,
        summary: 'Four days after the reminder, or after the click, so the check-in does not arrive on the heels of the review request.',
      },
      {
        id: 'email-checkin',
        kind: 'action',
        action: 'send_email',
        title: 'Send Email',
        label: 'Check-in',
        summary: 'From Jordan: rate the job 1 to 5, plus an optional "anything we should fix?". It goes out after the review request, so no answer can decide who is asked for a review.',
        message: {
          channel: 'email',
          subject: 'How did we do on your roof?',
          body: "Hi {{contact.first_name}},\n\nNow that the crew has been gone a few days, I'd like to know how the job went. Rate it from 1 to 5 and tell us if anything needs fixing. It takes under a minute: {{custom_values.feedback_link}}\n\nI read every answer. If something is not right, you can also reply to this email or call me at {{custom_values.office_phone}}. Your warranty details are here: {{custom_values.warranty_link}}\n\n{{custom_values.owner_name}}\nOwner" + footer,
        },
      },
      {
        id: 'wait-survey',
        kind: 'wait',
        title: 'Wait',
        label: 'Check-in answered?',
        mode: 'event',
        event: 'survey_submitted',
        minutes: 10 * DAY,
        summary: "Specific conditions to be met: Satisfaction is not empty (the survey's rating element writes it). Timeout: 10 days, so a slow answer still reaches Jordan the moment it lands, not after a referral email has gone out.",
        branches: {
          met: {
            label: 'Answered',
            nodes: [
              {
                id: 'score',
                kind: 'ifelse',
                title: 'If/Else',
                label: 'Score',
                branches: [
                  {
                    label: 'Below 4',
                    when: { type: 'field', key: 'satisfaction', op: 'lt', value: 4, label: 'Satisfaction is less than 4' },
                    nodes: [
                      {
                        id: 'notify-owner',
                        kind: 'action',
                        action: 'internal_notification',
                        title: 'Internal Notification',
                        label: 'Jordan calls',
                        summary: 'Type Email, To User Type Particular Users: Jordan Blake, as soon as the score lands; the Time Window never holds internal steps. Not a text at 9 PM: the call task below is what makes sure it happens.',
                        message: {
                          channel: 'internal',
                          to: 'Jordan Blake (particular user)',
                          subject: 'Low check-in score: {{contact.name}}',
                          body: 'Rated the job {{contact.satisfaction}} out of 5 in the check-in. The job was finished on {{contact.job_date}}. The score and any comment are on the contact record. Call within one business day: {{contact.phone}}. If it is workmanship, bring in {{custom_values.production_manager}}. Their review request went out like everyone else\'s and stays out. Never offer anything in exchange for changing or removing a review.',
                        },
                      },
                      {
                        id: 'task-call',
                        kind: 'action',
                        action: 'add_task',
                        title: 'Add Task',
                        label: 'Service recovery call',
                        summary: 'Assign To Jordan Blake, Due In 1 day, Skip Weekends on. The description says to call, agree the fix, and log it in a note.',
                        run: ({ contact, now }) => ({
                          log: `Task for Jordan Blake, due ${formatDay(nextWeekdayAt(now, 0))}: call ${contact.firstName} ${contact.lastName} about the check-in, agree the fix, and add a note saying what was agreed.`,
                        }),
                      },
                      {
                        id: 'tag-recovery',
                        kind: 'action',
                        action: 'add_tag',
                        title: 'Add Contact Tag',
                        label: 'service-recovery',
                        summary: "For Jordan's open-issues Smart List. This path ends here, so no referral email; the review request has already gone.",
                        effect: { addTags: ['service-recovery'] },
                      },
                    ],
                  },
                ],
                otherwise: {
                  label: '4 or 5',
                  nodes: [
                    {
                      id: 'wait-referral',
                      kind: 'wait',
                      title: 'Wait',
                      label: 'Before the referral ask',
                      mode: 'time',
                      minutes: 7 * DAY,
                      summary: 'A week after a good score, so the referral ask is its own message, about two weeks after the job and well clear of the review request.',
                    },
                    {
                      id: 'email-referral',
                      kind: 'action',
                      action: 'send_email',
                      title: 'Send Email',
                      label: 'Referral ask',
                      summary: 'A thank-you for introductions, with the referral form and the reward. It never mentions reviews: a reward next to a review ask reads as paying for reviews. It asks anyone who shares the link in public to mention the gift card.',
                      message: {
                        channel: 'email',
                        subject: 'Know someone who needs a roof?',
                        body: 'Hi {{contact.first_name}},\n\nIf someone you know is thinking about their roof, send them here: {{custom_values.referral_link}}. They get the same free inspection you did, and if they go ahead with a roof from us, we will send you a $250 gift card as a thank-you. There is no limit on referrals. If you share the link on social media, please mention the gift card.\n\nThanks again for choosing us.\n\n{{custom_values.owner_name}}\nOwner' + footer,
                      },
                    },
                  ],
                },
              },
            ],
          },
          timeout: {
            label: 'No answer in 10 days',
            nodes: [
              {
                id: 'goto-referral',
                kind: 'goto',
                title: 'Go To',
                target: 'email-referral',
                summary: 'No answer is not a complaint. Ten days of silence is already longer than the 4-or-5 path waits, so they go straight to the referral email. One referral email to maintain, not two.',
              },
            ],
          },
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'saturday',
      label: 'Finished on a Saturday, clicks the link',
      summary: 'Sam signs off at 4:30 PM on Saturday. The text waits for Monday morning. Dana replies, clicks the link, skips the reminder and rates the job 5 the evening the check-in arrives.',
      start: S.saturday,
      contact: finished(S.saturday, 'maya', 14800),
      events: [
        { at: at(7, 10, 19) - S.saturday, type: 'reply', value: 'Will do. The crew was great and left the yard cleaner than they found it.', label: 'Stop on Response is off, so the reply goes to Conversations and she stays in the workflow' },
        { at: at(7, 10, 22) - S.saturday, type: 'review_clicked', label: 'The review link in the text request' },
        { at: at(11, 20, 5) - S.saturday, type: 'survey_submitted', value: 5, field: 'satisfaction', label: 'Job check-in: 5 of 5, no comment' },
      ],
      expect: { outcome: 'goal', visits: ['ask-sms', 'goal-clicked', 'email-checkin', 'wait-survey:met', 'score:else', 'wait-referral', 'email-referral'], stage: 'Job Complete' },
    },
    {
      id: 'quiet',
      label: 'Never clicks, never answers',
      summary: "A storm-damage roof for one of Luis's customers. Gets the text, the one email reminder and the check-in, answers none of them, and gets the referral email ten days after the check-in.",
      start: S.quiet,
      contact: finished(S.quiet, 'luis', 11200, { fields: { service_needed: 'Storm damage', roof_age: '10-20 years' } }),
      events: [],
      expect: { outcome: 'completed', visits: ['ask-sms', 'ask-email', 'goal-clicked', 'email-checkin', 'wait-survey:timeout', 'goto-referral', 'email-referral'], stage: 'Job Complete' },
    },
    {
      id: 'low-score',
      label: 'Rates the job 2, five days later',
      summary: 'Clicks the review link the evening it arrives, like anyone else. Five days after the check-in, at 8:40 on a Saturday night, rates the job 2. Jordan gets the alert that minute and a call task for Monday; the review request is not touched.',
      start: S.low,
      contact: finished(S.low, 'maya', 12950),
      events: [
        { at: at(2, 18, 55) - S.low, type: 'review_clicked', label: 'The review link in the text request' },
        {
          at: at(12, 20, 40) - S.low,
          type: 'survey_submitted',
          value: 2,
          field: 'satisfaction',
          label: 'Job check-in: 2 of 5. "The gutter over the garage is pulling away, and there were nails in the flower bed."',
        },
      ],
      expect: { outcome: 'goal', visits: ['ask-sms', 'goal-clicked', 'email-checkin', 'wait-survey:met', 'score:0', 'notify-owner', 'task-call', 'tag-recovery'], tags: ['service-recovery'], stage: 'Job Complete' },
    },
    {
      id: 'texts-off',
      label: 'Texts turned off',
      summary: 'Replied STOP to an estimate follow-up text before she signed. The text request is skipped, and the email request is her ask: day four is a Sunday, so GHL holds it until Monday at 10 AM. She rates the job 4 the morning after the check-in.',
      start: S.textsOff,
      contact: finished(S.textsOff, 'luis', 9800, { dnd: { sms: true } }),
      events: [{ at: at(12, 9, 30) - S.textsOff, type: 'survey_submitted', value: 4, field: 'satisfaction', label: 'Job check-in: 4 of 5. "Good job, a bit slow to start."' }],
      expect: { outcome: 'completed', visits: ['ask-email', 'goal-clicked', 'email-checkin', 'wait-survey:met', 'score:else', 'wait-referral', 'email-referral'], skips: ['ask-sms'], stage: 'Job Complete' },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Satisfaction', key: 'satisfaction', type: 'Number', note: "Written by the check-in survey's rating element, 1 to 5, stored as Absolute Value. The Wait watches it and the If/Else reads it" },
      { name: 'Job Date', key: 'job_date', type: 'Date', note: "Set by 05 when the crew signs off. Quoted in Jordan's alert, so the call starts with how old the job is" },
    ],
    tags: [{ name: 'service-recovery', note: 'Check-in score below 4. Jordan owns it until the fix is agreed; no referral email' }],
    pipeline: { name: 'Roofing Sales', stages: ['New Lead', 'Contacted', 'Inspection Booked', 'Inspected', 'Estimate Sent', 'Job Scheduled', 'Job Complete'] },
    customValues: [
      { name: 'Feedback Link', key: 'feedback_link', value: 'harborpine.example/how-did-we-do' },
      { name: 'Referral Link', key: 'referral_link', value: 'harborpine.example/refer' },
      { name: 'Warranty Link', key: 'warranty_link', value: 'harborpine.example/warranty' },
      { name: 'Owner Name', key: 'owner_name', value: 'Jordan Blake' },
      { name: 'Production Manager', key: 'production_manager', value: 'Sam Rivera' },
      { name: 'Office Phone', key: 'office_phone', value: '(312) 555-0142' },
    ],
  },
  build: [
    {
      title: 'Agree the rules first',
      body: 'The common review funnel texts the Google link to happy customers and sends unhappy ones to a private form. I built the opposite and walked Jordan through why: Google lists "selectively solicit positive reviews from customers" among its prohibited practices. So the rules became: every finished job gets the same request, the same words and the same link; nothing is ever offered for a review; a low score gets Jordan on the phone, not a different link.',
    },
    {
      title: 'Reputation settings before the workflow',
      body: "The Review Link is a Custom Link that opens the Google review form directly, and every template uses {{reputation.review_link}}, so clicks are tracked. The SMS and email templates are written and set Live, with the main line and Jordan's address as the default senders. One help article says a workflow request goes out on behalf of the contact's assigned user, so the text is signed by the company, not a person, and the QA list checks which number it comes from. When to send after check-in is Immediately, and Recurring Review Requests is off, so each request sends once: the workflow owns the timing, so the Time Window, the reminder and the Execution Logs are in one place.",
    },
    {
      title: 'Trigger on the stage 05 sets',
      body: 'Pipeline Stage Changed, Roofing Sales, stage Job Complete. 05 moves the card there when Sam tags the job complete after the final walkthrough, so only finished roofs are asked, and anything Sam spotted on the walkthrough is fixed before anyone is.',
    },
    {
      title: 'Settings that decide behavior',
      body: "Stop on Response off, because a thank-you reply is not a reason to stop. Time Window Monday to Saturday, 10 AM to 7 PM in the contact's time zone, well inside the 8 AM to 8 PM texting rule and closed on Sunday. The window holds communication actions, and the help center files Send Review Request with them; the Saturday check in the QA list proves the hold in the account before this goes live. Waits after a held step count from when it actually sent. Re-entry off, so nobody is asked twice.",
    },
    {
      title: 'One ask, one reminder, one Goal Event',
      body: 'Day one: Send Review Request by text. Day four: the same request by email, as the only reminder. GHL allows one Goal Event per workflow, and I spent it on Review Request Clicked: a click on the text pulls the contact past the email. Two asks, then nothing more about reviews.',
    },
    {
      title: 'The check-in comes after the ask',
      body: 'A one-page survey with GHL\'s rating element (5 stars, stored as an absolute value in the Satisfaction field) and an optional "anything we should fix?" box. It goes out after the review request on purpose: by the time anyone answers, every customer has already been asked, so the answer cannot decide who gets the link. A Wait for Specific conditions to be met (Satisfaction is not empty) watches for ten days, not three: with a short wait followed by a long one before the referral email, a 2 on day five would never reach Jordan, and that customer would still be asked for referrals.',
    },
    {
      title: 'Low scores add work, never remove the link',
      body: 'Below 4: Jordan gets an email alert and a call task due the next business day, and the contact is tagged service-recovery. They skip the referral email, which is allowed: a referral is an introduction, not a review. A 4 or 5 gets the referral email a week later. No answer in ten days goes straight to the same email through a Go To, so there is one referral email to maintain.',
    },
    {
      title: 'Test, publish, hand off',
      body: 'Four test contacts, one per scenario below, checked in Execution Logs and in Reputation › Requests, where each request should show as sent and, for the clickers, clicked. Then the one-page reply SOP below, and Reviews AI in Suggestive mode, so a person posts every reply.',
    },
  ],
  edgeCases: [
    {
      title: 'An unhappy customer',
      body: 'They got the same review request as everyone, the day after the job, before anyone knew how they felt. A low check-in score adds a call from Jordan. It does not withdraw the link or send them somewhere else: Google lists "selectively solicit positive reviews from customers" as prohibited, and routing people by score is exactly that.',
    },
    {
      title: 'Incentives',
      body: 'The $250 referral reward is fine: it pays for an introduction, not an opinion. Nothing is offered for a review, not a discount and not a raffle entry. Google prohibits review incentives outright, and the FTC rule bans incentives tied to what the review says (16 CFR 465.4). The referral email never mentions reviews, so nobody can read the two together. A customer who recommends us in public while a reward is on offer has a material connection under the FTC Endorsement Guides (16 CFR 255.5), so the email asks them to mention the gift card when they share the link.',
    },
    {
      title: 'A slow answer',
      body: 'The check-in wait runs ten days and ends the moment Satisfaction is filled in, so a 2 on day five reaches Jordan that evening, before any referral email. An answer after day ten is still saved to Satisfaction, and Jordan\'s Smart List of Satisfaction below 4 picks it up: by then the workflow has finished, so the Smart List is the safety net.',
    },
    {
      title: 'Texts turned off',
      body: 'Consent works as in 04: anyone without text consent on file is on SMS DND, set by 01 at intake or by 03 at booking. The review text is about their own finished job, not an offer, so the offers box is not the gate. A customer on SMS DND has the text request skipped and logged, and the email request on day four is their ask, with the same link. I chose that over a DND If/Else at the top: the review request stays on the one path every customer walks, so it can never end up on only one side of a branch.',
    },
    {
      title: 'They reply to the review text',
      body: 'Stop on Response is off, so "thanks, the crew was great" lands in Conversations and they stay in for the check-in. STOP switches SMS DND on automatically. "Please don\'t text me" does not, so the office turns on SMS DND from the conversation that day: since April 11, 2025 the FCC has required honoring an opt-out made by any reasonable means within 10 business days. Nothing later in this workflow is a text either way.',
    },
    {
      title: 'Card moved back and forward',
      body: 'Re-entry is off, so a card dragged back to Job Scheduled and forward again does not ask twice. The trade-off is a repeat customer next year: the workflow does not ask again, and Jordan sends that request by hand from the contact record. If re-entry is ever turned on for repeat jobs, the first step has to clear Satisfaction, or last year\'s score ends the check-in wait on day one.',
    },
  ],
  qa: [
    "Move a test card assigned to Maya to Job Complete at 3 PM on a weekday: the text request arrives at 3 PM the next day from the main line, not Maya's number, and shows in Reputation › Requests as sent",
    'Move one at 5 PM on Saturday: nothing sends on Sunday, and the request goes out Monday at 10 AM',
    'Click the link in the text: Execution Logs show the Goal Event met, and the email reminder never sends',
    'Do not click: the email request arrives on day four with the same link',
    'Submit the survey with 2 stars on a Saturday night, five days after the check-in: Satisfaction is 2 on the contact, Jordan gets the email alert at once and a task due Monday, the tag is added, no referral email follows, and nothing about the review request changes',
    'Submit with 5, and on a second contact not at all: the first gets the referral email a week later, the second ten days after the check-in, both with the postal address and unsubscribe link in the footer',
    'Test contact on SMS DND: the text request shows as skipped and the email request goes out',
    'Read every message out loud: no reward anywhere near a review ask, no "if you were happy" wording, and the review link opens the Google review form on a phone',
  ],
  snippets: [
    {
      title: 'Review request templates (Reputation › Settings)',
      language: 'text',
      code: templates,
      note: 'GHL fills {{reputation.review_link}} from the Review Link setting and tracks clicks on it, which is what the Review Request Clicked goal listens for.',
    },
    { title: 'Check-in survey', language: 'text', code: survey, note: 'The rating element writes straight to the Satisfaction field, so the Wait and the If/Else read a number, not free text.' },
    { title: 'Replying to reviews (SOP)', language: 'text', code: replySop, note: 'The workflow asks everyone. What the office does with the answers is the other half of staying compliant.' },
  ],
  features: [
    'Pipeline Stage Changed',
    'Wait',
    'Send Review Request',
    'Goal Event · Review Request Clicked',
    'Send Email',
    'Surveys · Rating element',
    'Wait · Specific conditions',
    'If/Else',
    'Internal Notification',
    'Add Task',
    'Add Contact Tag',
    'Go To',
    'Time Window',
    'Sender Details',
  ],
};
