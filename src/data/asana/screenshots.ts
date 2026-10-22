/**
 * Screenshots of each case built in a real Asana workspace (an Advanced
 * trial), made with `npm run asana:seed` from the same data the page draws.
 * Shown in the "In Asana itself" gallery of each case. To retake them, seed
 * a workspace, screenshot at 1512 px wide, and replace the files in
 * src/assets/asana/ keeping their names.
 */
import type { ImageMetadata } from 'astro';
import creativeBoard from '@/assets/asana/marketing-creative-requests-board.jpg';
import launchTimeline from '@/assets/asana/marketing-winter-launch-timeline.jpg';
import launchStatus from '@/assets/asana/marketing-winter-launch-status.jpg';
import contentCalendar from '@/assets/asana/marketing-content-calendar.jpg';
import marketingPortfolio from '@/assets/asana/marketing-portfolio.jpg';
import marketingGoal from '@/assets/asana/marketing-goal.jpg';
import intakeBoard from '@/assets/asana/services-intake-board.jpg';
import onboardingTimeline from '@/assets/asana/services-onboarding-timeline.jpg';
import servicesPortfolio from '@/assets/asana/services-portfolio.jpg';
import goalsMap from '@/assets/asana/goals-strategy-map.jpg';
import fieldBoard from '@/assets/asana/nonprofit-field-season-board.jpg';
import dataRequests from '@/assets/asana/nonprofit-data-requests-list.jpg';
import grantReporting from '@/assets/asana/nonprofit-grant-reporting-list.jpg';
import nonprofitPortfolio from '@/assets/asana/nonprofit-portfolio.jpg';

export interface Screenshot {
  image: ImageMetadata;
  /** What the picture shows, for screen readers. */
  alt: string;
  /** One line under the thumbnail. */
  caption: string;
}

/** By case id, in the order they're shown. */
export const screenshots: Record<string, Screenshot[]> = {
  marketing: [
    { image: creativeBoard, caption: 'Creative Requests in Board view', alt: 'Asana board for the Creative Requests project: columns New requests, Needs info, Queued, In progress and In review, with request cards showing Request type, Rush, Priority and Requesting team chips, due dates and subtask counts.' },
    { image: launchTimeline, caption: 'Winter Gear Launch on Timeline', alt: 'Asana Timeline for the Winter Gear Launch project by day: task bars grouped by section, dependency arrows between them, approval sign-off tasks and diamond milestones for Creative locked and Launch day. The project is marked At risk.' },
    { image: launchStatus, caption: 'The weekly status update', alt: 'Winter Gear Launch project overview in Asana with an At risk status update titled Winter Gear Launch weekly status, and the project description.' },
    { image: contentCalendar, caption: 'Content Calendar in month view', alt: 'Asana Calendar view of the Content Calendar project for November, with a reel, a launch teaser email and a launch day post on their dates.' },
    { image: marketingPortfolio, caption: 'The Marketing · 2026 H2 portfolio', alt: 'Asana portfolio listing Creative Requests, Winter Gear Launch and Content Calendar with their status (On track, At risk, On track) and task progress.' },
    { image: marketingGoal, caption: 'A goal with its progress', alt: 'Asana goal page for Grow online revenue 25% year over year in Q4: 58% complete, On track, time period FY26.' },
  ],
  services: [
    { image: intakeBoard, caption: 'New Client Intake in Board view', alt: 'Asana board for New Client Intake: columns Inquiries, Discovery call, Conflict check, Proposal and Engagement letter, with prospect cards showing Service, Entity type and Revenue band chips.' },
    { image: onboardingTimeline, caption: 'An onboarding on Timeline', alt: 'Asana Timeline for Onboarding · Larkspur Bakery by day: client to-dos, setup and first close tasks linked by dependency arrows, with milestones for Books received and First month closed. Marked At risk.' },
    { image: servicesPortfolio, caption: 'The Client onboardings · Q4 portfolio', alt: 'Asana portfolio listing New Client Intake, Onboarding · Larkspur Bakery and Client Ops with their status and task progress.' },
    { image: goalsMap, caption: 'The goals map, all three cases', alt: 'Asana goals strategy map showing three top-level goals with progress bars: Grow online revenue 25% (58%), Grow recurring revenue to $180k a month (64%) and Restore 12 miles of spawning habitat (41%), each On track.' },
  ],
  nonprofit: [
    { image: fieldBoard, caption: '2026 Field Season in Board view', alt: 'Asana board for 2026 Field Season: columns Planned, In the field, Data uploaded, QA and Published, with survey cards showing Site and Status chips, including a Blocked card with the reason Access road washed out.' },
    { image: dataRequests, caption: 'Data Requests in List view', alt: 'Asana list of partner data requests grouped by section, with Data type, Sensitive locations, Organization type and Site columns; one request sits in Needs data-sharing agreement.' },
    { image: grantReporting, caption: 'Grant Reporting in List view', alt: 'Asana list of reports grouped by section with Report type, Grant and Effort columns and section totals; the Q3 funder report shows four subtasks and a waiting-on-dependency icon.' },
    { image: nonprofitPortfolio, caption: 'The Salmon Habitat Program portfolio', alt: 'Asana portfolio, marked At risk, listing Data Requests, 2026 Field Season and Grant Reporting with their status and task progress.' },
  ],
};
