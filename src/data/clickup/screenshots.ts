/**
 * Screenshots of the sample setup rebuilt in a real ClickUp Workspace, shown
 * under each process on /clickup/. Files live in src/assets/clickup/ as
 * <case>-<process>-<n>.jpg, in the order listed here. Only the page reads
 * this file, so the images never reach the simulator's data chunks.
 */
export interface Screenshot {
  /** Short heading under the image. */
  caption: string;
  alt: string;
}

export const screenshots: Record<string, Screenshot[]> = {
  'agency-intake': [
    {
      caption: 'Project Requests in List view',
      alt: 'ClickUp List view of Fernhill Studio’s Project Requests, grouped by the custom statuses Won, Proposal sent, Discovery call and Qualifying, with Service, Budget, Timeline and Heard about us as Dropdown Custom Field columns.',
    },
    {
      caption: 'The “Still waiting after a day” Automation',
      alt: 'ClickUp’s Automation builder: Trigger Due date arrives, Condition Status is any of New request, Actions Update priority to Urgent and Add comment.',
    },
    {
      caption: 'The “Start a project” Form',
      alt: 'ClickUp Form view of the Start a project Form, with questions mapped to the task name and to the Service, Budget, Timeline, Contact email and Heard about us fields.',
    },
  ],
  'agency-launch': [
    {
      caption: 'The Launch plan in Gantt view',
      alt: 'ClickUp Gantt view of the Juniper Dental launch plan: three blocking tasks done, client sign-off still open, and dependency lines into the go-live task the following Monday.',
    },
  ],
  'ops-maintenance': [
    {
      caption: 'Work Orders on a Board',
      alt: 'ClickUp Board view of Cedar Row’s Work Orders, one column per custom status, with priority flags and a vendor-late tag on the job waiting on a vendor.',
    },
  ],
  'product-sprint': [
    {
      caption: 'Sprint 14 on a Board',
      alt: 'ClickUp Board view of Tallyway’s Sprint 14, with To do, In progress, Code review, QA and Done columns and priority flags on each ticket.',
    },
  ],
};
