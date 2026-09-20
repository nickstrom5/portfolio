/**
 * The globe: the 2026 tour's stage, screen and entire visual argument.
 *
 * What is documented is documented here. What the production has deliberately
 * not said — how the sphere is rigged, driven or projected — is marked as
 * undisclosed rather than guessed at.
 */

export const globe = {
  name: 'The Globe Stage',
  alsoKnown: 'the Dome Stage',
  designers: 'Ye with Aus Taylor',
  lighting: 'John McGuire',
  diameter: 'over 50 feet',
  debut: '1 April 2026, SoFi Stadium — billed as "Ye: The Homecoming"',
  behaviour: 'Spins continuously, projecting Earth and Moon surfaces across the full set',
} as const;

export interface GlobeFact {
  term: string;
  body: string;
}

export const specs: GlobeFact[] = [
  { term: 'Diameter', body: 'Estimated at over 50 feet — roughly the height of a five-storey building, sitting on a stadium floor.' },
  { term: 'Designed by', body: 'Ye, with production designer Aus Taylor. Taylor has described his own part in it as being "just a vessel".' },
  { term: 'Lighting', body: 'John McGuire.' },
  { term: 'Surface', body: 'The sphere is the screen. Earth and Moon surfaces are projected onto it and rotate through the set, which is why every review reaches for the word planetarium.' },
  { term: 'Performer position', body: 'On opening night he performed standing on top of a demi-globe, tethered at its apex.' },
  { term: 'Orientation', body: '360 degrees. There is no back of the room, which is the point of putting a sphere in the middle of a stadium instead of a proscenium at one end.' },
  { term: 'Travels', body: 'The same object went to SoFi, Istanbul, Arnhem, Tbilisi, Almaty, Soldier Field and Jakarta. Promoters in Southeast Asia sold the Jakarta date on the stage by name.' },
  { term: 'How it works', body: 'Undisclosed. The production has not published the rigging, drive or projection method, and this archive is not going to invent one.' },
];

export interface Quote {
  text: string;
  who: string;
}

export const quotes: Quote[] = [
  {
    text: 'Standing on top of the world after everything we’ve been through.',
    who: 'Ye, on the idea behind the stage',
  },
  {
    text: 'Just a vessel.',
    who: 'Aus Taylor, on his own role in designing it',
  },
];

export interface Video {
  /** YouTube id, verified from a public watch URL. */
  id: string;
  title: string;
  where: string;
  note: string;
}

/** Full-show video that exists publicly. Embeds load only when clicked. */
export const videos: Video[] = [
  {
    id: 'XcI4yndnhpM',
    title: 'YE — Full concert, Istanbul 2026 (4K60)',
    where: 'Atatürk Olympic Stadium, 30 May 2026',
    note: 'The 118,000-capacity night, shot front of house. The clearest full-length look at the sphere in daylight-to-dark.',
  },
  {
    id: 'Ga-oUBV2k0E',
    title: 'Kanye West — Istanbul full concert (live)',
    where: 'Atatürk Olympic Stadium, 30 May 2026',
    note: 'A second angle on the same show, which Ye livestreamed in full on his own YouTube channel.',
  },
];

export interface Still {
  src: string;
  alt: string;
  caption: string;
  watch: string;
}

/**
 * Real frames of the stage, served by YouTube from the two full-length uploads
 * above. `maxresdefault` is the video's own thumbnail; the numbered frames sit
 * at roughly a quarter, a half and three quarters of the way through, which is
 * how YouTube generates them.
 */
const FRAMES: { key: string; caption: string }[] = [
  { key: 'maxresdefault', caption: 'The frame YouTube uses as the thumbnail' },
  { key: 'hq1', caption: 'Roughly a quarter of the way through the set' },
  { key: 'hq2', caption: 'Around the middle of the set' },
  { key: 'hq3', caption: 'Roughly three quarters through' },
];

export const stills: Still[] = videos.flatMap((v) =>
  FRAMES.map((f) => ({
    src: `https://img.youtube.com/vi/${v.id}/${f.key}.jpg`,
    alt: `The globe stage during Ye's concert at ${v.where}`,
    caption: `${f.caption} \u00B7 ${v.where}`,
    watch: `https://www.youtube.com/watch?v=${v.id}`,
  })),
);

/** The single best frame, used as the page's backdrop. */
export const heroStill = `https://img.youtube.com/vi/${videos[0]!.id}/maxresdefault.jpg`;

/** Shows with no verified full-length upload get a search link instead of a guessed embed. */
export const videoSearches = [
  { label: 'Opening night, SoFi Stadium', q: 'Ye SoFi Stadium 2026 full concert globe stage' },
  { label: 'Soldier Field, night two — the Kid Cudi reunion', q: 'Ye Kid Cudi Soldier Field 2026 reunion' },
  { label: 'Tirana, Eagle Stadium', q: 'Ye live Tirana Albania 2026 Eagle Stadium' },
];

export const globeSources = [
  { label: 'Complex — Kanye West’s Los Angeles show featured set design by Ye and Aus Taylor', url: 'https://www.complex.com/style/a/tracewilliamcowen/kanye-west-los-angeles-show-set-design' },
  { label: 'Gadget Review — The globe stage turns SoFi Stadium into a planetary theater', url: 'https://www.gadgetreview.com/kanye-wests-globe-stage-turns-sofi-stadium-into-planetary-theater' },
  { label: 'Variety — Kanye West returns for first U.S. show since 2021: concert review', url: 'https://variety.com/2026/music/concert-reviews/kanye-west-sofi-stadium-los-angeles-concert-review-1236705686/' },
  { label: 'Deeds Magazine — The globe and the man', url: 'https://www.deedsmag.com/stories/the-globe-and-the-man-yes-los-angeles-return-was-a-visual-statement-first' },
  { label: 'Bandwagon — YE brings the Globe Stage to Jakarta', url: 'https://www.bandwagon.asia/articles/ye-kanye-west-brings-globe-stage-to-jakarta-this-october' },
];
