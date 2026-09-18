/**
 * The three AI-built projects on the Apps/AI page. Each renders as a
 * scroll-through story; the tiles at the top switch between them.
 */
export type Screen =
  | 'clam-home'
  | 'clam-block'
  | 'clam-live'
  | 'lume-scan'
  | 'lume-score'
  | 'lume-ritual'
  | 'image';

export interface Feature {
  eyebrow: string;
  title: string;
  body: string;
  screen: Screen;
  image?: string;
  /** 'phone' (default) or 'laptop'. */
  frame?: 'phone' | 'laptop';
  /** Put the device on the left instead of the right. */
  flip?: boolean;
}

export interface Prompt {
  said: string;
  did: string;
  /** Shown as an example before the full list is expanded. */
  pick?: boolean;
}

export interface Project {
  id: 'clam' | 'lume' | 'site';
  name: string;
  kicker: string;
  tileBlurb: string;
  /** Tile / hero gradient. */
  bg: string;
  fg: string;
  /** Optional dark-theme overrides so a light tile does not glare on the dark page. */
  bgDark?: string;
  fgDark?: string;
  hero: { title: string; sub: string; screen: Screen; image?: string; frame?: 'phone' | 'laptop' };
  siteShot: { desktop: string; mobile: string; caption: string; url: string };
  features: Feature[];
  split: { ai: number; aiLabel: string; meLabel: string; aiDid: string; meDid: string };
  steps: { title: string; ai: string; me: string }[];
  prompts?: Prompt[];
  promptStats?: { value: string; label: string }[];
  links: { label: string; href: string; primary?: boolean }[];
  status: string;
  caseStudy?: string;
}

export const projects: Project[] = [
  {
    id: 'clam',
    name: 'Clam',
    kicker: 'iPhone app · focus blocker',
    tileBlurb: 'Fold your phone shut. Your apps stay shut.',
    bg: 'linear-gradient(135deg, #1b1b22 0%, #121217 60%, #2a2412 100%)',
    fg: '#fad159',
    hero: {
      title: 'One tap. Your distracting apps lock for exactly as long as you choose.',
      sub: 'Clam uses Apple’s Screen Time entitlement for real blocking, keeps the countdown on your lock screen or the iPhone Duo outer display, and never sends a byte off the phone.',
      screen: 'clam-home',
    },
    siteShot: {
      desktop: '/showcase/clam-site.jpg',
      mobile: '/showcase/clam-site-mobile.jpg',
      caption: 'getclam.app, the landing page. Written and styled by the models, served from GitHub Pages.',
      url: 'https://getclam.app',
    },
    features: [
      {
        eyebrow: 'The block screen',
        title: 'Open Instagram? Nope.',
        body: 'A Shield Configuration extension draws a branded block screen the moment you open a locked app. It shows what’s locked, how long is left, and that quitting early costs a ten-second hold and your streak.',
        screen: 'clam-block',
      },
      {
        eyebrow: 'Live Activity',
        title: 'The timer follows you to the lock screen.',
        body: 'ActivityKit puts the countdown on the lock screen and in the Dynamic Island. On iPhone Duo it lives on the outer display, so the fold itself becomes the ritual.',
        screen: 'clam-live',
        flip: true,
      },
    ],
    split: {
      ai: 95,
      aiLabel: 'Claude & Grok',
      meLabel: 'Nick',
      aiDid: 'Market research, strategy doc, nine onboarding screens, SwiftUI app, three extensions, StoreKit 2 paywall, unit tests, Xcode project, App Store listing, entitlement request, landing site, legal pages, social kit.',
      meDid: 'The idea, the “nothing leaves the phone” rule, every product decision, running builds on a real iPhone, pasting errors back, domains, accounts and the launch calendar.',
    },
    steps: [
      { title: 'Research the category', ai: 'Studied Opal, Jomo and Brick, priced the market and wrote a 30-day plan.', me: 'Chose the fold as the hook and set the no-backend constraint.' },
      { title: 'Design the loop', ai: 'Wrote each onboarding screen and the belief it has to move, then the paywall.', me: 'Read it as a user and cut anything that felt like a pitch.' },
      { title: 'Generate the app', ai: 'Produced the app, shield, monitor and widget targets file by file.', me: 'Ran the builds, reported what broke on device, repeated.' },
      { title: 'Prepare the launch', ai: 'Listing, screenshots plan, privacy labels, creator brief, landing page.', me: 'Registered getclam.app, set up Pages and the developer account.' },
    ],
    links: [
      { label: 'getclam.app', href: 'https://getclam.app', primary: true },
      { label: 'Source on GitHub', href: 'https://github.com/nickstrom5/Claude' },
    ],
    status: 'In development · App Store link goes live with the listing',
    caseStudy: 'clam-focus-blocker',
  },
  {
    id: 'lume',
    name: 'Lume',
    kicker: 'iPhone app · daily glow coach',
    tileBlurb: 'One photo. A glow score. Sixty seconds.',
    bg: 'linear-gradient(135deg, #1a1916 0%, #0e0e0c 60%, #2a2620 100%)',
    fg: '#e8e4db',
    hero: {
      title: 'The camera already knows. You just haven’t asked it.',
      sub: 'Take one photo in the same light each morning, get a score for glow, evenness, texture and calm, and do a sixty-second ritual. The picture is processed on the phone and never uploaded.',
      screen: 'lume-score',
    },
    siteShot: {
      desktop: '/showcase/lume-site.jpg',
      mobile: '/showcase/lume-site-mobile.jpg',
      caption: 'lumenow.app. The serif headline, the pricing and the “not a medical device” framing all came out of the same working sessions.',
      url: 'https://lumenow.app',
    },
    features: [
      {
        eyebrow: 'The scan',
        title: 'Same window. Same hour.',
        body: 'Consistency beats precision. Lume guides you to the same light every morning so the trend line means something, and it reads the photo on device.',
        screen: 'lume-scan',
      },
      {
        eyebrow: 'The ritual',
        title: 'Rinse. Press. Seal. SPF.',
        body: 'Four steps, fifteen seconds each, morning and evening. On iPhone Duo the face stays on one screen and the ritual on the other, like a book.',
        screen: 'lume-ritual',
        flip: true,
      },
    ],
    split: {
      ai: 95,
      aiLabel: 'Claude & Grok',
      meLabel: 'Nick',
      aiDid: 'Positioning against the skincare and glow-up apps, the scoring model, capture flow, trend view, share cards, StoreKit 2 trial, marketing site, App Store listing and social kit.',
      meDid: 'The constraint that photos never leave the phone, the sixty-second limit, the Duo layout call, device testing and the decision to launch after Clam.',
    },
    steps: [
      { title: 'Find the gap', ai: 'Mapped the category: diagnosis apps on one side, shops on the other.', me: 'Picked “coach with a camera” and said no to anything medical.' },
      { title: 'Write the product', ai: 'Screens, copy, pricing and the not-a-medical-device language.', me: 'Approved the flow and the sixty-second ceiling.' },
      { title: 'Generate the app', ai: 'SwiftUI capture, on-device scoring, ritual timer, StoreKit 2.', me: 'Tested scans on a real phone in real light.' },
      { title: 'Prepare the launch', ai: 'Listing, keywords, promo text, landing page, social handles plan.', me: 'Registered lumenow.app and lined up the accounts.' },
    ],
    links: [
      { label: 'lumenow.app', href: 'https://lumenow.app', primary: true },
      { label: 'Site source on GitHub', href: 'https://github.com/nickstrom5/lume' },
    ],
    status: 'In development · App Store link goes live with the listing',
    caseStudy: 'lume-daily-glow-coach',
  },
  {
    id: 'site',
    name: 'This website',
    kicker: 'work-with-nick.com · built from prompts',
    tileBlurb: 'A few dozen short messages and some screenshots. Claude Code wrote everything else.',
    bg: 'linear-gradient(135deg, #e7eefc 0%, #fbfbf9 55%, #dfe8fb 100%)',
    fg: '#1f5fd0',
    bgDark: 'linear-gradient(135deg, #16203a 0%, #12161f 55%, #1a2440 100%)',
    fgDark: '#8fb2ff',
    hero: {
      title: 'The site you’re reading was built the same way.',
      sub: 'No designer, no developer, no template. I described what I wanted in plain English, sent screenshots of my Upwork and LinkedIn profiles, and Claude Code wrote the pages, read my inboxes for real client history, cropped my photo, generated the résumé PDF and pushed every commit.',
      screen: 'image',
      image: '/showcase/site-home.jpg',
      frame: 'laptop',
    },
    siteShot: {
      desktop: '/showcase/site-home.jpg',
      mobile: '/showcase/site-home-mobile.jpg',
      caption: 'The home page. Astro, plain CSS, no frameworks, deployed by a GitHub Actions workflow the model also wrote.',
      url: 'https://work-with-nick.com',
    },
    features: [
      {
        eyebrow: 'Real data, not lorem ipsum',
        title: 'It read my inbox so I didn’t have to.',
        body: 'With Gmail connected, it found the Upwork contract notifications, pulled contract titles, spotted my longest engagement and wrote the case studies. When a review only arrived as a screenshot, it transcribed it.',
        screen: 'image',
        image: '/showcase/site-clients.jpg',
        frame: 'laptop',
      },
      {
        eyebrow: 'Taste, applied',
        title: '“Easier on the eyes.”',
        body: 'Feedback went in as three words. The dense sidebar résumé came out as a clean role list, a downloadable one-page PDF generated from the same data, and a photo cropped from a LinkedIn screenshot.',
        screen: 'image',
        image: '/showcase/site-about.jpg',
        frame: 'laptop',
        flip: true,
      },
    ],
    split: {
      ai: 97,
      aiLabel: 'Claude Code',
      meLabel: 'Nick',
      aiDid: 'Site architecture, every page and component, content schema, case studies, Clients page, résumé PDF generator, social preview image, photo crop, DNS instructions, deploy workflow, and this page.',
      meDid: 'A few dozen short messages, screenshots of Upwork and LinkedIn, the domain purchase, and taste: “easier on the eyes”, “like an Apple product page”.',
    },
    steps: [
      { title: 'Describe the outcome', ai: 'Scaffolded the site, sample content and a deploy pipeline in one pass.', me: '“Build me a portfolio website. I freelance and have had countless clients.”' },
      { title: 'Hand over the sources', ai: 'Read Gmail and Outlook, cloned the app repos, extracted the facts.', me: 'Connected the inbox and sent profile screenshots.' },
      { title: 'React to what you see', ai: 'Repositioned the whole site when the real profile arrived.', me: '“The resume on the front page should be easier on the eyes.”' },
      { title: 'Ship', ai: 'Committed, pushed, generated the PDF and this showcase.', me: 'Bought work-with-nick.com.' },
    ],
    prompts: [
      { pick: true, said: 'Build me a portfolio website. I freelance and have had countless clients. We can feature clients, work, projects and the mobile apps I’ve developed. We need a domain too.', did: 'Scaffolded an Astro site with a data-driven content model, six pages, light and dark themes, a GitHub Pages workflow and a domain shortlist.' },
      { said: 'Upwork emails are in nickstrom5 inbox.', did: 'Searched the connected mailboxes, found a live Upwork engagement in an Outlook thread and wrote it up under NDA-safe wording.' },
      { pick: true, said: '(three screenshots of the Upwork profile)', did: 'Rewrote the positioning from developer to senior project manager and operations lead, with the real 257 contracts, 17,800+ hours and Top Rated Plus.' },
      { said: 'Apps built getclam.app and lume.', did: 'Cloned both public repos, read the strategy and listing docs, and wrote accurate case studies and app cards.' },
      { said: '(four screenshots of LinkedIn experience)', did: 'Replaced every sample case study with SPARC, BARBRI, Symplicity, Rippling, OFFX and Blackdove, and built the experience timeline.' },
      { said: 'work-with-nick.com purchased. Mobile apps are in development.', did: 'Pointed the site at the domain, added the CNAME, wrote out the Cloudflare DNS records and updated the app status.' },
      { pick: true, said: 'Add a tab for clients. The resume on the front page should be easier on the eyes. Not sure if keeping or include a resume PDF instead.', did: 'Built the Clients page, simplified the experience list and generated a one-page PDF from the same data.' },
      { said: '(five screenshots of Upwork reviews)', did: 'Transcribed five verbatim reviews with ratings, hours and endorsements. No sample content remained.' },
      { said: 'Under Top 1% indicate that’s on Upwork. You can include my LinkedIn profile photo. App section: go over how these are made via Grok and Claude as AI experiments.', did: 'Cropped the portrait out of a LinkedIn screenshot, added it to the home and About pages, and drafted the first version of the Apps/AI story.' },
      { said: 'The circle in a circle looks weird, like an egg.', did: 'Measured the face in the source image, re-cropped it to a true circle in code and dropped the extra CSS ring.' },
      { pick: true, said: 'Include photos of the app’s websites and renders of the apps on phones. Like an Apple product page. Click which item you want to see, one at a time. The third can be this website itself.', did: 'Rendered the app sites locally, built CSS phone mockups of the real screens, and produced this page with its three tiles.' },
      { said: 'Don’t show phones, maybe a laptop on the website project.', did: 'Added a CSS laptop frame and switched the website story to desktop screenshots.' },
      { said: 'Formspree, what to do?', did: 'Explained the two-minute setup, then wired the form to the endpoint with a spam honeypot and a thank-you page.' },
      { said: 'SEO on the site should be pristine.', did: 'Added JSON-LD for the site, person and every case study, canonical URLs, Open Graph and Twitter tags, a sitemap and a generated social image.' },
      { pick: true, said: 'Let’s QA the site extensively after it’s live, and make sure the mobile version is also smooth.', did: 'Wrote a Playwright audit that checks every page at three widths in both themes, then fixed the tap targets, heading order and overflow it found.' },
      { said: 'About me page should have the photo, link to my LinkedIn, Upwork, etc.', did: 'Added the Connect card and rewrote the skills to include the AI-directed development work.' },
      { said: 'Google Search Console needed?', did: 'Yes. Walked through domain verification on Cloudflare and submitted the sitemap.' },
      { said: 'SEO check every week so we can keep it up to date, and QA the site.', did: 'Scheduled a weekly routine that re-runs the audit against the live site and opens a pull request if anything drifts.' },
      { said: 'The text in the blue circles looks off. The 1,000+ hours one looks best.', did: 'Shortened every client badge to a few characters so none wraps.' },
      { said: 'Actually let’s make it hello@work-with-nick.', did: 'Changed the site email everywhere it appears: About, Contact, footer, résumé and structured data.' },
      { said: 'Move featured roles from About to the Work tab.', did: 'Moved the section and its styles across, and rewrote the Work page description to match.' },
      { said: 'The résumé PDF design needs to be cleaner, less crowded.', did: 'Redesigned the print page with a stats strip, more whitespace and a three-column skills grid, still one page.' },
      { said: 'We will need to update the part of the site with the prompts to be accurate too. If it’s too many we can have them collapse.', did: 'Rewrote this list from the session history, kept five examples up front and put the full list behind a “show all” toggle.' },
    ],
    promptStats: [
      { value: '~60', label: 'Messages from Nick' },
      { value: '18', label: 'Screenshots' },
      { value: '30', label: 'Commits' },
      { value: '97%', label: 'Written by Claude Code' },
    ],
    links: [
      { label: 'You’re on it', href: '/', primary: true },
    ],
    status: 'Live · updated by prompt',
  },
];
