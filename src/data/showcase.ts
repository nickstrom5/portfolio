/**
 * The AI-built projects on the AI Projects page. Most render as a
 * scroll-through story that the tiles at the top switch between; a few
 * tiles are coming soon, and a page tile opens its own page on this site.
 */
import { cases as ghlCases } from './ghl';

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
  /** Describes the screenshot; defaults to the product name plus the heading. */
  alt?: string;
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
  id: 'clam' | 'goodwalk' | 'lume' | 'launchneat' | 'site' | 'signalrig' | 'damp' | 'cartworth' | 'eatsranked';
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
  hero: { title: string; sub: string; screen: Screen; image?: string; frame?: 'phone' | 'laptop' | 'duo'; alt?: string };
  siteShot: { desktop: string; caption: string; url: string };
  features: Feature[];
  /** `ai` is the rough share of the work by AI; leave it out when there is no record to base it on. */
  split: { ai?: number; aiLabel: string; meLabel: string; aiDid: string; meDid: string };
  steps: { title: string; ai: string; me: string }[];
  prompts?: Prompt[];
  /** `live: 'commits'` swaps in the site's commit count at build time; `value` is the fallback. */
  promptStats?: { value: string; label: string; live?: 'commits' }[];
  /** Small print under the stats: where the numbers come from. */
  promptStatsNote?: string;
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
  /** Optional landing page: the tile links out instead of sitting still. */
  href?: string;
  comingSoon: true;
}

/** A tile that opens its own page on this site instead of a story below. */
export interface PageProject {
  id: 'ghl';
  name: string;
  kicker: string;
  tileBlurb: string;
  bg: string;
  fg: string;
  bgDark?: string;
  fgDark?: string;
  tone?: 'light' | 'dark';
  /** Site-relative path, e.g. /ghl/. */
  href: string;
  /** The tile's call to action, in place of "View story →". */
  cta: string;
  page: true;
  comingSoon?: false;
}

export type Project = StoryProject | SoonProject | PageProject;

const ghlWorkflows = ghlCases.reduce((n, c) => n + c.automations.length, 0);

/* Every tile and story hero shares one surface per theme; only the kicker, links and the
   selected tile's outline carry each project's color. Per-project tinted fills turned
   brown, olive and maroon in dark mode. border-box keeps the gradient from repeating
   under the tile's 2px border. */
const surface = 'linear-gradient(135deg, #e9effb 0%, #fbfbfa 55%, #e3eafa 100%) border-box';
const surfaceDark = 'linear-gradient(135deg, #16203a 0%, #12161f 55%, #1a2440 100%) border-box';

export const projects: Project[] = [
  {
    id: 'eatsranked',
    name: 'Eats Ranked',
    kicker: 'iPhone apps + web · restaurant guides',
    tileBlurb: 'Restaurants, ranked state by state. Seven states live on the web.',
    bg: surface,
    fg: '#ba3441',
    bgDark: surfaceDark,
    fgDark: '#ff8b94',
    tone: 'light',
    hero: {
      title: 'Where to eat, from the public record.',
      sub: 'Eats Ranked is a family of free restaurant guides, one per state, built from public records, open map data and cited public sources. Each state gets its own iPhone and iPad app, a website and a web version, with local favorites checked one place at a time, from Wisconsin fish fries to New Haven apizza. Seven states are live on the web, and the first app, Wisconsin Eats, has been submitted to Apple.',
      screen: 'image',
      image: '/showcase/eatsranked-guides.jpg',
      frame: 'laptop',
      alt: 'eatsranked.com, Restaurant guides by state: the cards for Chicago Restaurants: Ranked, Wisconsin Eats, Colorado Eats and Washington Eats, each with its icon, its tagline, a link to its website and “Coming soon to the App Store”',
    },
    siteShot: {
      desktop: '/showcase/eatsranked-site.jpg',
      caption: 'eatsranked.com: one static page generated from a single data file of states and prices. It opens with a map of the live states, and each state’s icon links to its site; further down are a card for each app and a restaurant-prices section built from Bureau of Labor Statistics data. No cookies, no analytics, no requests to other sites.',
      url: 'https://eatsranked.com',
    },
    features: [
      {
        eyebrow: 'Inspection records',
        title: 'Inspection results, as each agency publishes them.',
        body: 'Where an agency’s inspection data can be used, the apps show its results as recorded and never re-grade them: Florida’s statewide inspection results, LA County’s letter grades, King County’s food safety ratings. Search-only portals and data published without a license are left out. Chicago records results such as Pass, Pass with Conditions or Fail but no letter grade, so the Chicago app adds its own: a 0–100 score and an A–F grade from the results since January 2023, for more than 7,000 restaurants. Every screen that shows a grade says it is the app’s, not the City’s.',
        screen: 'image',
        image: '/showcase/eatsranked-california-inspections.jpg',
        alt: 'California Eats on iPhone, the Inspections guide: LA County’s official score and letter grade at the latest inspection, as LA County records them, with the note “We never compute a grade of our own”; 25,591 places, best latest result first, the first three Grade A with a score of 100',
      },
      {
        eyebrow: 'Local favorites',
        title: 'Each state’s own food, checked one place at a time.',
        body: 'From Wisconsin on, every app has guides to its state’s food traditions: fish fries and supper clubs in Wisconsin, green chile in Colorado, Seattle teriyaki in Washington, New Haven apizza in Connecticut, stone crabs and Cuban sandwiches in Florida, taquerías and dim sum in California. Research agents checked each place against a 2025–26 source, such as its own site or menu or a dated news story, and the guides list only places checked open. Wisconsin’s alone has 402 Friday fish fries and 211 supper clubs. The apps store no customer reviews or star ratings; ratings, hours and photos open in Apple Maps’ own place card.',
        screen: 'image',
        image: '/showcase/eatsranked-washington-teriyaki.jpg',
        alt: 'Washington Eats on iPhone, one of the seven apps: the Seattle Teriyaki guide, hand-checked teriyaki counters statewide with what each one serves, 179 places sorted nearest first',
        flip: true,
      },
      {
        eyebrow: 'One state at a time',
        title: 'Five more states live in four days.',
        body: 'Chicago and Wisconsin came first, in late September. Between October 5 and 8, Colorado, Washington, Connecticut, Florida and California went live on the web, each built from one shared playbook and fitted to what its state, counties and cities publish, with its own name, icon, palette and guides. What one state’s QA round catches goes into the playbook for the next.',
        screen: 'image',
        image: '/showcase/eatsranked-connecticut-site.jpg',
        alt: 'The Connecticut Eats website, one of the five: its own navy and tomato-red palette, its apizza icon, links to its Apizza, Lobster rolls, Hot dogs and Diners guides, and counts of 27 apizza places, 58 lobster roll and clam shack stops, 45 diners and dairy bars and 9,358 restaurants statewide',
        frame: 'laptop',
      },
      {
        eyebrow: 'Kept current',
        title: 'Chicago’s new records, checked before they ship.',
        body: 'Of the seven apps, the Chicago app is the one that refreshes its data every week, because the City keeps adding inspection results. A Python pipeline scheduled for every Monday refetches the City’s records and publishes only if every check passes: Chicago counts within 5% of the data already published, no more than 10% of grades changed, and a spot check of changed grades against the City’s own data. The app downloads the new data without an app update, and the web version reads the same files.',
        screen: 'image',
        image: '/showcase/eatsranked-chicago-map.jpg',
        alt: 'Chicago Restaurants: Ranked map of the North Side with restaurant pins colored by the app’s own A–F grade',
        flip: true,
      },
    ],
    split: {
      aiLabel: 'Claude Code',
      meLabel: 'Nick',
      aiDid: 'The SwiftUI apps, the Python data pipelines, the state websites and web versions, the test suites, the guide research by teams of research agents, the App Review and legal-risk playbooks, and the eatsranked.com hub.',
      meDid: 'The idea and the rules for the apps: no Google data, no customer reviews or star ratings. The names, icons and palettes, the domain, the data and licensing calls, a yes before each push (the weekly Chicago data publish runs on a schedule), and every App Store submission.',
    },
    steps: [
      { title: 'Start with one city', ai: 'Turned Chicago’s inspection records into a score and an A–F grade, built the iPhone app and wrote an App Review and legal-risk audit before launch.', me: 'Set the app’s rules: no Google data, no customer reviews or star ratings, no Yelp.' },
      { title: 'Then a second state', ai: 'Built Wisconsin Eats from the Chicago app’s structure, with research agents checking each fish fry and supper club against a 2025–26 source.', me: 'Decided the name should cover restaurants in general, with fish fry and supper clubs as the tagline, and chose one domain with a site per state instead of buying wisconsineats.com.' },
      { title: 'A hub and five more', ai: 'Built eatsranked.com from one data file, then Colorado, Washington, Connecticut, Florida and California, each fitted to whatever inspection data its state or local health agencies publish.', me: 'Chose each state’s icon (a Pueblo green chile, not a peach) and made the licensing calls.' },
      { title: 'Ship and keep it current', ai: 'Set up the weekly Chicago data refresh with its checks, and wrote the App Store listings and review replies.', me: 'Submitted the first app, Wisconsin Eats, for App Review on September 28; Apple asked for more information. None of the apps is on the App Store yet.' },
    ],
    links: [
      { label: 'Visit eatsranked.com', href: 'https://eatsranked.com', primary: true },
    ],
    status: 'Live on the web in seven states · iPhone and iPad apps coming soon',
  },
  {
    id: 'goodwalk',
    name: 'Good Walk',
    kicker: 'iPhone app · dog walk tracker',
    tileBlurb: 'Your dog needs a walk every day. Good Walk makes it a streak.',
    bg: surface,
    fg: '#ab4804',
    bgDark: surfaceDark,
    fgDark: '#f5a24d',
    tone: 'light',
    hero: {
      title: 'Every dog deserves a good walk.',
      sub: 'Good Walk is a dog walking app for iPhone. A daily walk target for your dog, one tap from the reminder, and their photo on everything. No collar, no map, no account. Coming soon to the App Store.',
      screen: 'goodwalk-home',
    },
    siteShot: {
      desktop: '/showcase/goodwalk-site.jpg',
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
      meDid: 'The idea, the “no collar, no map, no account” rule, the launch plan, the domain, and every yes or no along the way.',
    },
    steps: [
      { title: 'Pick the idea', ai: 'Turned one sentence into a concept: a daily walk streak for your dog, nothing else.', me: '“A dog walk tracker. Keep it simple.”' },
      { title: 'Design the loop', ai: 'Worked out the reminder, the one-tap answer and what the streak screen shows.', me: 'Insisted on no collar, no map and no account.' },
      { title: 'Build the site first', ai: 'Wrote the landing page, three guides, FAQ, privacy and terms, then served a preview from the Mac.', me: 'Reviewed it in the browser pane, bought getgoodwalk.app and set the prices.' },
      { title: 'Prepare the launch', ai: 'Prepares the App Store listing and the launch checklist.', me: 'Sets the App Store launch date.' },
    ],
    links: [
      { label: 'getgoodwalk.app', href: 'https://getgoodwalk.app', primary: true },
      { label: 'Source on GitHub', href: 'https://github.com/nickstrom5/goodwalk' },
    ],
    status: 'In development · App Store launch coming soon',
    caseStudy: 'goodwalk-dog-walk-tracker',
  },
  {
    id: 'cartworth',
    name: 'Cartworth',
    kicker: 'iPhone app · grocery price compare',
    tileBlurb: 'Every store near you. Every price per unit.',
    bg: surface,
    fg: '#01763a',
    bgDark: surfaceDark,
    fgDark: '#65cc85',
    tone: 'light',
    hero: {
      title: 'Which store near you is actually cheaper?',
      sub: 'Cartworth searches the grocery stores around any US ZIP code at the same time, converts every price to the same unit, and shows where an item is cheapest right now. Every price is read from the store’s own published listing and labelled shelf, online or weekly ad. No account, no tracking.',
      screen: 'image',
      image: '/showcase/cartworth-iphone-compare.jpg',
      alt: 'Cartworth on iPhone: the best price per pound for basmati rice and the cheapest match at each nearby store',
    },
    siteShot: {
      desktop: '/showcase/cartworth-site.jpg',
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
        alt: 'Cartworth search results for basmati rice, sorted by unit price, with sale and ad labels',
      },
      {
        eyebrow: 'A list that knows what it costs',
        title: 'Plan the cheapest trip.',
        body: 'Add items with a size, like “milk 1 gal”, and Cartworth prices that exact amount at every store you follow. Then it plans the trip: here, four items cost $12.75 at one store or $8.68 split across two. Recipes go in by photo, and the text recognition runs on the phone.',
        screen: 'image',
        image: '/showcase/cartworth-iphone-trip.jpg',
        alt: 'Cartworth trip plan: one, two or three stores, with the two-store trip saving $4.07',
        flip: true,
      },
      {
        eyebrow: 'Also on the iPhone Duo',
        title: 'Every price says where it came from.',
        body: 'Nothing is crowdsourced and nothing is guessed. Shelf prices are labelled shelf, online listings, which can run higher, are labelled online, and weekly-ad prices come from the store’s own circular.',
        screen: 'image',
        image: '/showcase/cartworth-duo-stores.jpg',
        alt: 'Cartworth on the iPhone Duo cover screen: nearby stores, each labelled shelf prices, online prices or weekly ad',
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
    id: 'launchneat',
    name: 'LaunchNeat',
    kicker: 'Small business · websites for local shops',
    tileBlurb: 'A $99 website business, its fifteen demo sites and its own marketing site, built in one evening.',
    bg: surface,
    fg: '#077367',
    bgDark: surfaceDark,
    fgDark: '#29cdb9',
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
    tileBlurb: 'About 150 short messages and some screenshots. Claude Code wrote everything else.',
    bg: surface,
    fg: '#1f5fd0',
    bgDark: surfaceDark,
    fgDark: '#84b6ff',
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
      meDid: 'About 150 short messages, screenshots of Upwork and LinkedIn, the domain purchase, and taste: “easier on the eyes”, “like an Apple product page”.',
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
      { pick: true, said: '(three screenshots of the Upwork profile)', did: 'Rewrote the positioning from developer to senior project manager and operations lead, with the real Upwork contract count, hours and Top Rated Plus.' },
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
      { said: 'Let’s make sure we only use the new resume, the PDF is outdated. And a link to this onsite resume on the About page.', did: 'Pointed the About button and the Work page at the online résumé, made /resume indexable and added it to the sitemap, and left the PDF download only on that page.' },
      { said: 'Rex walked today, let’s use a dog’s photo, a happy dog face an owner would use. And the other photo looks off, let’s only show app renders on phones. (then a dog photo) Use this.', did: 'Put a dog photo in the “Rex walked today” circle and replaced the landing-page crop with a second app screen, then swapped in the supplied photo, cropped square on the face.' },
      { said: 'Make the Hire me button a little darker blue.', did: 'Gave buttons their own deeper blue so link text stays readable in dark mode, matched the nav circle to it, and took dark-mode button contrast from 2.7:1 to 4.5:1.' },
      { said: 'Move the download resume button to be on the resume site page.', did: 'Removed the PDF button a Cursor session had added back to About, so the download now lives only on the online résumé page.' },
      { said: 'SEO improve.', did: 'Had four agents audit the site and others try to disprove each finding (36 of 38 held up), then made About the profile page, named clients in link text, gave case studies real dates and self-hosted the font.' },
      { said: 'Should say 18,000+ freelance hours billed.', did: 'Changed the label to “Freelance hours billed”, checked that it fits on a phone and on the résumé, and regenerated the PDF, still one page.' },
      { said: 'Let’s get Cartworth on the site as an AI project card, “coming soon”. And the restaurant leaderboard, as coming soon.', did: 'Added both as coming-soon tiles: Cartworth in its own greens with wording from its App Store copy, and the leaderboard written from the screenshot, since no repo for it turned up.' },
      { said: 'Cartworth URL is live. Link and full story. Would like to see a render on an iPhone Duo, if a real render.', did: 'Linked the home card to cartworth.app, built the full story from the Cartworth repo, and framed three real simulator captures of the Duo’s folded cover screen, skipping frames with retailer art or known data bugs.' },
      { pick: true, said: 'Should be an actual phone render and also a screen showing price comparisons. Duo is okay, it didn’t look like a Duo to me. Don’t use this copy, “The phone shown here is the real app on an iPhone Duo, folded.” Sounds weird.', did: 'Swapped in real iPhone captures of a price comparison, per-unit prices and a two-store trip, redrew the Duo with a hinge and camera, and cut that sentence and two like it.' },
      { said: 'Move Cartworth to where Clam is, and the leaderboard to where SignalRig is. And a card for Wisconsin restaurant leaderboard, bottom right, coming soon.', did: 'Moved Cartworth and the Chicago leaderboard into the first row and added a Wisconsin leaderboard tile, coming soon, in the bottom-right spot.' },
      { said: 'We can link to the landing pages on the restaurant cards. Make the restaurant card link to the main landing page instead of per state, so just one instead of Chi/WI.', did: 'Linked both tiles to their eatsranked.com pages and stopped coming-soon tiles from hiding the open story, then merged them into one Eats Ranked tile linking to eatsranked.com.' },
      { said: 'QA and make sure security and site, SEO, etc. are top tier.', did: 'Had five agents audit security, SEO, accessibility, accuracy and speed with a second agent checking each finding, then added a content security policy, locked down the deploy workflow, fixed contrast and the phone menu, and cut the headshot from 72 KB to 25 KB.' },
      { said: 'Recounted, and I freelanced after Bebu.', did: 'Took “full-time” out of the since-2015 lines on About, Work and the résumé, recounted every message and screenshot from the chat two independent ways, and made the commit count update on every deploy.' },
      { said: 'A hidden tab where I can add food photos, only accessible by a direct link. I’ll send it when I apply to some good jobs. We can start with these.', did: 'Built a food page kept out of search and the sitemap, a lightbox gallery, and a script that strips the GPS location and other metadata from every photo before it goes in, then cropped the first four photos out of the screenshot.' },
      { said: 'Hide the Work tab, but keep it up to date, and we can link to it from the Clients summary.', did: 'Took Work out of the top nav, kept it in the footer and linked it from the Clients page summary.' },
      { said: 'Short line on the About page: outside of work I love to travel and cook. “Food I’ve made” instead of “Food”.', did: 'Added the line with “cook” linking to the food page, and renamed the page while keeping its address.' },
      { said: 'The boxes here should be the same size. Clients, AI Projects, About and Hire me. AI Projects, not AI/Projects.', did: 'Made every client box on the home page as tall as the tallest and dropped the slash from the AI Projects label in the nav, the page heading and every link to it.' },
      { said: '“Nicholas on paper, Nick to everyone else.” Remove that line.', did: 'Took it out of the About intro.' },
      { said: 'How do I update this image? Just blue.', did: 'Replaced the favicon with the plain blue circle from the nav, in the SVG, the PNG and the iPhone home-screen icon.' },
      { pick: true, said: 'Eats Ranked can have a story like the rest. Make it the first one, then Good Walk, then Cartworth.', did: 'Had three agents pull sourced facts from the nine Eats Ranked repos, wrote the story from real simulator screenshots showing only A and B grades, rendered eatsranked.com for the site shot, and had two more agents try to disprove every claim.' },
      { said: 'The gap looks large. Have an agent or two look at this for design tips, and consult from a hiring perspective.', did: 'Cut the space under the home stats from 180px to about 110px, then had a product designer and a hiring manager review the site, with a third agent checking each suggestion before it shipped.' },
      { said: 'Project management up top on the skills box. Remove Work and GHL from the footer.', did: 'Moved Project management to the top of the About skills and took both links out of the footer, after checking each page is still linked from elsewhere on the site.' },
      { said: 'This should match the top three on the AI Projects cards.', did: 'Added an Eats Ranked card to the home page and made the home cards follow the AI Projects tile order, so the two can’t drift apart again.' },
      { said: 'The blue rounded squares should be the app icons. Make the wording better on the Symplicity card; the other two are good.', did: 'Pulled the real icons from the Eats Ranked, Good Walk and Cartworth repos, stripped their metadata and put them on the home cards, and retitled the Symplicity case study to match the BARBRI one.' },
      { pick: true, said: 'When you hover over the Hire me button, can the text change to “Please?”', did: 'Swapped the label on hover without changing the button’s width, only on devices that can hover, while screen readers still hear “Hire me”.' },
      { pick: true, said: 'Make sure stuff like this lines up cleanly.', did: 'Wrote a script that measures every card grid on the site, found the same drift in six places (testimonials, project, app and service cards, AI Projects tiles, the contracts list), gave each one shared row tracks, and re-ran it until every row measured 0px apart.' },
      { said: 'Add Personal chef to the bottom of the options.', did: 'Added it as the last Project type on the contact form.' },
      { said: '“See my work” should link to the Clients tab. Keep the text the same.', did: 'Pointed it, and the same button on the thank-you page, at Clients.' },
      { said: 'The cards on the Work page: let’s make them sound more like job titles.', did: 'Retitled all twenty case studies with the job titles from the Upwork contracts and the résumé, and “Founder” for the products of my own.' },
      { pick: true, said: 'This seems outdated. I have a lot of feedback; why only five cards? Upwork MCP is now connected.', did: 'Rebuilt Recent engagements from the nine newest client case studies so it updates itself, checked every “ongoing” claim against Upwork (three contracts had ended, so those case studies now say when), and asked for screenshots of the reviews, since neither Upwork nor the inbox exposes review text and every quote stays verbatim.' },
      { said: '(screenshots of Upwork reviews) Don’t include weird ones like the 5-minute tasks.', did: 'Transcribed seven more verbatim reviews, skipped the odd micro-gigs and the jobs with no written feedback, and ended the two long ones where Upwork’s preview does. Twelve cards now fill four rows.' },
      { pick: true, said: '(answers to the hiring manager’s four questions) Open to both full-time and freelance. Name the clients. Move them up. Add scope lines to the résumé.', did: 'Said so on the home page, Contact, About and the résumé, rewrote the opening line around SPARC.science, Symplicity and BARBRI, moved the named clients right under the hero with their hours, and added two scope lines each from the case studies while keeping the PDF to one page.' },
      { said: 'Bebu was staff.', did: 'Named Pizzeria Bebu as the staff job on the Work page and the résumé, so it no longer reads as one of the 300+ freelance contracts, and called the rest “key client roles”, since an eight-month contract isn’t one of the longest.' },
      { said: '(screenshot of the contact form) Not sure yet on the bottom.', did: 'Moved “Not sure yet” below Personal chef, so it closes the list.' },
      { said: '(screenshot of the Top Rated Plus, 100% Job Success and Freelance since 2015 pills) We can remove these.', did: 'Took them off the home page; the stats row right below already shows the same numbers.' },
      { said: '(screenshot of About) Open to a variety of roles. Change the wording.', did: 'Reworded the line on About, and the matching one on Contact, to a variety of full-time and freelance roles, from project management and operations to executive support, automation and events.' },
      { said: 'Food I’ve made: change to “Some food I’ve made”.', did: 'Renamed the food page’s heading and title.' },
      { said: '(screenshot of the home buttons) These should all be circles.', did: 'Made “See my work” and “Upwork profile” outlined pill buttons like “View resume”.' },
      { said: '(screenshot of the home buttons) “Resume”, “My work”, “Upwork”.', did: 'Shortened the three button labels to exactly that.' },
      { said: '(screenshot of the home app cards) Why aren’t the other case studies linked? Need consistency.', did: 'Linked every card to its story on AI Projects, which now opens that story and scrolls to it, and gave the site, the case study and the status their own lines on every card.' },
      { said: '(phone screenshot of the home page) Open to full-time and freelance roles.', did: 'Changed the green availability line to exactly that.' },
      { said: '(screenshot of these tiles) I like the style but the colors together look kind of dirty.', did: 'Had four designers try a cleaner palette and three judges pick one. Every tile and story now sits on the same navy, or blue-white in light mode, and only the label, the link and the selected outline carry each project’s color, so the dark orange and yellow fills no longer turn brown and olive.' },
    ],
    promptStats: [
      { value: '151', label: 'Messages from Nick' },
      { value: '51', label: 'Screenshots' },
      { value: '97', label: 'Commits', live: 'commits' },
      { value: '97%', label: 'Written by Claude Code' },
    ],
    promptStatsNote: 'Messages and screenshots counted from the main build chat on Oct 8, 2026. Commits update on every deploy.',
    links: [
      { label: 'You’re on it', href: '/', primary: true },
    ],
    status: 'Live · updated by prompt',
  },
  {
    id: 'clam',
    name: 'Clam',
    kicker: 'iPhone app · focus blocker',
    tileBlurb: 'Fold your phone shut. Your apps stay shut.',
    bg: surface,
    fg: '#8b5500',
    bgDark: surfaceDark,
    fgDark: '#f4cd4b',
    tone: 'light',
    hero: {
      title: 'One tap. Your distracting apps lock for exactly as long as you choose.',
      sub: 'Clam uses Apple’s Screen Time entitlement for real blocking, keeps the countdown on your lock screen or the iPhone Duo outer display, and never sends a byte off the phone.',
      screen: 'clam-home',
    },
    siteShot: {
      desktop: '/showcase/clam-site.jpg',
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
    bg: surface,
    fg: '#b8390c',
    bgDark: surfaceDark,
    fgDark: '#fe8f5b',
    tone: 'light',
    hero: {
      title: 'GTM systems that compound.',
      sub: 'SignalRig is a client-facing showcase for GTM engineering: five working demos of the pipeline that replaces manual SDR and RevOps volume, enrichment, scoring, routing, signal detection and reporting, plus a prompt lab and the commercial foundation behind it. Every demo runs on labelled sample data in the browser. The whole site was built in one working session.',
      screen: 'image',
      image: '/showcase/signalrig-site.jpg',
      frame: 'laptop',
    },
    siteShot: {
      desktop: '/showcase/signalrig-site.jpg',
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
    id: 'ghl',
    name: 'GHL case studies',
    kicker: 'GoHighLevel · workflows and funnels',
    tileBlurb: `Automatic follow-up for three sample businesses: ${ghlWorkflows} GoHighLevel workflows and their landing pages. Try every one in your browser.`,
    bg: surface,
    fg: '#5e56c7',
    bgDark: surfaceDark,
    fgDark: '#a8aaff',
    tone: 'light',
    href: '/ghl/',
    cta: 'Open the case studies →',
    page: true,
  },
];
