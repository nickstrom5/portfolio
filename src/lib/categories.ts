/** Display names for project categories, shared by the Work filter chips and the project cards. */
const labels: Record<string, string> = { video: 'Events & video' };

export const categoryLabel = (c: string) => labels[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
