export interface Service {
  title: string;
  description: string;
  bullets: string[];
}

export const services: Service[] = [
  {
    title: 'Mobile apps',
    description:
      'Native and cross-platform apps for iOS and Android, from first wireframe to store listing and post-launch updates.',
    bullets: ['React Native & Flutter', 'Swift / Kotlin when native matters', 'App Store & Play Store submission'],
  },
  {
    title: 'Web applications',
    description:
      'Fast, accessible web apps and marketing sites that are easy for your team to maintain after handoff.',
    bullets: ['React, Next.js, Astro', 'Design-system driven UI', 'SEO and performance budgets'],
  },
  {
    title: 'Backends & APIs',
    description:
      'The services behind the screens: auth, payments, notifications, and integrations with the tools you already use.',
    bullets: ['Node.js, Python', 'Postgres, Firebase, Supabase', 'Stripe, Twilio, third-party APIs'],
  },
  {
    title: 'Rescue & maintenance',
    description:
      'Inherited a codebase from another freelancer? I stabilize, document, and get releases moving again.',
    bullets: ['Code audits', 'Store compliance fixes', 'Ongoing retainers'],
  },
];
