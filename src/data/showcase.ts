/**
 * The AI-built projects on the AI/Projects page. Each renders as a
 * scroll-through story; the tiles at the top switch between them.
 */
export type Screen =
  | 'clam-home'
  | 'clam-block'
  | 'clam-live'
  | 'lume-scan'
  | 'lume-score'
  | 'lume-ritual'
  | 'goodwalk-home'
  | 'goodwalk-reminder'
  | 'goodwalk-photo'
  | 'image';

export interface Feature {
  eyebrow: string;
  title: string;
  body: string;
  screen: Screen;
  image?: string;
  /** 'phone' (default), 'laptop', or 'duo' for a real iPhone Duo cover-screen capture. */
  frame?: 'phone' | 'laptop' | 'duo';
  /** Put the device on the left instead of the right. */
  flip?: boolean;
}

export interface Prompt {
  said: string;
  did: string;
  /** Shown as an example before the full list is expanded. */
  pick?: boolean;
}

export interface StoryProject {
  id: 'clam' | 'goodwalk' | 'lume' | 'launchneat' | 'site' | 'signalrig' | 'damp' | 'cartworth' | 'leaderboard';
  name: string;
  kicker: string;
  tileBlurb: string;
  /** Tile / hero gradient. */
  bg: string;
  fg: string;
  /** Optional dark-theme overrides so a light tile does not glare on the dark page. */
  bgDark?: string;
  fgDark?: string;
  /** 'light' tiles and heroes use dark text on a light background. */
  tone?: 'light' | 'dark';
  comingSoon?: false;
  hero: { title: string; sub: string; screen: Screen; image?: string; frame?: 'phone' | 'laptop' | 'duo' };
  siteShot: { desktop: string; mobile: string; caption: string; url: string };
  features: Feature[];
  /** `ai` is the rough share of the work by AI; leave it out when there is no record to base it on. */
  split: { ai?: number; aiLabel: string; meLabel: string; aiDid: string; meDid: string };
  steps: { title: string; ai: string; me: string }[];
  prompts?: Prompt[];
  promptStats?: { value: string; label: string }[];
  links: { label: string; href: string; primary?: boolean }[];
  status: string;
  caseStudy?: string;
}

/** A non-clickable “Coming soon” tile with no story behind it. */
export interface SoonProject {
  id: StoryProject['id'];
  name: string;
  kicker: string;
  tileBlurb: string;
  bg: string;
  fg: string;
  bgDark?: string;
  fgDark?: string;
  tone?: 'light' | 'dark';
  comingSoon: true;
}

export type Project = StoryProject | SoonProject;

export const projects: Project[] = [
  {
    id: 'goodwalk',
    name: 'Good Walk',
    kicker: 'iPhone app · dog walk tracker',
    tileBlurb: 'Your dog needs a walk every day. Good Walk makes it a streak.',
    bg: 'linear-gradient(135deg, #fbeadb 0%, #faf6ee 55%, #f6dfc8 100%)',
    fg: '#c2410c',
    bgDark: 'linear-gradient(135deg, #3a1f0e 0%, #12161f 55%, #35200f 100%)',
    fgDark: '#f3a05f',
    tone: 'light',
    hero: {
      title: 'Every dog deserves a good walk.',
      sub: 'Good Walk is a dog walking app for iPhone. A daily walk target for your dog, one tap from the reminder, and their photo on everything. No collar, no map, no account. Launching on the App Store for Walk Your Dog Week, 1 to 7 October.',
      screen: 'goodwalk-home',
    },
    siteShot: {
      desktop: '/showcase/goodwalk-site.jpg',
      mobile: '/showcase/goodwalk-site.jpg',
      caption: 'getgoodwalk.app, live: a landing page with how it works, pricing and an FAQ, three dog-walking guides, a support page, and privacy and terms. Served from GitHub Pages.',
      url: 'https://getgoodwalk.app',
    },
    features: [
      {
        eyebrow: 'One tap from the reminder',
        title: 'Answer from the lock screen.',
        body: 'The whole app is one question a day: has your dog had a walk? A reminder lands at the time you pick and “Walked” is right there on the notification. Tap it and the streak carries on. Miss it and the app says so, kindly.',
        screen: 'goodwalk-reminder',
      },
      {
        eyebrow: 'The month view',
        title: 'Every walk, on the calendar.',
        body: 'Each day you walk fills in a dot. The month view shows the run you are on, the days you missed and the total so far, at a glance. No stats to dig through, no charts. A glance tells you whether this was a good month for your dog.',
        screen: 'goodwalk-photo',
        flip: true,
      },
    ],
    split: {
      ai: 95,
      aiLabel: 'Claude Code',
      meLabel: 'Nick',
      aiDid: 'App concept write-up, screens, streak and reminder logic, the landing site with its guides, FAQ, privacy and terms pages, and a local preview server to review it all.',
      meDid: 'The idea, the “no collar, no map, no account” rule, the launch date tied to Walk Your Dog Week, the domain, and every yes or no along the way.',
    },
    steps: [
      { title: 'Pick the idea', ai: 'Turned one sentence into a concept: a daily walk streak for your dog, nothing else.', me: '“A dog walk tracker. Keep it simple.”' },
      { title: 'Design the loop', ai: 'Worked out the reminder, the one-tap answer and what the streak screen shows.', me: 'Insisted on no collar, no map and no account.' },
      { title: 'Build the site first', ai: 'Wrote the landing page, three guides, FAQ, privacy and terms, then served a preview from the Mac.', me: 'Reviewed it in the browser pane, bought getgoodwalk.app and set the prices.' },
      { title: 'Ship for the week', ai: 'Prepares the App Store listing and the launch checklist.', me: 'Launch target: Walk Your Dog Week, 1 to 7 October.' },
    ],
    links: [
      { label: 'getgoodwalk.app', href: 'https://getgoodwalk.app', primary: true },
      { label: 'Source on GitHub', href: 'https://github.com/nickstrom5/goodwalk' },
    ],
    status: 'In development · App Store launch planned for 1 to 7 October 2026',
    caseStudy: 'goodwalk-dog-walk-tracker',
  },
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
    id: 'signalrig',
    name: 'SignalRig',
    kicker: 'GTM engineering · demo site',
    tileBlurb: 'Five working go-to-market demos, a prompt lab and the commercial foundation behind them. One working session, live on Vercel.',
    bg: 'linear-gradient(135deg, #1e1410 0%, #121217 60%, #2c1a0e 100%)',
    fg: '#ff7a2f',
    hero: {
      title: 'GTM systems that compound.',
      sub: 'SignalRig is a client-facing showcase for GTM engineering: five working demos of the pipeline that replaces manual SDR and RevOps volume, enrichment, scoring, routing, signal detection and reporting, plus a prompt lab and the commercial foundation behind it. Every demo runs on labelled sample data in the browser. The whole site was built in one working session.',
      screen: 'image',
      image: '/showcase/signalrig-site.jpg',
      frame: 'laptop',
    },
    siteShot: {
      desktop: '/showcase/signalrig-site.jpg',
      mobile: '/showcase/signalrig-site-mobile.jpg',
      caption: 'signalrig.dev. Next.js 16 App Router, TypeScript and Tailwind v4: 58 source files and about 4,500 lines, no backend, no analytics, deployed on Vercel.',
      url: 'https://signalrig.dev',
    },
    features: [
      {
        eyebrow: 'Five working demos',
        title: 'Timing beats fit.',
        body: 'The scoring demo ranks eight accounts across five signal types with explicit weights. Flip between ranking by fit and by timing, toggle decay on year-old signals, and watch a 72-fit account with three fresh signals outrank a 95-fit account with none. The other four demos, enrichment, routing, signals and reporting, are wired the same way: real logic on sample data, not a slide.',
        screen: 'image',
        image: '/showcase/signalrig-scoring.jpg',
        frame: 'laptop',
      },
      {
        eyebrow: 'Prompt lab',
        title: 'Prompts that hold at volume.',
        body: 'The same task, score a company against an ICP, written two ways side by side. The vague prompt looks fine on ten companies and falls apart on ten thousand. The one that holds uses binary tests with weights, names its disqualifiers, forbids invention and scores unknowns as zero, so every run is auditable and cheap to re-run.',
        screen: 'image',
        image: '/showcase/signalrig-promptlab.jpg',
        frame: 'laptop',
        flip: true,
      },
    ],
    split: {
      ai: 96,
      aiLabel: 'Claude Code',
      meLabel: 'Nick',
      aiDid: 'Positioning, every section, the five interactive demos and their sample data, the prompt lab, the ICP and funnel foundation, the social image, sitemap and SEO pass, the Vercel deploy setup, and a build log documenting each phase.',
      meDid: 'The brief: a client-facing proof of GTM engineering, not a resume site. The order of the five systems, the name, the domain, and a review of every demo before merge.',
    },
    steps: [
      { title: 'Read the brief', ai: 'Turned the prompt into a plan: five demos in pipeline order, a prompt lab, the commercial foundation, one Next.js app deployable in one command.', me: '“A client-facing proof artifact, not a resume site.”' },
      { title: 'Scaffold and design', ai: 'Set up Next.js 16 with Tailwind v4, bundled fonts and design tokens, and wrote the page sections.', me: 'Picked the dark, orange-accent look and the name.' },
      { title: 'Data, then demos', ai: 'Wrote eleven JSON data files first, then built each demo against them so every number on screen is traceable.', me: 'Checked the sample ICP and signal weights made sense.' },
      { title: 'QA, ship, deploy', ai: 'Type-checked and linted, opened the pull request, deployed to Vercel and set the canonical URL.', me: 'Merged, pointed signalrig.dev at it, and asked for this story.' },
    ],
    links: [
      { label: 'Visit signalrig.dev', href: 'https://signalrig.dev', primary: true },
      { label: 'See the demos', href: 'https://signalrig.dev/#demos' },
    ],
    status: 'Live · signalrig.dev',
    caseStudy: 'signalrig-gtm-engineering-showcase',
  },
  {
    id: 'launchneat',
    name: 'LaunchNeat',
    kicker: 'Small business · websites for local shops',
    tileBlurb: 'A $99 website business, its fifteen demo sites and its own marketing site, built in one evening.',
    bg: 'linear-gradient(135deg, #e3f1ec 0%, #f8f8f0 55%, #d6ebe3 100%)',
    fg: '#146e60',
    bgDark: 'linear-gradient(135deg, #11302a 0%, #12161f 55%, #143a32 100%)',
    fgDark: '#5cc9ae',
    tone: 'light',
    hero: {
      title: 'A real website for your business. $99 the first year.',
      sub: 'LaunchNeat is a small business I started: clean templated websites for local shops and solo operators, with the domain and a year of care included, then $50 a year after that. The offer, the price points and the niche list are mine. Claude Code built everything you can see.',
      screen: 'image',
      image: '/showcase/launchneat-site.jpg',
      frame: 'laptop',
    },
    siteShot: {
      desktop: '/showcase/launchneat-site.jpg',
      mobile: '/showcase/launchneat-site-mobile.jpg',
      caption: 'launchneat.com. Five marketing pages and fifteen demo sites, a static Astro build of about 540 KB in total, no backend and no tracking.',
      url: 'https://launchneat.com',
    },
    features: [
      {
        eyebrow: 'Fifteen businesses that don’t exist',
        title: 'Show, don’t describe.',
        body: 'Instead of a features list, the site shows the thing you would get: fifteen fictional local businesses, from a salon and a food truck to a plumber and a tutor, each with its own copy, hours, prices and photos, all rendered through one template.',
        screen: 'image',
        image: '/showcase/launchneat-examples.jpg',
        frame: 'laptop',
      },
      {
        eyebrow: 'One template, fifteen personalities',
        title: 'Every demo gets its own palette and type.',
        body: 'The bakery is warm serif and butter tones; the detailer is dark and sharp. Each demo carries its own colors and font pairing in a single data file, so a new niche is a data entry, not a new design.',
        screen: 'image',
        image: '/showcase/launchneat-demo.jpg',
        frame: 'laptop',
        flip: true,
      },
    ],
    split: {
      ai: 96,
      aiLabel: 'Claude Code',
      meLabel: 'Nick',
      aiDid: 'Brand, marketing pages, pricing layout, the fifteen demo sites and their copy, the demo template, photo sourcing script, SEO pass and static deploy setup.',
      meDid: 'The business idea, the $99 and $50 price points, the list of niches, the domain, and the calls on what to cut.',
    },
    steps: [
      { title: 'Name the offer', ai: 'Wrote the positioning, the two-price model and the scope page in one pass.', me: '“Real websites for local businesses. $99 the first year, $50 after that.”' },
      { title: 'Generate the examples', ai: 'Created fifteen fictional businesses with copy, hours, prices, palettes and fonts.', me: 'Picked the niches: salon, food truck, contractor, bakery, plumber and ten more.' },
      { title: 'Rebuild lean', ai: 'Moved the site from an app scaffold to a plain static build with no backend.', me: '“Keep it simple. No logins, no database.”' },
      { title: 'Launch', ai: 'Hardened the SEO and set up the static deploy.', me: 'Bought launchneat.com and pointed it.' },
    ],
    links: [
      { label: 'Visit launchneat.com', href: 'https://launchneat.com', primary: true },
      { label: 'See the example sites', href: 'https://launchneat.com/examples/' },
    ],
    status: 'Live · launchneat.com',
    caseStudy: 'launchneat-local-business-websites',
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
    tone: 'light',
    hero: {
      title: 'The site you’re reading was built the same way.',
      sub: 'No designer, no developer, no template. I described what I wanted in plain English, sent screenshots of my Upwork and LinkedIn profiles, and Claude Code wrote the pages, read my inboxes for real client history, cropped my photo, generated the resume PDF and pushed every commit.',
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
        body: 'Feedback went in as three words. The dense sidebar resume came out as a clean role list, a downloadable one-page PDF generated from the same data, and a photo cropped from a LinkedIn screenshot.',
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
      aiDid: 'Site architecture, every page and component, content schema, case studies, Clients page, resume PDF generator, social preview image, photo crop, DNS instructions, deploy workflow, and this page.',
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
      { said: 'Actually let’s make it hello@work-with-nick.', did: 'Changed the site email everywhere it appears: About, Contact, footer, resume and structured data.' },
      { said: 'Move featured roles from About to the Work tab.', did: 'Moved the section and its styles across, and rewrote the Work page description to match.' },
      { said: 'The resume PDF design needs to be cleaner, less crowded.', did: 'Redesigned the print page with a stats strip, more whitespace and a three-column skills grid, still one page.' },
      { said: 'We will need to update the part of the site with the prompts to be accurate too. If it’s too many we can have them collapse.', did: 'Rewrote this list from the session history, kept five examples up front and put the full list behind a “show all” toggle.' },
      { said: 'Remove the grill brush hanging behind me in the profile pic.', did: 'Masked the brush and its shadow, filled the gap with brick cloned from the wall beside it, and refreshed the social image.' },
      { said: 'Can we add LaunchNeat to my AI/Apps section? Small business I’ve created.', did: 'Cloned the LaunchNeat repos, rendered its home, examples and a demo site for the laptop frames, and wrote the fourth story.' },
      { said: 'AI/Projects instead of AI/Apps.', did: 'Renamed the tab, the page and every link to it.' },
      { said: 'Can we add the Good Walk app to the AI/Projects tab? Lume can say coming soon and not link out.', did: 'Built two phone mockups for Good Walk, wrote its story from the preview site, and turned Lume into a quiet “coming soon” tile on the second row.' },
      { said: 'SignalRig can get a story and link out now.', did: 'Built the SignalRig app from its folder in this repo, screenshotted the home page, the scoring demo and the prompt lab, and promoted the tile to a full story.' },
    ],
    promptStats: [
      { value: '~85', label: 'Messages from Nick' },
      { value: '23', label: 'Screenshots' },
      { value: '47', label: 'Commits' },
      { value: '97%', label: 'Written by Claude Code' },
    ],
    links: [
      { label: 'You’re on it', href: '/', primary: true },
    ],
    status: 'Live · updated by prompt',
  },
  {
    id: 'cartworth',
    name: 'Cartworth',
    kicker: 'iPhone app · grocery price compare',
    tileBlurb: 'Every store near you. Every price per unit.',
    bg: 'linear-gradient(135deg, #e6f4e9 0%, #f7fbf8 55%, #d8ecdf 100%)',
    fg: '#0f7a3d',
    bgDark: 'linear-gradient(135deg, #0f2a1b 0%, #12161f 55%, #123322 100%)',
    fgDark: '#5fd08a',
    tone: 'light',
    hero: {
      title: 'Which store near you is actually cheaper?',
      sub: 'Cartworth searches the grocery stores around any US ZIP code at the same time, converts every price to the same unit, and shows where an item is cheapest right now. Every price is read from the store’s own published listing and labelled shelf, online or weekly ad. No account, no tracking.',
      screen: 'image',
      image: '/showcase/cartworth-iphone-compare.jpg',
    },
    siteShot: {
      desktop: '/showcase/cartworth-site.jpg',
      mobile: '/showcase/cartworth-site-mobile.jpg',
      caption: 'cartworth.app, with privacy, terms and support pages. Behind it: a SwiftUI iPhone app of 59 Swift files and about 11,000 lines, and a Node web version of about 7,000 lines.',
      url: 'https://cartworth.app',
    },
    features: [
      {
        eyebrow: 'Compared per unit',
        title: 'The cheaper tag isn’t always the cheaper buy.',
        body: 'Every row is converted to the same unit, with its store, pack size and a shelf, online or national label. On this screen Trader Joe’s 2 lb bag works out to $1.50/lb, Tony’s 20 lb bag to $1.30/lb and Walmart’s 20 lb bag to $1.02/lb. Only real matches count: “milk chocolate” never wins a search for milk.',
        screen: 'image',
        image: '/showcase/cartworth-iphone-unit-prices.jpg',
      },
      {
        eyebrow: 'A list that knows what it costs',
        title: 'Plan the cheapest trip.',
        body: 'Add items with a size, like “milk 1 gal”, and Cartworth prices that exact amount at every store you follow. Then it plans the trip: here, four items cost $12.75 at one store or $8.68 split across two. Recipes go in by photo, and the text recognition runs on the phone.',
        screen: 'image',
        image: '/showcase/cartworth-iphone-trip.jpg',
        flip: true,
      },
      {
        eyebrow: 'Also on the iPhone Duo',
        title: 'Every price says where it came from.',
        body: 'Nothing is crowdsourced and nothing is guessed. Shelf prices are labelled shelf, online listings, which can run higher, are labelled online, and weekly-ad prices come from the store’s own circular.',
        screen: 'image',
        image: '/showcase/cartworth-duo-stores.jpg',
        frame: 'duo',
      },
    ],
    split: {
      aiLabel: 'Claude Code',
      meLabel: 'Nick',
      aiDid: 'The Node web app and its store adapters, the SwiftUI iPhone app, the test suites, the marketing site, the App Store listing and the screenshot automation that drove the real app on iPhone and iPhone Duo simulators.',
      meDid: 'The idea, the name, the domain, running the builds on my Mac, and every call on what ships.',
    },
    steps: [
      { title: 'Web app first', ai: 'Built the price search: the stores near a ZIP code, searched at once, every price converted to one unit and labelled by where it came from.', me: 'The idea: which store near me is actually cheaper for the thing I’m buying today.' },
      { title: 'Then the iPhone app', ai: 'Wrote the SwiftUI app with search, weekly ads, a priced shopping list, trip planning, recipe scanning and price watches, plus tests that keep it in step with the web version.', me: 'Ran the builds on my Mac and reviewed the results.' },
      { title: 'Real renders, not mockups', ai: 'Drove the real app in the simulator to capture unretouched screenshots, on iPhone and on the iPhone Duo’s folded cover screen, and wrote down what was and wasn’t ready to ship.', me: 'Picked the shots worth showing.' },
      { title: 'Site and launch', ai: 'Built cartworth.app with its privacy, terms and support pages, the App Store listing copy and a launch checklist.', me: 'Put cartworth.app live. App Store submission is next.' },
    ],
    links: [{ label: 'Visit cartworth.app', href: 'https://cartworth.app', primary: true }],
    status: 'In development · cartworth.app is live',
  },
  {
    id: 'leaderboard',
    name: 'Chicago Restaurant Leaderboard',
    kicker: 'Web app · Illinois restaurants',
    tileBlurb: 'Illinois restaurants, ranked by one score.',
    bg: 'linear-gradient(135deg, #eaf0fa 0%, #f8f9fc 55%, #fbe6e8 100%)',
    fg: '#b3122b',
    bgDark: 'linear-gradient(135deg, #131c33 0%, #12161f 55%, #331419 100%)',
    fgDark: '#ff7a86',
    tone: 'light',
    comingSoon: true,
  },
];
