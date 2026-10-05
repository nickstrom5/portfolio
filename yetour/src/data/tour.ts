/**
 * YE — LIVE CONCERT TOUR 2026.
 *
 * Every field here is either (a) reported by a public source listed in
 * `sources`, or (b) explicitly marked as editorial. Nothing is invented and
 * presented as fact: setlists carry a `setlistSource` of 'reported' (a night
 * that was actually documented), 'partial' (only some songs were reported) or
 * 'reference' (no public setlist, so the page shows the tour's recurring spine
 * and says so). The UI surfaces that distinction on every show page.
 *
 * This is an unofficial fan archive. Each show carries its own source list.
 */

/* ------------------------------------------------------------------ albums */

export interface Album {
  id: string;
  title: string;
  year: number;
  /** Accent used for setlist chips. All tested against #08090a. */
  color: string;
}

export const albums = {
  bully: { id: 'bully', title: 'BULLY', year: 2026, color: '#f2ede1' },
  cd: { id: 'cd', title: 'The College Dropout', year: 2004, color: '#d9a441' },
  lr: { id: 'lr', title: 'Late Registration', year: 2005, color: '#c2564f' },
  grad: { id: 'grad', title: 'Graduation', year: 2007, color: '#b06ce0' },
  h808s: { id: 'h808s', title: '808s & Heartbreak', year: 2008, color: '#e2455f' },
  mbdtf: { id: 'mbdtf', title: 'My Beautiful Dark Twisted Fantasy', year: 2010, color: '#e0522a' },
  wtt: { id: 'wtt', title: 'Watch the Throne', year: 2011, color: '#cfa94a' },
  yeezus: { id: 'yeezus', title: 'Yeezus', year: 2013, color: '#ff3b2a' },
  tlop: { id: 'tlop', title: 'The Life of Pablo', year: 2016, color: '#f0821e' },
  ye: { id: 'ye', title: 'ye', year: 2018, color: '#57d3a5' },
  ksg: { id: 'ksg', title: 'Kids See Ghosts', year: 2018, color: '#ff9fc4' },
  jik: { id: 'jik', title: 'Jesus Is King', year: 2019, color: '#4a8bff' },
  donda: { id: 'donda', title: 'Donda', year: 2021, color: '#9aa3ad' },
  other: { id: 'other', title: 'Features & non-album', year: 0, color: '#8d949c' },
} as const satisfies Record<string, Album>;

export type AlbumId = keyof typeof albums;

/* ------------------------------------------------------------------- songs */

export interface Song {
  id: string;
  title: string;
  album: AlbumId;
  /** Credited collaborators on the recording, as printed on the release. */
  with?: string;
  /** One line of context for fans. Editorial. */
  note?: string;
}

const songList: Song[] = [
  // BULLY (2026)
  { id: 'king', title: 'KING', album: 'bully', note: 'Opening track of BULLY and, on most nights, the first thing the globe plays.' },
  { id: 'preacher-man', title: 'PREACHER MAN', album: 'bully' },
  { id: 'beauty-and-the-beast', title: 'BEAUTY AND THE BEAST', album: 'bully' },
  { id: 'ww3', title: 'WW3', album: 'bully' },
  { id: 'father', title: 'FATHER', album: 'bully', with: 'Travis Scott', note: 'Track three on BULLY; Travis Scott takes the second half live when he is in the building.' },
  { id: 'all-the-love', title: 'ALL THE LOVE', album: 'bully', with: 'André Troutman', note: 'The talk-box record. Troutman has performed it on nearly every date of the tour.' },
  { id: 'highs-and-lows', title: 'HIGHS AND LOWS', album: 'bully' },
  { id: 'last-breath', title: 'LAST BREATH', album: 'bully' },

  // Yeezus block
  { id: 'on-sight', title: 'On Sight', album: 'yeezus' },
  { id: 'black-skinhead', title: 'Black Skinhead', album: 'yeezus' },
  { id: 'new-slaves', title: 'New Slaves', album: 'yeezus' },
  { id: 'blood-on-the-leaves', title: 'Blood on the Leaves', album: 'yeezus' },
  { id: 'bound-2', title: 'Bound 2', album: 'yeezus' },

  // Chicago drill / features
  { id: 'i-dont-like', title: "I Don't Like", album: 'other', with: 'Chief Keef', note: 'The 2012 G.O.O.D. Music remix that rewired Chicago rap.' },
  { id: 'love-sosa', title: 'Love Sosa', album: 'other', with: 'Chief Keef' },
  { id: 'put-on', title: 'Put On', album: 'other', with: 'Young Jeezy', note: "Jeezy's record, but the auto-tuned third verse is one of Ye's most requested live moments." },
  { id: 'mercy', title: 'Mercy', album: 'other', with: 'Big Sean, Pusha T & 2 Chainz', note: 'From the 2012 G.O.O.D. Music compilation Cruel Summer.' },
  { id: 'american-boy', title: 'American Boy', album: 'other', with: 'Estelle', note: "Estelle's 2008 single. Ye's verse, performed as a cover." },

  // ¥$ (Ye and Ty Dolla $ign)
  { id: 'carnival', title: 'CARNIVAL', album: 'other', with: '¥$', note: 'A ¥$ record, with Ty Dolla $ign.' },
  { id: 'talking', title: 'TALKING', album: 'other', with: '¥$ & North West' },
  { id: 'everybody', title: 'EVERYBODY', album: 'other', with: '¥$' },

  // Guests' own records
  { id: 'die', title: 'D!E', album: 'other', with: 'North West', note: "North West's own record, sung by her." },
  { id: 'roll-in-peace', title: 'Roll in Peace', album: 'other', with: 'Kodak Black', note: "Kodak Black's record, performed by Kodak." },
  { id: 'no-flockin', title: 'No Flockin', album: 'other', with: 'Kodak Black', note: "Kodak Black's record, performed by Kodak." },

  // Donda
  { id: 'off-the-grid', title: 'Off the Grid', album: 'donda' },
  { id: 'praise-god', title: 'Praise God', album: 'donda' },
  { id: 'moon', title: 'Moon', album: 'donda', with: 'Don Toliver & Kid Cudi' },
  { id: 'jail', title: 'Jail', album: 'donda' },

  // Classics
  { id: 'homecoming', title: 'Homecoming', album: 'grad', note: 'Written about Chicago as a girl named Windy. It lands differently at Soldier Field.' },
  { id: 'cant-tell-me-nothing', title: "Can't Tell Me Nothing", album: 'grad' },
  { id: 'good-life', title: 'Good Life', album: 'grad' },
  { id: 'flashing-lights', title: 'Flashing Lights', album: 'grad' },
  { id: 'stronger', title: 'Stronger', album: 'grad' },
  { id: 'niggas-in-paris', title: 'Niggas in Paris', album: 'wtt', with: 'JAY-Z' },
  { id: 'jesus-walks', title: 'Jesus Walks', album: 'cd' },
  { id: 'all-falls-down', title: 'All Falls Down', album: 'cd' },
  { id: 'through-the-wire', title: 'Through the Wire', album: 'cd' },
  { id: 'touch-the-sky', title: 'Touch the Sky', album: 'lr' },
  { id: 'gold-digger', title: 'Gold Digger', album: 'lr' },
  { id: 'heartless', title: 'Heartless', album: 'h808s' },
  { id: 'love-lockdown', title: 'Love Lockdown', album: 'h808s' },
  { id: 'say-you-will', title: 'Say You Will', album: 'h808s' },
  { id: 'power', title: 'POWER', album: 'mbdtf' },
  { id: 'all-of-the-lights', title: 'All of the Lights', album: 'mbdtf' },
  { id: 'runaway', title: 'Runaway', album: 'mbdtf', note: 'The tour closer. In Istanbul it ran into a new synth outro built around a spoken-word sample of Donda West.' },
  { id: 'father-stretch', title: 'Father Stretch My Hands, Pt. 1', album: 'tlop' },
  { id: 'ultralight-beam', title: 'Ultralight Beam', album: 'tlop' },
  { id: 'famous', title: 'Famous', album: 'tlop' },
  { id: 'fade', title: 'Fade', album: 'tlop' },
  { id: 'ghost-town', title: 'Ghost Town', album: 'ye', with: '070 Shake & Kid Cudi' },
  { id: 'pursuit-of-happiness', title: 'Pursuit of Happiness', album: 'other', with: 'Kid Cudi', note: "Cudi's record from Man on the Moon. A reunion song by 2026." },
  { id: 'miss-westie', title: 'Miss Westie', album: 'other', with: 'North West' },
];

export const songs: Record<string, Song> = Object.fromEntries(songList.map((s) => [s.id, s]));

export function song(id: string): Song {
  const s = songs[id];
  if (!s) throw new Error(`Unknown song id: ${id}`);
  return s;
}

/* -------------------------------------------------------------- reference set */

export interface SetAct {
  title: string;
  subtitle: string;
  songs: string[];
}

/**
 * The tour's recurring spine, assembled only from songs that have been
 * reported at one or more 2026 dates. Shown on pages where no full setlist
 * was published, always labelled as a reference rather than a record.
 */
export const referenceSet: SetAct[] = [
  {
    title: 'Act I — The Globe',
    subtitle: 'BULLY, front to back, played inside the sphere',
    songs: ['king', 'preacher-man', 'beauty-and-the-beast', 'ww3', 'father', 'all-the-love', 'highs-and-lows', 'last-breath'],
  },
  {
    title: 'Act II — Dark Matter',
    subtitle: 'The Yeezus and Donda run, stage lit red',
    songs: ['on-sight', 'black-skinhead', 'new-slaves', 'blood-on-the-leaves', 'i-dont-like', 'love-sosa', 'off-the-grid', 'praise-god'],
  },
  {
    title: 'Act III — The Catalogue',
    subtitle: 'Twenty-two years of records, globe raised',
    songs: ['put-on', 'cant-tell-me-nothing', 'homecoming', 'niggas-in-paris', 'father-stretch', 'ghost-town', 'moon', 'flashing-lights'],
  },
  {
    title: 'Encore',
    subtitle: 'House lights down, one song',
    songs: ['runaway'],
  },
];

/* -------------------------------------------------------------------- legs */

export interface Leg {
  id: string;
  n: number;
  name: string;
  region: string;
  color: string;
  /** Editorial framing for the leg. */
  blurb: string;
}

export const legs: Leg[] = [
  { id: 'origin', n: 1, name: 'Origin', region: 'Los Angeles', color: '#f2ede1', blurb: 'Two nights at SoFi to switch the globe on for the first time. $32.6 million between them, and a decade of not touring ended in one weekend.' },
  { id: 'east', n: 2, name: 'Due East', region: 'India · Türkiye · Netherlands · France · Georgia · Poland', color: '#ff3b2a', blurb: 'A world stadium record in Istanbul, then Arnhem and Tbilisi — with New Delhi, Marseille and Chorzów lost around them before a ticket was scanned.' },
  { id: 'independence', n: 3, name: 'Independence', region: 'Florida · Texas', color: '#d9a441', blurb: 'Three American stadium nights in the middle of the European summer: two at Raymond James in Tampa, then the Fourth of July in San Antonio.' },
  { id: 'borders', n: 4, name: 'Borders', region: 'Albania · UK · Italy · Czechia · Spain · Portugal', color: '#b06ce0', blurb: 'The most contested stretch of the year: London, Reggio Emilia and Prague lost, and three shows played to the biggest crowds those countries had seen.' },
  { id: 'steppe', n: 5, name: 'Steppe', region: 'Kazakhstan', color: '#57d3a5', blurb: 'Almaty, under the Tian Shan mountains, a day later than advertised.' },
  { id: 'homecoming', n: 6, name: 'Homecoming', region: 'Louisiana · Illinois', color: '#e0522a', blurb: 'The Superdome for the first time in thirteen years, then two nights on the lakefront in the city that made him.' },
  { id: 'neva', n: 7, name: 'Neva', region: 'Russia', color: '#9fb8d9', blurb: 'Two nights at Gazprom Arena, disowned by the venue in August and cancelled at the end of September. The one leg of the tour that never happened.' },
  { id: 'equator', n: 8, name: 'Equator', region: 'Indonesia', color: '#4a8bff', blurb: 'One date in Southeast Asia. Gelora Bung Karno, the biggest stadium in the region.' },
  { id: 'finale', n: 9, name: 'Finale', region: 'Texas · Arizona', color: '#e2455f', blurb: 'Halloween in Houston, Arlington a week later, and the globe powered down for good in Glendale.' },
];

export const legsById: Record<string, Leg> = Object.fromEntries(legs.map((l) => [l.id, l]));

/* ------------------------------------------------------------------- shows */

export type ShowStatus = 'played' | 'upcoming' | 'cancelled';
export type SetlistSource = 'reported' | 'partial' | 'reference';

export interface Source {
  label: string;
  url: string;
}

export interface Show {
  slug: string;
  /** Position in the announced itinerary, cancellations included. */
  n: number;
  /** ISO date of the performance as it stands today. */
  date: string;
  /** Date originally advertised, when it differs from `date`. */
  originalDate?: string;
  city: string;
  /** State, province or metro qualifier. Optional. */
  area?: string;
  country: string;
  countryCode: string;
  venue: string;
  /** Venue capacity in its normal configuration, for scale only. */
  capacity?: number;
  /** Reported attendance for this specific night. */
  attendance?: number;
  /** Reported box office for this night or its run. */
  gross?: string;
  continent: 'North America' | 'Europe' | 'Asia';
  leg: string;
  status: ShowStatus;
  /** Why a date is not being played. */
  statusNote?: string;
  coords: [number, number];
  doors?: string;
  onstage?: string;
  offstage?: string;
  runtime?: string;
  /** Pull quote / headline fact for the card and the page hero. */
  headline: string;
  /** Editorial write-up. Each paragraph is one string. */
  story: string[];
  guests: string[];
  /** Verified YouTube uploads of this date. The first supplies the page's stills. */
  videos?: { id: string; label: string }[];
  /** Song ids confirmed played at this date. */
  reported: string[];
  setlistSource: SetlistSource;
  /** Extra bullets: production, tickets, records. */
  facts?: string[];
  sources: Source[];
}

export const shows: Show[] = [
  {
    slug: 'inglewood-2026-04-01',
    n: 1,
    date: '2026-04-01',
    city: 'Inglewood',
    area: 'California',
    country: 'United States',
    countryCode: 'US',
    venue: 'SoFi Stadium',
    capacity: 70000,
    continent: 'North America',
    leg: 'origin',
    status: 'played',
    coords: [33.9535, -118.3387],
    headline: 'Opening night. The first Ye tour date in a decade.',
    story: [
      'The Ye Live Concert Tour opened at SoFi Stadium on 1 April 2026, ten years after the Saint Pablo Tour and four days after BULLY arrived through YZY and Gamma. Nobody in the building had seen the stage before doors.',
      'What they got was a sphere. Ye built the show with production designer Aus Taylor around a single spinning globe that doubles as the stage and the screen, projecting Earth and Moon surfaces across two hours while it rotates above the floor.',
      'André Troutman brought the talk-box out for the BULLY material, Don Toliver came out for "Moon", and North West performed "Miss Westie" with her father. The two SoFi nights grossed $32.6 million between them — $16.3 million a night, the highest-grossing concerts any rapper has played.',
    ],
    guests: ['André Troutman', 'Don Toliver', 'North West'],
    videos: [{ id: 'Q6rkDTShjEY', label: 'Opening night, 1 April' }],
    reported: ['moon', 'miss-westie'],
    setlistSource: 'partial',
    facts: [
      'First Ye headline tour date since the Saint Pablo Tour in 2016.',
      'BULLY, his twelfth studio album, had been out four days.',
      '$32.6 million across the two nights, $16.3 million each — the highest-grossing concerts in touring history by any rapper.',
    ],
    sources: [
      { label: 'Billboard — Ye’s 2026 BULLY setlist, night 1 at SoFi Stadium', url: 'https://www.billboard.com/lists/yes-2026-bully-concert-setlist-night-1-sofi-stadium/' },
      { label: 'setlist.fm — SoFi Stadium, 1 April 2026', url: 'https://www.setlist.fm/setlist/ye/2026/sofi-stadium-inglewood-ca-5349a3bd.html' },
      { label: 'Ratings Game Music — Ye sets touring history with record-breaking SoFi Stadium concerts', url: 'https://ratingsgamemusic.com/2026/07/24/ye-sofi-stadium-touring-record-2026/' },
    ],
  },
  {
    slug: 'inglewood-2026-04-03',
    n: 2,
    date: '2026-04-03',
    city: 'Inglewood',
    area: 'California',
    country: 'United States',
    countryCode: 'US',
    venue: 'SoFi Stadium',
    capacity: 70000,
    gross: '$16,300,000 (single night)',
    continent: 'North America',
    leg: 'origin',
    status: 'played',
    coords: [33.9535, -118.3387],
    headline: 'Travis Scott, CeeLo Green and Ms. Lauryn Hill in one night.',
    story: [
      'Night two at SoFi is the one people still argue about. Travis Scott came out for "FATHER", the BULLY record he features on. CeeLo Green appeared. So did Ms. Lauryn Hill, whose catalogue Ye has sampled and cited since The College Dropout.',
      'North West performed again. Each of the two SoFi nights grossed $16.3 million, which Billboard\u2019s Boxscore report put at the top of the all-time list for a rapper.',
      'It also set the template the rest of the year followed: a fixed spine of BULLY and Yeezus material, and a guest list built city by city.',
    ],
    guests: ['Travis Scott', 'North West', 'CeeLo Green', 'Ms. Lauryn Hill'],
    videos: [{ id: 'hWCARfMBJJ4', label: 'Night two, full set' }, { id: 'PIb3_PWyInM', label: 'Floor view, 4K' }],
    reported: ['father', 'miss-westie'],
    setlistSource: 'partial',
    facts: [
      '$16.3 million for the night, part of a $32.6 million two-night run.',
      'Travis Scott performed "FATHER", the BULLY track he appears on.',
    ],
    sources: [
      { label: 'setlist.fm — SoFi Stadium, 3 April 2026', url: 'https://www.setlist.fm/setlist/ye/2026/sofi-stadium-inglewood-ca-73484685.html' },
      { label: 'Ratings Game Music — Ye sets touring history with record-breaking SoFi Stadium concerts', url: 'https://ratingsgamemusic.com/2026/07/24/ye-sofi-stadium-touring-record-2026/' },
    ],
  },
  {
    slug: 'new-delhi-2026-05-23',
    n: 3,
    date: '2026-05-23',
    originalDate: '2026-03-29',
    city: 'New Delhi',
    country: 'India',
    countryCode: 'IN',
    venue: 'Jawaharlal Nehru Stadium',
    continent: 'Asia',
    leg: 'east',
    status: 'cancelled',
    statusNote: 'Called off on 15 May by the promoter, White Fox, "due to directives received from the authorities". Ticket holders were refunded in full.',
    coords: [28.5828, 77.2344],
    headline: 'His first show in India, moved once and then called off eight days out.',
    story: [
      'Ye was booked for his first concert in India at Jawaharlal Nehru Stadium, promoted by White Fox and ticketed through the District app. It was first advertised for 29 March, three days before the tour opened at SoFi, and was pushed back to 23 May as tensions in the region rose.',
      'On 15 May, with the capital on high alert, White Fox called the rescheduled date off "due to directives received from the authorities". The show was close to sold out, with tickets up to ₹30,000, and refunds went back to the original payment method.',
      'The promoter said at the time that it was working with Ye on a new date and venue in India.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: [
      'Would have been his first concert in India.',
      'Originally 29 March, moved to 23 May, cancelled on 15 May.',
      'Nearly sold out; full refunds through District.',
    ],
    sources: [
      { label: 'Republic World — Delhi concert cancelled after being postponed once, refunds initiated', url: 'https://www.republicworld.com/entertainment/awards-events/breaking-kanye-west-delhi-concert-cancelled-after-being-postponed-once-district-initiates-refunds-2026-05-15-124393' },
      { label: 'Complex — New Delhi concert canceled over security concerns', url: 'https://www.complex.com/music/a/markelibert/kanye-west-new-delhi-concert-canceled-security' },
      { label: 'Esquire India — India concert postponed to May', url: 'https://www.esquireindia.co.in/culture/books-and-music/kanye-west-concert-postponed' },
    ],
  },
  {
    slug: 'istanbul-2026-05-30',
    n: 4,
    date: '2026-05-30',
    city: 'Istanbul',
    country: 'Türkiye',
    countryCode: 'TR',
    venue: 'Atatürk Olympic Stadium',
    capacity: 76092,
    attendance: 118000,
    continent: 'Europe',
    leg: 'east',
    status: 'played',
    coords: [41.0745, 28.7669],
    headline: '118,000 people. A claimed world stadium record and the largest show of his career.',
    story: [
      'Istanbul is the number the rest of the tour is measured against. 118,000 people inside the Atatürk Olympic Stadium — a record attendance for the venue, billed as a world stadium record, and the largest crowd Ye has ever performed to.',
      'It drew fans from across Europe, including from countries where he had been barred from appearing at all. The whole set was livestreamed on his YouTube channel, which is why this night is better documented than most of the tour.',
      'André Troutman worked the talk-box again. The show closed on "Runaway" with a new extended synth outro built around a spoken-word sample of Donda West — an ending that stayed in the set for the rest of the year.',
    ],
    guests: ['André Troutman'],
    videos: [{ id: 'XcI4yndnhpM', label: 'Full concert, 4K60' }, { id: 'Ga-oUBV2k0E', label: 'Second angle' }],
    reported: ['runaway'],
    setlistSource: 'partial',
    facts: [
      'Reported attendance of 118,000 — a record for the venue and the biggest crowd of Ye’s career.',
      'Livestreamed in full on Ye’s official YouTube channel.',
      '"Runaway" closed with a newly extended outro sampling Donda West’s spoken word.',
    ],
    sources: [
      { label: 'Billboard — Ye draws 118,000 to Istanbul, claims world stadium record', url: 'https://www.billboard.com/music/rb-hip-hop/kanye-west-istanbul-stadium-record-1236260907/' },
      { label: 'Variety — Kanye West to kick off summer tour in Istanbul', url: 'https://variety.com/2026/music/global/kanye-west-tour-istanbul-uk-france-ban-1236762096/' },
      { label: 'setlist.fm — Atatürk Olympic Stadium, 30 May 2026', url: 'https://www.setlist.fm/setlist/ye/2026/ataturk-olympic-stadium-istanbul-turkey-7b4b9e18.html' },
    ],
  },
  {
    slug: 'arnhem-2026-06-06',
    n: 5,
    date: '2026-06-06',
    city: 'Arnhem',
    country: 'Netherlands',
    countryCode: 'NL',
    venue: 'GelreDome',
    capacity: 34000,
    continent: 'Europe',
    leg: 'east',
    status: 'played',
    coords: [51.9633, 5.8926],
    headline: 'The globe under a closed roof, twice in three days.',
    story: [
      'GelreDome is the smallest room the tour played in 2026 and the only one with a retractable roof, which meant the sphere was working against a ceiling rather than an open sky for the first time.',
      'The Netherlands became the practical base for the European summer: with the UK closed to him and Italy cancelling, Arnhem was where a large share of Western European ticket-holders ended up travelling.',
      'Two dates, 6 and 8 June, both with the standard BULLY-forward running order.',
    ],
    guests: [],
    videos: [{ id: 'dDOCrJ0T6yQ', label: 'Full set, GelreDome' }, { id: 'cY1qmPcKmmQ', label: 'Second angle' }],
    reported: [],
    setlistSource: 'reference',
    facts: ['Smallest venue on the 2026 itinerary.', 'One of two Arnhem dates, 6 and 8 June.'],
    sources: [
      { label: 'Ticketmaster NL — Ye tour dates', url: 'https://www.ticketmaster.nl/artist/ye-tickets/24556?language=en-us' },
    ],
  },
  {
    slug: 'arnhem-2026-06-08',
    n: 6,
    date: '2026-06-08',
    city: 'Arnhem',
    country: 'Netherlands',
    countryCode: 'NL',
    venue: 'GelreDome',
    capacity: 34000,
    continent: 'Europe',
    leg: 'east',
    status: 'played',
    coords: [51.9633, 5.8926],
    headline: 'Second Dutch night, and the last European date before the Caucasus.',
    story: [
      'The second GelreDome show closed the Dutch run. Four days later the production was in Tbilisi, a routing decision no other stadium act made in 2026.',
      'Arnhem is where the tour settled into the shape it kept: BULLY in sequence inside the globe, the Yeezus block in red, the catalogue with the sphere raised, and "Runaway" alone at the end.',
    ],
    guests: [],
    videos: [{ id: 'wSthEnhRgOE', label: 'Night two, GelreDome' }],
    reported: [],
    setlistSource: 'reference',
    facts: ['Final Western European date before the tour turned east.'],
    sources: [
      { label: 'Ticketmaster NL — Ye tour dates', url: 'https://www.ticketmaster.nl/artist/ye-tickets/24556?language=en-us' },
    ],
  },
  {
    slug: 'marseille-2026-06-11',
    n: 7,
    date: '2026-06-11',
    city: 'Marseille',
    country: 'France',
    countryCode: 'FR',
    venue: 'Orange Vélodrome',
    continent: 'Europe',
    leg: 'east',
    status: 'cancelled',
    statusNote: 'Postponed by Ye "until further notice" in April 2026, while the French government was looking at ways to ban the concert.',
    coords: [43.2698, 5.3959],
    headline: 'Postponed "until further notice" before France could ban it.',
    story: [
      'The French date was set for 11 June at the Orange Vélodrome, home of Olympique de Marseille. In March the city’s mayor, Benoît Payan, said he would not let Marseille become "a showcase for those who promote hatred and unapologetic Nazism", and Interior Minister Laurent Nuñez began looking at ways to block the show.',
      'In mid-April, before any ban was issued, Ye postponed it himself: "After much thought and consideration, it is my sole decision to postpone my show in Marseille, France until further notice."',
      'It followed the United Kingdom’s decision to refuse him entry, and came days before the Polish date went the same way.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: [
      'Postponed by Ye himself, not by a promoter or the state.',
      'Marseille’s mayor and France’s interior minister had both opposed the show.',
    ],
    sources: [
      { label: 'France 24 — Kanye West pulls plug on Marseille concert, postpones until further notice', url: 'https://www.france24.com/en/culture/20260415-kanye-west-pulls-plug-on-marseille-concert-postpones-until-further-notice' },
      { label: 'Deadline — Kanye West postpones French concert in face of possible government ban', url: 'https://deadline.com/2026/04/kanye-west-postpones-marseille-france-concert-1236861192/' },
    ],
  },
  {
    slug: 'tbilisi-2026-06-12',
    n: 8,
    date: '2026-06-12',
    city: 'Tbilisi',
    country: 'Georgia',
    countryCode: 'GE',
    venue: 'Boris Paichadze Dinamo Arena',
    capacity: 54549,
    continent: 'Europe',
    leg: 'east',
    status: 'played',
    coords: [41.7231, 44.7889],
    headline: 'The first stadium show of this scale Georgia has hosted.',
    story: [
      'Dinamo Arena has held European football finals, but not a touring production of this size. Ye played it on 12 June 2026, part of a run through countries that almost never appear on a stadium itinerary — Georgia, Albania and Kazakhstan inside ten weeks.',
      'The routing was not an accident. With the United Kingdom refusing entry and the French and Polish dates gone by mid-April, the map for 2026 was drawn by which governments would have him.',
    ],
    guests: [],
    videos: [{ id: 'uXgnuIN1jhw', label: 'Full concert, Dinamo Arena' }, { id: '8kKsWHkAF1I', label: '\u201CHeartless\u201D with the crowd' }],
    reported: [],
    setlistSource: 'reference',
    facts: ['One of nine countries visited on the tour’s international run.'],
    sources: [
      { label: 'Billboard — Ye announces a trio of new U.S. stadium shows', url: 'https://www.billboard.com/music/rb-hip-hop/kanye-west-us-tour-stadium-shows-dallas-houston-phoenix-1236331481/' },
    ],
  },
  {
    slug: 'chorzow-2026-06-19',
    n: 9,
    date: '2026-06-19',
    city: 'Chorzów',
    country: 'Poland',
    countryCode: 'PL',
    venue: 'Silesian Stadium',
    capacity: 85000,
    continent: 'Europe',
    leg: 'east',
    status: 'cancelled',
    statusNote: 'Cancelled by the stadium on 17 April for "formal-legal reasons", after Poland’s culture minister threatened to have him barred from the country.',
    coords: [50.2895, 18.9906],
    headline: 'Announced and cancelled inside two days.',
    story: [
      'The Polish date at the Silesian Stadium in Chorzów, an 85,000-capacity ground, was added on 15 April. Culture Minister Marta Cienkowska said straight away that she would ask the interior minister to bar Ye from entering Poland if it went ahead: "In a country scarred by the history of the Holocaust, we cannot pretend that this is just entertainment."',
      'Foreign Minister Radosław Sikorski backed her publicly, and on 17 April the stadium cancelled the concert for what it called "formal-legal reasons".',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: [
      'Two days from announcement to cancellation.',
      'The government threatened an entry ban; the venue cancelled before one was needed.',
    ],
    sources: [
      { label: 'Notes from Poland — concert cancelled following government threat to ban entry', url: 'https://notesfrompoland.com/2026/04/17/kanye-west-concert-cancelled-in-poland-following-government-threat-to-ban-entry/' },
      { label: 'Billboard — Poland show canceled after Polish minister speaks out', url: 'https://www.billboard.com/music/rb-hip-hop/kanye-west-poland-show-canceled-polish-minister-speaks-out-1236225172/' },
      { label: 'Consequence — Kanye West’s concert in Poland canceled', url: 'https://consequence.net/2026/04/kanye-west-concert-poland-canceled/' },
    ],
  },
  {
    slug: 'tampa-2026-06-26',
    n: 10,
    date: '2026-06-26',
    city: 'Tampa',
    area: 'Florida',
    country: 'United States',
    countryCode: 'US',
    venue: 'Raymond James Stadium',
    attendance: 63200,
    continent: 'North America',
    leg: 'independence',
    status: 'played',
    coords: [27.9759, -82.5033],
    headline: 'Tampa, night one. Thirty-five songs from the top of the globe.',
    story: [
      'His first Tampa show in nearly ten years, played over a petition led by U.S. Senator Rick Scott that had passed 11,000 signatures asking the Tampa Sports Authority to cancel. The authority said its contract did not let it cancel over an artist’s "prior public statements" or "political viewpoints".',
      'Doors at 17:55, onstage at 21:00, off at 22:50. Ye spent the whole set on top of the globe, high enough to look the 200 level in the eye. "Fade" made its tour debut, André Troutman took the talk box through "Say You Will", "Heartless", "ALL THE LOVE" and "Stronger", and "Runaway" closed on an AKAI MPC with the "MAMA’S FAVORITE" sample of Donda West as its outro.',
      'The Tampa Sports Authority later put the night’s attendance at 63,200.',
    ],
    guests: ['André Troutman'],
    videos: [{ id: 'rqOlvEBK4o4', label: 'Full show, 4K60' }],
    reported: [
      'king', 'father-stretch', 'cant-tell-me-nothing', 'niggas-in-paris', 'mercy', 'praise-god', 'black-skinhead',
      'on-sight', 'blood-on-the-leaves', 'carnival', 'power', 'bound-2', 'fade', 'say-you-will', 'heartless',
      'all-the-love', 'highs-and-lows', 'beauty-and-the-beast', 'father', 'everybody', 'famous', 'all-falls-down',
      'jesus-walks', 'through-the-wire', 'gold-digger', 'touch-the-sky', 'american-boy', 'good-life', 'homecoming',
      'all-of-the-lights', 'flashing-lights', 'stronger', 'ghost-town', 'moon', 'runaway',
    ],
    setlistSource: 'reported',
    doors: '17:55',
    onstage: '21:00',
    offstage: '22:50',
    runtime: '1h 50m',
    facts: [
      '"Fade" made its 2026 tour debut.',
      'Doors 17:55, onstage 21:00, off 22:50.',
      'Attendance of 63,200, per the Tampa Sports Authority.',
      'Went ahead despite a petition led by Senator Rick Scott with more than 11,000 signatures.',
    ],
    sources: [
      { label: 'setlist.fm — Raymond James Stadium, 26 June 2026', url: 'https://www.setlist.fm/setlist/ye/2026/raymond-james-stadium-tampa-fl-33745801.html' },
      { label: 'Tampa Bay Times — Review: at Ye’s Tampa concert, the rapper is still on top of the world', url: 'https://www.tampabay.com/culture/entertainment/music/music-reviews/2026/06/27/ye-tampa-review-kanye-west-setlist-florida-concerts-raymond-james-stadium-rick-scott/' },
      { label: 'FOX 13 — Ye takes stage at Raymond James despite backlash, calls to cancel', url: 'https://www.fox13news.com/news/ye-concert-rick-scott-petition-signatures-tampa-shows' },
      { label: 'HotNewHipHop — Tampa shows lead to massive profits for the Tampa Sports Authority', url: 'https://www.hotnewhiphop.com/1005380-kanye-west-tampa-sports-authority-profit' },
    ],
  },
  {
    slug: 'tampa-2026-06-28',
    n: 11,
    date: '2026-06-28',
    city: 'Tampa',
    area: 'Florida',
    country: 'United States',
    countryCode: 'US',
    venue: 'Raymond James Stadium',
    attendance: 56000,
    continent: 'North America',
    leg: 'independence',
    status: 'played',
    coords: [27.9759, -82.5033],
    headline: 'North West and Kodak Black on the globe.',
    story: [
      'The second Tampa night was added in May, after the presale for the first drew a queue reported at a million people.',
      'Kodak Black, from South Florida, came out for a mini-set of "Roll in Peace" and "No Flockin", and North West sang lead on "TALKING" and her own "D!E". André Troutman worked the talk box all night and played a new outro on "Stronger".',
      'Across the two nights the Tampa Sports Authority counted 119,200 people and took $3.44 million, against the $2 million it had projected.',
    ],
    guests: ['André Troutman', 'Kodak Black', 'North West'],
    videos: [{ id: 'fuu2FAl2-kY', label: 'Night two, full show' }],
    reported: [
      'king', 'father-stretch', 'cant-tell-me-nothing', 'niggas-in-paris', 'mercy', 'praise-god', 'black-skinhead',
      'on-sight', 'blood-on-the-leaves', 'carnival', 'power', 'bound-2', 'fade', 'say-you-will', 'roll-in-peace',
      'no-flockin', 'heartless', 'all-the-love', 'highs-and-lows', 'beauty-and-the-beast', 'father', 'talking',
      'die', 'everybody', 'famous', 'jesus-walks', 'all-falls-down', 'through-the-wire', 'gold-digger',
      'touch-the-sky', 'american-boy', 'good-life', 'homecoming', 'all-of-the-lights', 'flashing-lights', 'stronger',
      'runaway',
    ],
    setlistSource: 'reported',
    facts: [
      'Kodak Black mini-set: "Roll in Peace" and "No Flockin".',
      'North West on "TALKING" and "D!E".',
      'Attendance of 56,000; 119,200 across both nights, per the Tampa Sports Authority.',
      '$3.44 million to the Tampa Sports Authority for the run, against a $2 million projection.',
    ],
    sources: [
      { label: 'setlist.fm — Raymond James Stadium, 28 June 2026', url: 'https://www.setlist.fm/setlist/ye/2026/raymond-james-stadium-tampa-fl-237598af.html' },
      { label: 'Tampa Bay Times — Ye brought daughter North West, Kodak Black onstage Sunday in Tampa', url: 'https://www.tampabay.com/life-culture/music/2026/06/29/ye-brought-daughter-north-west-kodak-black-onstage-sunday-tampa/' },
      { label: 'WSVN — Kanye West, North West and Kodak Black star in two Tampa concerts', url: 'https://wsvn.com/entertainment/deco-drive/kanye-west-north-west-and-kodak-black-star-in-two-tampa-concerts/' },
      { label: 'HotNewHipHop — 1 million people in the queue for the Tampa show', url: 'https://www.hotnewhiphop.com/996276-kanye-west-tampa-ticket-queue' },
      { label: 'HotNewHipHop — Tampa shows lead to massive profits for the Tampa Sports Authority', url: 'https://www.hotnewhiphop.com/1005380-kanye-west-tampa-sports-authority-profit' },
    ],
  },
  {
    slug: 'san-antonio-2026-07-04',
    n: 12,
    date: '2026-07-04',
    city: 'San Antonio',
    area: 'Texas',
    country: 'United States',
    countryCode: 'US',
    venue: 'Alamodome',
    capacity: 64000,
    attendance: 60000,
    gross: 'over $9,000,000',
    continent: 'North America',
    leg: 'independence',
    status: 'played',
    coords: [29.4169, -98.4791],
    headline: 'Fourth of July. 60,000 tickets and more than $9 million.',
    story: [
      'A week after Tampa, one more American date in the middle of the European summer, booked for Independence Day at the Alamodome. It sold over 60,000 tickets and grossed more than $9 million.',
      'The pyrotechnic package that the stadium shows had been carrying since April made more sense on 4 July than on any other night of the year.',
    ],
    guests: [],
    videos: [{ id: 'iV1rbWpln6Y', label: 'Full concert, Alamodome' }, { id: 'VXshmjsiXSg', label: 'Second angle' }],
    reported: [],
    setlistSource: 'reference',
    facts: ['Over 60,000 tickets sold.', 'More than $9 million in ticket sales.', 'The last of three U.S. stadium nights between April and August, after Tampa.'],
    sources: [
      { label: 'setlist.fm — Alamodome, 4 July 2026', url: 'https://www.setlist.fm/setlist/ye/2026/alamodome-san-antonio-tx-5372a755.html' },
    ],
  },
  {
    slug: 'tirana-2026-07-11',
    n: 13,
    date: '2026-07-11',
    city: 'Tirana',
    country: 'Albania',
    countryCode: 'AL',
    venue: 'Eagle Stadium (temporary build, Kashar)',
    capacity: 60000,
    continent: 'Europe',
    leg: 'borders',
    status: 'played',
    coords: [41.3529, 19.7106],
    headline: 'A 60,000-capacity stadium built from nothing for one night.',
    story: [
      'Albania did not have a venue that could hold this show, so one was built. Eagle Stadium was a temporary structure raised in the Kashar area along the Tirana–Durrës axis, with room for around 60,000 people, put up for a single concert.',
      'The national tourism agency promoted it as the largest music event of the Albanian summer. For a country of under three million, a one-night 60,000-capacity build is a reasonable claim.',
    ],
    guests: [],
    videos: [{ id: '8Eytyjh74BA', label: 'Full show, 4K UHD' }, { id: 'XINAqv9Dtmk', label: 'Second angle' }],
    reported: [],
    setlistSource: 'reference',
    facts: [
      'Eagle Stadium was a purpose-built temporary venue, not a permanent one.',
      'Capacity of roughly 60,000 for a single date.',
      'Promoted by Albania’s national tourism agency as the summer’s biggest music event.',
    ],
    sources: [
      { label: 'Albanian National Tourism Agency — Ye Live in Albania', url: 'https://akt.gov.al/en/ye-live-in-albania-koncerti-me-i-madh-muzikor-i-veres-vjen-ne-eagle-stadium/' },
    ],
  },
  {
    slug: 'london-2026-07-12',
    n: 14,
    date: '2026-07-12',
    city: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    venue: 'Wireless Festival, Finsbury Park',
    continent: 'Europe',
    leg: 'borders',
    status: 'cancelled',
    statusNote: 'The UK revoked his authorisation to enter the country in April 2026. Wireless was cancelled.',
    coords: [51.5662, -0.0958],
    headline: 'Three headline nights at Wireless, cancelled when the UK revoked his entry.',
    story: [
      'Ye had been announced to headline three nights of Wireless Festival 2026 in London. In April 2026 the United Kingdom revoked his authorisation to enter the country, which removed the festival’s headliner and led to the event being cancelled outright.',
      'It is the single largest thing the tour lost. The UK ban is also part of why the Istanbul show drew the crowd it did: fans travelled from countries where he could no longer appear.',
      'This page exists because the date was announced and sold. It was never played.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    sources: [
      { label: 'Billboard — Ye to headline three nights at Wireless Fest 2026 in London', url: 'https://www.billboard.com/music/rb-hip-hop/kanye-west-ye-wireless-fest-london-2026-1236210378/' },
      { label: 'Variety — UK entry revoked ahead of the summer tour', url: 'https://variety.com/2026/music/global/kanye-west-tour-istanbul-uk-france-ban-1236762096/' },
    ],
  },
  {
    slug: 'reggio-emilia-2026-07-18',
    n: 15,
    date: '2026-07-18',
    city: 'Reggio Emilia',
    country: 'Italy',
    countryCode: 'IT',
    venue: 'RCF Arena — Hellwatt Festival',
    continent: 'Europe',
    leg: 'borders',
    status: 'cancelled',
    statusNote: 'Cancelled by Italian authorities.',
    coords: [44.6979, 10.6306],
    headline: 'Cancelled by Italian authorities weeks before the gate.',
    story: [
      'The Italian date was booked at the RCF Arena in Reggio Emilia — the Campovolo site, one of the largest open-air concert grounds in Europe — as part of the Hellwatt Festival.',
      'Italian authorities cancelled the 18 July concert. It is one of several 2026 dates lost to official pressure, from New Delhi in May to Saint Petersburg in October.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    sources: [
      { label: 'Billboard — Kanye West Italy concert coming in 2026 to Hellwatt Festival', url: 'https://www.billboard.com/music/rb-hip-hop/kanye-west-italy-concert-hellwatt-festival-1236142951/' },
    ],
  },
  {
    slug: 'prague-2026-07-25',
    n: 16,
    date: '2026-07-25',
    city: 'Prague',
    country: 'Czechia',
    countryCode: 'CZ',
    venue: 'Velká Chuchle Racecourse',
    continent: 'Europe',
    leg: 'borders',
    status: 'cancelled',
    statusNote: 'Cancelled in June, when the racecourse’s owner terminated the organiser’s contract.',
    coords: [50.0186, 14.3886],
    headline: 'A racecourse date, cancelled when the venue walked away.',
    story: [
      'The Czech date was booked for 25 July at the Velká Chuchle racecourse on the southern edge of Prague, organised by the Slovak producer Hugo Varga, who had booked Ye once before for a rap festival in Slovakia that was cancelled after local protests.',
      'In June the racecourse’s owner, Zuzana Rambová, terminated Varga’s contract. She did not give a single reason, said the organiser had been hard to reach and unable to answer questions about the event, and added that Ye should still be free to perform.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: [
      'Cancelled by the venue owner, not by the state.',
      'The organiser’s earlier Slovak festival booking of Ye had also been cancelled.',
    ],
    sources: [
      { label: 'Digital Music News — Kanye West concert cancelled in Prague', url: 'https://www.digitalmusicnews.com/2026/06/12/kanye-west-concert-cancelled-in-prague/' },
      { label: 'Complex — Prague concert cancelled after arena terminates contract', url: 'https://www.complex.com/music/a/markelibert/kanye-west-prague-concert-cancelled-venue-terminates-deal' },
      { label: 'Balkan Insight — Kanye concert in Prague puts spotlight on tensions over freedom of expression', url: 'https://balkaninsight.com/2026/05/11/kanye-concert-in-prague-puts-spotlight-on-tensions-over-freedom-of-expression/rd/' },
    ],
  },
  {
    slug: 'madrid-2026-07-30',
    n: 17,
    date: '2026-07-30',
    city: 'Madrid',
    country: 'Spain',
    countryCode: 'ES',
    venue: 'Riyadh Air Metropolitano',
    capacity: 70460,
    continent: 'Europe',
    leg: 'borders',
    status: 'played',
    coords: [40.4362, -3.5995],
    headline: 'Doors at 18:30, onstage at 21:20, off at 23:15.',
    story: [
      'Madrid went ahead where London, Reggio Emilia and Prague did not. The Metropolitano opened at 18:30, the show was scheduled for 21:00, and Ye walked on at 21:20 for a set of one hour fifty-five minutes.',
      'Those twenty minutes are worth noting: for a tour with this reputation, the 2026 dates ran close to schedule almost everywhere.',
    ],
    guests: [],
    videos: [{ id: 'L-1GPMf8Wdo', label: 'Full concert, 4K' }, { id: '8Dm5-DMGmw8', label: 'Complete live set' }],
    reported: [],
    setlistSource: 'reference',
    doors: '18:30',
    onstage: '21:20',
    offstage: '23:15',
    runtime: '1h 55m',
    facts: ['Scheduled for 21:00, onstage at 21:20.', 'Set length of 1 hour 55 minutes.'],
    sources: [
      { label: 'setlist.fm — Riyadh Air Metropolitano, 30 July 2026', url: 'https://www.setlist.fm/setlist/ye/2026/riyadh-air-metropolitano-madrid-spain-7b4876e0.html' },
    ],
  },
  {
    slug: 'algarve-2026-08-07',
    n: 18,
    date: '2026-08-07',
    city: 'Almancil',
    area: 'Algarve',
    country: 'Portugal',
    countryCode: 'PT',
    venue: 'Estádio Algarve',
    capacity: 30305,
    attendance: 34000,
    continent: 'Europe',
    leg: 'borders',
    status: 'played',
    coords: [37.0936, -8.0003],
    headline: '34,000 in a 30,000-seat stadium, onstage 45 minutes late.',
    story: [
      'The Algarve show drew around 34,000 people to a stadium built for 30,305 — the summer-holiday coast absorbing a stadium tour it had no business hosting.',
      'Doors at 17:00, scheduled 21:00, onstage 21:45, off at 23:35. A hundred and ten minutes, the shortest fully documented set of the European summer.',
    ],
    guests: [],
    videos: [{ id: 'E7W2iOTqros', label: 'Full show, Est\u00e1dio Algarve' }, { id: '-kI1EeHH66Y', label: 'Second angle' }],
    reported: [],
    setlistSource: 'reference',
    doors: '17:00',
    onstage: '21:45',
    offstage: '23:35',
    runtime: '1h 50m',
    facts: ['Around 34,000 in attendance.', 'Onstage 45 minutes after the scheduled start.'],
    sources: [
      { label: 'setlist.fm — Estádio Algarve, 7 August 2026', url: 'https://www.setlist.fm/setlist/ye/2026/estadio-algarve-almancil-portugal-33496015.html' },
    ],
  },
  {
    slug: 'almaty-2026-08-15',
    n: 19,
    date: '2026-08-15',
    originalDate: '2026-08-14',
    city: 'Almaty',
    country: 'Kazakhstan',
    countryCode: 'KZ',
    venue: 'Almaty Central Stadium',
    capacity: 23804,
    continent: 'Asia',
    leg: 'steppe',
    status: 'played',
    coords: [43.2352, 76.9292],
    headline: 'Pushed a day by weather. The only Central Asian date.',
    story: [
      'Almaty was advertised for 14 August and moved to the 15th over weather concerns.',
      'Almaty Central Stadium holds under 24,000, which makes this the most intimate ticket of 2026 by a wide margin. The globe had to be rigged into a footprint roughly a third the size of SoFi’s.',
    ],
    guests: [],
    videos: [{ id: 'UkAelYC4Icc', label: 'Full concert, Almaty' }],
    reported: [],
    setlistSource: 'reference',
    facts: [
      'Postponed from 14 to 15 August because of weather.',
      'Smallest-capacity stadium on the itinerary at 23,804.',
      'Ye’s only Central Asian date.',
    ],
    sources: [
      { label: 'setlist.fm — Almaty Central Stadium, 15 August 2026', url: 'https://www.setlist.fm/setlist/ye/2026/almaty-central-stadium-almaty-kazakhstan-33737cf9.html' },
      { label: 'Tengrinews — information about Kanye West’s concert in Almaty', url: 'https://en.tengrinews.kz/curious/information-about-kanye-wests-concert-in-almaty-has-emerged-272312/' },
    ],
  },
  {
    slug: 'new-orleans-2026-08-28',
    n: 20,
    date: '2026-08-28',
    city: 'New Orleans',
    area: 'Louisiana',
    country: 'United States',
    countryCode: 'US',
    venue: 'Caesars Superdome',
    capacity: 73208,
    continent: 'North America',
    leg: 'homecoming',
    status: 'played',
    coords: [29.9511, -90.0812],
    headline: 'First New Orleans performance in thirteen years, with Ty Dolla $ign.',
    story: [
      'Ye had not performed in New Orleans since 2013. The Superdome date on 28 August ended that, and it opened the American stretch that runs to the end of the tour.',
      'Presale registration ran through Ye Louisiana and Ticketmaster, with general sale on 17 July. Ty Dolla $ign came out for "Carnival". Four days after this show the production was in Chicago.',
    ],
    guests: ['Ty Dolla $ign'],
    videos: [{ id: 'qPvQQ6my-qs', label: 'Full concert, Superdome' }, { id: 'kzgmZ2eEge4', label: 'With Ty Dolla $ign' }],
    reported: [],
    setlistSource: 'reference',
    facts: ['First New Orleans show in thirteen years.', 'General on-sale 17 July 2026.'],
    sources: [
      { label: 'FOX 8 — Ye bringing 2026 tour to Caesars Superdome', url: 'https://www.fox8live.com/2026/07/09/ye-bringing-2026-tour-caesars-superdome-new-orleans/' },
      { label: 'The Source — First NOLA performance in 13 years', url: 'https://thesource.com/2026/07/14/ye-headed-to-new-orleans-with-first-nola-performance-in-13-years/' },
      { label: 'setlist.fm — Caesars Superdome, 28 August 2026', url: 'https://www.setlist.fm/setlist/ye/2026/caesars-superdome-new-orleans-la-3373e455.html' },
    ],
  },
  {
    slug: 'chicago-2026-09-03',
    n: 21,
    date: '2026-09-03',
    city: 'Chicago',
    area: 'Illinois',
    country: 'United States',
    countryCode: 'US',
    venue: 'Soldier Field',
    capacity: 61500,
    attendance: 71000,
    continent: 'North America',
    leg: 'homecoming',
    status: 'played',
    coords: [41.8623, -87.6167],
    headline: 'Homecoming, night one. Twista, Future, Big Sean and 2 Chainz.',
    story: [
      'Doors at 18:00, onstage at 20:55, off at 23:10. Two hours and fifteen minutes on the lakefront in the city he is from, opening a two-night stand at Soldier Field.',
      'André Troutman took the talk-box out as usual. Big Sean and 2 Chainz came through the G.O.O.D. Music material, Future appeared, and Twista — the Chicago legend Ye produced for before anyone was producing for Ye — closed the guest run.',
      '"Homecoming" is a song about Chicago written as a letter to a girl named Windy. It has been in his set for nineteen years. It does not sound the same at Soldier Field.',
    ],
    guests: ['André Troutman', 'Big Sean', '2 Chainz', 'Future', 'Twista'],
    videos: [{ id: 'SvKB44hUVV0', label: 'Night one, Soldier Field' }, { id: '5M5bpmVJVtQ', label: 'Second angle' }],
    reported: ['homecoming', 'father-stretch'],
    setlistSource: 'partial',
    doors: '18:00',
    onstage: '20:55',
    offstage: '23:10',
    runtime: '2h 15m',
    facts: ['First of two Soldier Field nights.', 'Doors 18:00, onstage 20:55, off 23:10.'],
    sources: [
      { label: 'setlist.fm — Soldier Field, 3 September 2026', url: 'https://www.setlist.fm/setlist/ye/2026/soldier-field-chicago-il-5b72a764.html' },
      { label: 'HotNewHipHop — setlist from night one of the Chicago homecoming shows', url: 'https://www.hotnewhiphop.com/1008562-ye-setlist-night-one-chicago-homecoming-show' },
      { label: 'Soldier Field — YE Live in Chicago', url: 'https://www.soldierfield.com/events/detail/ye' },
      { label: 'Rolling Out — Two sold-out nights draw 142,000 fans', url: 'https://rollingout.com/2026/09/08/ye-makes-history-chicago-soldier-field/' },
      { label: 'The Source — Ye breaks the Soldier Field single-night revenue record', url: 'https://thesource.com/2026/09/10/ye-breaks-soldier-field-single-night-revenue-record-after-massive-chi-town-homecoming/' },
    ],
  },
  {
    slug: 'chicago-2026-09-04',
    n: 22,
    date: '2026-09-04',
    city: 'Chicago',
    area: 'Illinois',
    country: 'United States',
    countryCode: 'US',
    venue: 'Soldier Field',
    capacity: 61500,
    attendance: 71000,
    gross: '$15,760,000 (single night)',
    continent: 'North America',
    leg: 'homecoming',
    status: 'played',
    coords: [41.8623, -87.6167],
    headline: 'Kid Cudi walked out. Fifteen guests, three hours, a stadium revenue record.',
    story: [
      'The best-documented night of the tour and, by most accounts, the best one. Doors 18:00, onstage 20:35, off 23:40 — three hours and five minutes, fifty minutes longer than a normal 2026 date.',
      'The guest list reads like a Chicago census: Lil Durk, Chief Keef, Big Sean, 2 Chainz, Rick Ross, Don Toliver, Travis Scott, Young Thug, CyHi, Really Doe, Consequence, Common, Lupe Fiasco and Twista.',
      'Then Kid Cudi came out. Ye and Cudi performed "Father Stretch My Hands, Pt. 1", "Ghost Town" and "Pursuit of Happiness" together — the first time they had shared a stage after years of public fallout, and the reason this date is the one people will still be posting about in a decade.',
      'Across the two nights Soldier Field sold 129,562 tickets and took $29.8 million, with around 142,000 people reported through the gates. Night two alone grossed $15.76 million — the biggest single night the stadium has ever recorded, past Beyoncé.',
    ],
    guests: ['Kid Cudi', 'Lil Durk', 'Chief Keef', 'Big Sean', '2 Chainz', 'Rick Ross', 'Don Toliver', 'Travis Scott', 'Young Thug', 'CyHi', 'Really Doe', 'Consequence', 'Common', 'Lupe Fiasco', 'Twista'],
    videos: [{ id: '8lrjZUtgJZg', label: 'Night two, Soldier Field' }, { id: 'tuqbO5r_GHQ', label: 'Second angle' }],
    reported: [
      'put-on', 'homecoming', 'cant-tell-me-nothing', 'niggas-in-paris', 'love-sosa', 'i-dont-like',
      'off-the-grid', 'praise-god', 'black-skinhead', 'new-slaves', 'on-sight', 'blood-on-the-leaves',
      'father-stretch', 'ghost-town', 'pursuit-of-happiness',
    ],
    setlistSource: 'reported',
    doors: '18:00',
    onstage: '20:35',
    offstage: '23:40',
    runtime: '3h 05m',
    facts: [
      'Kid Cudi reunion — "Father Stretch My Hands, Pt. 1", "Ghost Town" and "Pursuit of Happiness".',
      'Fifteen guest performers, the most of any 2026 date.',
      '129,562 tickets across the two nights and $29.8 million; night two grossed $15.76 million, a Soldier Field record.',
      'Longest set of the tour at roughly three hours.',
    ],
    sources: [
      { label: 'setlist.fm — Soldier Field, 4 September 2026', url: 'https://www.setlist.fm/setlist/ye/2026/soldier-field-chicago-il-5b72a758.html' },
      { label: 'HotNewHipHop — full setlist and special guests, night two', url: 'https://www.hotnewhiphop.com/1008672-ye-setlist-special-guests-night-two-chicago-homecoming-shows' },
      { label: 'Rolling Out — Two sold-out nights draw 142,000 fans', url: 'https://rollingout.com/2026/09/08/ye-makes-history-chicago-soldier-field/' },
      { label: 'The Source — Ye breaks the Soldier Field single-night revenue record', url: 'https://thesource.com/2026/09/10/ye-breaks-soldier-field-single-night-revenue-record-after-massive-chi-town-homecoming/' },
    ],
  },
  {
    slug: 'saint-petersburg-2026-10-10',
    n: 23,
    date: '2026-10-10',
    city: 'Saint Petersburg',
    country: 'Russia',
    countryCode: 'RU',
    venue: 'Gazprom Arena',
    continent: 'Europe',
    leg: 'neva',
    status: 'cancelled',
    statusNote: 'Cancelled. The arena said in August it had never signed a contract; the tour confirmed the cancellation on 29 September.',
    coords: [59.9727, 30.2206],
    headline: 'Two nights at Gazprom Arena, contested for a month, then called off.',
    story: [
      'Two stadium nights were announced for Gazprom Arena in Saint Petersburg on 10 and 11 October, promoted in Russia by Say Agency.',
      'In late August the arena said it had never signed a contract with Say Agency; local media reported that the decision followed "a phone call from above". Conservative politicians had objected to the shows, pointing to what they called his past public support of Nazism, which is a criminal offence under Russian law. Say Agency kept saying both nights would go ahead.',
      'On 29 September it withdrew that, and Access Opera, which handles the U.S. side of the touring, confirmed on Instagram that both dates were cancelled and told ticket holders to seek refunds from Say Agency.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: [
      'First of two Gazprom Arena nights.',
      'Disowned by the arena in late August; formally cancelled on 29 September.',
      'Refunds through the Russian promoter, Say Agency.',
    ],
    sources: [
      { label: 'The Moscow Times — St. Petersburg shows officially canceled after weeks of conflicting reports', url: 'https://www.themoscowtimes.com/2026/09/29/ye-shows-in-st-petersburg-officially-canceled-after-weeks-of-conflicting-reports-a93820' },
      { label: 'Billboard — Ye’s two Russian stadium concerts canceled', url: 'https://www.billboard.com/music/rb-hip-hop/kanye-west-russian-stadium-concerts-canceled-1236351799/' },
    ],
  },
  {
    slug: 'saint-petersburg-2026-10-11',
    n: 24,
    date: '2026-10-11',
    city: 'Saint Petersburg',
    country: 'Russia',
    countryCode: 'RU',
    venue: 'Gazprom Arena',
    continent: 'Europe',
    leg: 'neva',
    status: 'cancelled',
    statusNote: 'Cancelled with the first night. The arena said in August it had never signed a contract; the tour confirmed the cancellation on 29 September.',
    coords: [59.9727, 30.2206],
    headline: 'The second Saint Petersburg night, cancelled with the first.',
    story: [
      'The second of two Gazprom Arena nights. It went the same way as the first: disowned by the arena in August, defended by the promoter through September, cancelled on 29 September.',
      'A Turkish agency has since listed a tentative Moscow date for 10 July 2027, and Luzhniki Stadium has said it is open to hosting one. Neither is confirmed.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: [
      'Second of two Gazprom Arena nights.',
      'A tentative Moscow date for July 2027 has been listed but not confirmed.',
    ],
    sources: [
      { label: 'The Moscow Times — St. Petersburg shows officially canceled after weeks of conflicting reports', url: 'https://www.themoscowtimes.com/2026/09/29/ye-shows-in-st-petersburg-officially-canceled-after-weeks-of-conflicting-reports-a93820' },
      { label: 'Billboard — Ye’s two Russian stadium concerts canceled', url: 'https://www.billboard.com/music/rb-hip-hop/kanye-west-russian-stadium-concerts-canceled-1236351799/' },
    ],
  },
  {
    slug: 'jakarta-2026-10-24',
    n: 25,
    date: '2026-10-24',
    city: 'Jakarta',
    country: 'Indonesia',
    countryCode: 'ID',
    venue: 'Gelora Bung Karno Main Stadium',
    capacity: 78000,
    continent: 'Asia',
    leg: 'equator',
    status: 'upcoming',
    coords: [-6.2185, 106.8023],
    headline: 'His first Indonesian show. The only Southeast Asian date of the tour.',
    story: [
      'Gelora Bung Karno — finished in 1962 and named for Indonesia’s first president — holds about 78,000 and is the largest stadium in the region. On 24 October it hosts Ye’s first ever solo concert in Indonesia.',
      'It is the only Southeast Asian date on the itinerary, which has made it a regional event: a two-hour flight from Singapore, and the closest this tour comes to most of Asia.',
      'Tickets went on sale 29 July through yejakarta.com, starting at IDR 1,875,000. The full globe stage travels.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: [
      'Ye’s first concert in Indonesia.',
      'The tour’s only Southeast Asian date.',
      'Gelora Bung Karno holds roughly 78,000 — the largest stadium in the region.',
      'On sale 29 July 2026, from IDR 1,875,000.',
    ],
    sources: [
      { label: 'The Star — Kanye West to perform in Jakarta, his tour’s only South-East Asia stop', url: 'https://www.thestar.com.my/lifestyle/entertainment/2026/07/28/kanye-west-to-perform-in-jakarta-in-october-his-tour039s-only-south-east-asia-stop' },
      { label: 'Bandwagon — YE brings the Globe Stage to Jakarta', url: 'https://www.bandwagon.asia/articles/ye-kanye-west-brings-globe-stage-to-jakarta-this-october' },
      { label: 'Tempo — Jakarta concert full ticket price list', url: 'https://en.tempo.co/read/2115814/kanye-west-jakarta-concert-2026-full-ticket-price-list' },
    ],
  },
  {
    slug: 'houston-2026-10-31',
    n: 26,
    date: '2026-10-31',
    city: 'Houston',
    area: 'Texas',
    country: 'United States',
    countryCode: 'US',
    venue: 'NRG Stadium',
    capacity: 72220,
    continent: 'North America',
    leg: 'finale',
    status: 'upcoming',
    coords: [29.6847, -95.4107],
    headline: 'Halloween night in Houston.',
    story: [
      'Announced with Dallas and Phoenix as a trio of new U.S. stadium dates, Houston lands on 31 October. A Halloween show with a spinning globe, fireworks and a Yeezus block is about as on-theme as a stadium booking gets.',
      'Houston is also Travis Scott and Don Toliver’s city, both of whom have already appeared on this tour.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: ['Halloween date.', 'Announced alongside the Dallas and Phoenix stadium shows.'],
    sources: [
      { label: 'Billboard — Ye announces a trio of new U.S. stadium shows', url: 'https://www.billboard.com/music/rb-hip-hop/kanye-west-us-tour-stadium-shows-dallas-houston-phoenix-1236331481/' },
      { label: 'Yahoo Entertainment — Ye announces Halloween concert in Houston', url: 'https://www.yahoo.com/entertainment/music/articles/ye-formerly-kanye-west-announces-224356403.html' },
    ],
  },
  {
    slug: 'arlington-2026-11-07',
    n: 27,
    date: '2026-11-07',
    city: 'Arlington',
    area: 'Texas',
    country: 'United States',
    countryCode: 'US',
    venue: 'AT&T Stadium',
    capacity: 80000,
    continent: 'North America',
    leg: 'finale',
    status: 'upcoming',
    coords: [32.7473, -97.0945],
    headline: 'AT&T Stadium, the biggest room on the itinerary.',
    story: [
      'AT&T Stadium seats 80,000 and expands past 100,000 — the largest capacity the tour has booked all year, and the second-to-last date.',
      'The promotional language for the North American run is explicit about what is coming: the futuristic globe stage, cinematic visuals, fireworks and the catalogue.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: ['Largest-capacity venue on the itinerary.', 'Second-to-last date of the tour.'],
    sources: [
      { label: 'AT&T Stadium — Ye Live in Dallas', url: 'https://attstadium.com/events/ye-live-in-dallas/' },
      { label: 'CultureMap Fort Worth — Kanye West to bring 2026 tour to Arlington', url: 'https://fortworth.culturemap.com/news/entertainment/kanye-west-2026-tour-arlington/' },
    ],
  },
  {
    slug: 'glendale-2026-11-21',
    n: 28,
    date: '2026-11-21',
    city: 'Glendale',
    area: 'Arizona',
    country: 'United States',
    countryCode: 'US',
    venue: 'State Farm Stadium',
    capacity: 63400,
    continent: 'North America',
    leg: 'finale',
    status: 'upcoming',
    coords: [33.5276, -112.2626],
    headline: 'The last date. The globe powers down in Glendale.',
    story: [
      'State Farm Stadium on 21 November closes the Ye Live Concert Tour — eight months, three continents and a stage that had never been built before.',
      'Whatever else 2026 was, it was the year a spherical stage the size of a building went around the world and back, and the year the guest list in Chicago included Kid Cudi again.',
      'If the pattern holds, it ends the way every other night has: house lights down, one song, "Runaway".',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: ['Final date of the tour.', 'Announced with the Houston and Dallas stadium shows.'],
    sources: [
      { label: 'Billboard — Ye announces a trio of new U.S. stadium shows', url: 'https://www.billboard.com/music/rb-hip-hop/kanye-west-us-tour-stadium-shows-dallas-houston-phoenix-1236331481/' },
    ],
  },
];

/* ----------------------------------------------------------------- helpers */

export const played = shows.filter((s) => s.status === 'played');
export const upcoming = shows.filter((s) => s.status === 'upcoming');
export const cancelled = shows.filter((s) => s.status === 'cancelled');

export const nextShow = upcoming[0];

export function showBySlug(slug: string): Show | undefined {
  return shows.find((s) => s.slug === slug);
}

export function neighbours(slug: string): { prev?: Show; next?: Show } {
  const i = shows.findIndex((s) => s.slug === slug);
  return { prev: shows[i - 1], next: shows[i + 1] };
}

export function placeLine(s: Show): string {
  return [s.city, s.area, s.country].filter(Boolean).join(', ');
}

export function shortPlace(s: Show): string {
  return `${s.city}, ${s.area ?? s.country}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Formats an ISO date without timezone drift. */
export function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, month: MONTHS[m - 1], day: DAYS[dow], dd: String(d).padStart(2, '0'), mm: String(m).padStart(2, '0') };
}

export function longDate(iso: string): string {
  const p = parts(iso);
  return `${p.day} ${p.d} ${p.month} ${p.y}`;
}

/** Every song reported at least once, with the dates it was reported at. */
export function songLedger() {
  const map = new Map<string, { song: Song; shows: Show[] }>();
  for (const s of shows) {
    for (const id of s.reported) {
      const entry = map.get(id) ?? { song: song(id), shows: [] };
      entry.shows.push(s);
      map.set(id, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.shows.length - a.shows.length || a.song.title.localeCompare(b.song.title));
}

export const tour = {
  name: 'Ye Live Concert Tour',
  display: 'LIVE CONCERT TOUR',
  year: '2026',
  artist: 'Ye',
  legalName: 'Kanye West',
  album: 'BULLY',
  albumReleased: '2026-03-28',
  albumLabels: 'YZY / Gamma',
  albumTracks: 18,
  ordinal: 'Seventh headlining concert tour',
  previousTour: 'Saint Pablo Tour (2016)',
  designer: 'Aus Taylor',
  opened: '2026-04-01',
  closes: '2026-11-21',
  countries: 10,
  continents: 3,
  biggestCrowd: 118000,
  biggestCrowdCity: 'Istanbul',
  officialSite: 'https://tour.yeezy.com/ye-tour',
} as const;
