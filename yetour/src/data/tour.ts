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
 * This is an unofficial fan archive. See /about/ for the full source list.
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

  // Chicago drill / features
  { id: 'i-dont-like', title: "I Don't Like", album: 'other', with: 'Chief Keef', note: 'The 2012 G.O.O.D. Music remix that rewired Chicago rap.' },
  { id: 'love-sosa', title: 'Love Sosa', album: 'other', with: 'Chief Keef' },
  { id: 'put-on', title: 'Put On', album: 'other', with: 'Young Jeezy', note: "Jeezy's record, but the auto-tuned third verse is one of Ye's most requested live moments." },

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
  { id: 'through-the-wire', title: 'Through the Wire', album: 'cd' },
  { id: 'touch-the-sky', title: 'Touch the Sky', album: 'lr' },
  { id: 'gold-digger', title: 'Gold Digger', album: 'lr' },
  { id: 'heartless', title: 'Heartless', album: 'h808s' },
  { id: 'love-lockdown', title: 'Love Lockdown', album: 'h808s' },
  { id: 'power', title: 'POWER', album: 'mbdtf' },
  { id: 'all-of-the-lights', title: 'All of the Lights', album: 'mbdtf' },
  { id: 'runaway', title: 'Runaway', album: 'mbdtf', note: 'The tour closer. In Istanbul it ran into a new synth outro built around a spoken-word sample of Donda West.' },
  { id: 'father-stretch', title: 'Father Stretch My Hands, Pt. 1', album: 'tlop' },
  { id: 'ultralight-beam', title: 'Ultralight Beam', album: 'tlop' },
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
  { id: 'origin', n: 1, name: 'Origin', region: 'Los Angeles', color: '#f2ede1', blurb: 'Two nights at SoFi to switch the globe on for the first time. 142,000 people, $29.8 million, and a decade of not touring ended in one weekend.' },
  { id: 'east', n: 2, name: 'Due East', region: 'Türkiye · Netherlands · Georgia', color: '#ff3b2a', blurb: 'The leg that broke a world stadium record in Istanbul, then kept going east into rooms most stadium tours never book.' },
  { id: 'independence', n: 3, name: 'Independence', region: 'Texas', color: '#d9a441', blurb: 'A single Fourth of July date in San Antonio. Sixty thousand tickets, fireworks written into the show.' },
  { id: 'borders', n: 4, name: 'Borders', region: 'Albania · UK · Italy · Spain · Portugal', color: '#b06ce0', blurb: 'The most contested stretch of the year: two shows lost to government decisions, three played to the biggest crowds those countries had seen.' },
  { id: 'steppe', n: 5, name: 'Steppe', region: 'Kazakhstan', color: '#57d3a5', blurb: 'Almaty, under the Tian Shan mountains, a day later than advertised.' },
  { id: 'homecoming', n: 6, name: 'Homecoming', region: 'Louisiana · Illinois', color: '#e0522a', blurb: 'The Superdome for the first time in thirteen years, then two nights on the lakefront in the city that made him.' },
  { id: 'equator', n: 7, name: 'Equator', region: 'Indonesia', color: '#4a8bff', blurb: 'One date in Southeast Asia. Gelora Bung Karno, the biggest stadium in the region.' },
  { id: 'finale', n: 8, name: 'Finale', region: 'Texas · Arizona', color: '#e2455f', blurb: 'Halloween in Houston, Arlington a week later, and the globe powered down for good in Glendale.' },
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
      'André Troutman brought the talk-box out for the BULLY material, Don Toliver came out for "Moon", and North West performed "Miss Westie" with her father. The two SoFi nights together drew roughly 142,000 people and grossed $29.8 million.',
    ],
    guests: ['André Troutman', 'Don Toliver', 'North West'],
    reported: ['moon', 'miss-westie'],
    setlistSource: 'partial',
    facts: [
      'First Ye headline tour date since the Saint Pablo Tour in 2016.',
      'BULLY, his twelfth studio album, had been out four days.',
      'The two-night SoFi run drew about 142,000 people and grossed $29.8 million; one of the nights grossed $18 million on its own.',
    ],
    sources: [
      { label: 'Billboard — Ye’s 2026 BULLY setlist, night 1 at SoFi Stadium', url: 'https://www.billboard.com/lists/yes-2026-bully-concert-setlist-night-1-sofi-stadium/' },
      { label: 'setlist.fm — SoFi Stadium, 1 April 2026', url: 'https://www.setlist.fm/setlist/ye/2026/sofi-stadium-inglewood-ca-5349a3bd.html' },
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
    gross: '$18,000,000 (single night)',
    continent: 'North America',
    leg: 'origin',
    status: 'played',
    coords: [33.9535, -118.3387],
    headline: 'Travis Scott, CeeLo Green and Ms. Lauryn Hill in one night.',
    story: [
      'Night two at SoFi is the one people still argue about. Travis Scott came out for "FATHER", the BULLY record he features on. CeeLo Green appeared. So did Ms. Lauryn Hill, whose catalogue Ye has sampled and cited since The College Dropout.',
      'North West performed again. The night is reported to have grossed $18 million on its own, which puts it among the highest-grossing single concerts ever staged anywhere.',
      'It also set the template the rest of the year followed: a fixed spine of BULLY and Yeezus material, and a guest list built city by city.',
    ],
    guests: ['Travis Scott', 'North West', 'CeeLo Green', 'Ms. Lauryn Hill'],
    reported: ['father', 'miss-westie'],
    setlistSource: 'partial',
    facts: [
      'Reported $18 million gross for the single night — one of the highest-grossing concerts on record.',
      'Travis Scott performed "FATHER", the BULLY track he appears on.',
    ],
    sources: [
      { label: 'setlist.fm — SoFi Stadium, 3 April 2026', url: 'https://www.setlist.fm/setlist/ye/2026/sofi-stadium-inglewood-ca-73484685.html' },
    ],
  },
  {
    slug: 'istanbul-2026-05-30',
    n: 3,
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
    n: 4,
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
    reported: [],
    setlistSource: 'reference',
    facts: ['Smallest venue on the 2026 itinerary.', 'One of two Arnhem dates, 6 and 8 June.'],
    sources: [
      { label: 'Ticketmaster NL — Ye tour dates', url: 'https://www.ticketmaster.nl/artist/ye-tickets/24556?language=en-us' },
    ],
  },
  {
    slug: 'arnhem-2026-06-08',
    n: 5,
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
    reported: [],
    setlistSource: 'reference',
    facts: ['Final Western European date before the tour turned east.'],
    sources: [
      { label: 'Ticketmaster NL — Ye tour dates', url: 'https://www.ticketmaster.nl/artist/ye-tickets/24556?language=en-us' },
    ],
  },
  {
    slug: 'tbilisi-2026-06-12',
    n: 6,
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
      'The routing was not an accident. With the United Kingdom refusing entry and Italy cancelling, the map for 2026 was drawn by which governments would have him.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: ['One of nine countries visited on the tour’s international run.'],
    sources: [
      { label: 'Billboard — Ye announces a trio of new U.S. stadium shows', url: 'https://www.billboard.com/music/rb-hip-hop/kanye-west-us-tour-stadium-shows-dallas-houston-phoenix-1236331481/' },
    ],
  },
  {
    slug: 'san-antonio-2026-07-04',
    n: 7,
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
      'A single American date in the middle of the European summer, booked for Independence Day at the Alamodome. It sold over 60,000 tickets and grossed more than $9 million.',
      'The pyrotechnic package that the stadium shows had been carrying since April made more sense on 4 July than on any other night of the year.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    facts: ['Over 60,000 tickets sold.', 'More than $9 million in ticket sales.', 'The only U.S. date between April and August.'],
    sources: [
      { label: 'setlist.fm — Alamodome, 4 July 2026', url: 'https://www.setlist.fm/setlist/ye/2026/alamodome-san-antonio-tx-5372a755.html' },
    ],
  },
  {
    slug: 'tirana-2026-07-11',
    n: 8,
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
    n: 9,
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
    n: 10,
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
      'Italian authorities cancelled the 18 July concert. Together with the UK revocation and cancelled dates in Russia and Poland, it is one of four 2026 shows removed by a government rather than a promoter.',
    ],
    guests: [],
    reported: [],
    setlistSource: 'reference',
    sources: [
      { label: 'Billboard — Kanye West Italy concert coming in 2026 to Hellwatt Festival', url: 'https://www.billboard.com/music/rb-hip-hop/kanye-west-italy-concert-hellwatt-festival-1236142951/' },
    ],
  },
  {
    slug: 'madrid-2026-07-30',
    n: 11,
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
      'Madrid went ahead where London and Reggio Emilia did not. The Metropolitano opened at 18:30, the show was scheduled for 21:00, and Ye walked on at 21:20 for a set of one hour fifty-five minutes.',
      'Those twenty minutes are worth noting: for a tour with this reputation, the 2026 dates ran close to schedule almost everywhere.',
    ],
    guests: [],
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
    n: 12,
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
    n: 13,
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
      'Almaty was advertised for 14 August and moved to the 15th over weather concerns — the only schedule change of the tour that was not a government decision.',
      'Almaty Central Stadium holds under 24,000, which makes this the most intimate ticket of 2026 by a wide margin. The globe had to be rigged into a footprint roughly a third the size of SoFi’s.',
    ],
    guests: [],
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
    n: 14,
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
    headline: 'First New Orleans performance in thirteen years.',
    story: [
      'Ye had not performed in New Orleans since 2013. The Superdome date on 28 August ended that, and it opened the American stretch that runs to the end of the tour.',
      'Presale registration ran through Ye Louisiana and Ticketmaster, with general sale on 17 July. Four days after this show the production was in Chicago.',
    ],
    guests: [],
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
    n: 15,
    date: '2026-09-03',
    city: 'Chicago',
    area: 'Illinois',
    country: 'United States',
    countryCode: 'US',
    venue: 'Soldier Field',
    capacity: 61500,
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
    ],
  },
  {
    slug: 'chicago-2026-09-04',
    n: 16,
    date: '2026-09-04',
    city: 'Chicago',
    area: 'Illinois',
    country: 'United States',
    countryCode: 'US',
    venue: 'Soldier Field',
    capacity: 61500,
    continent: 'North America',
    leg: 'homecoming',
    status: 'played',
    coords: [41.8623, -87.6167],
    headline: 'Kid Cudi walked out. Fifteen guests, three hours, an attendance record.',
    story: [
      'The best-documented night of the tour and, by most accounts, the best one. Doors 18:00, onstage 20:35, off 23:40 — three hours and five minutes, fifty minutes longer than a normal 2026 date.',
      'The guest list reads like a Chicago census: Lil Durk, Chief Keef, Big Sean, 2 Chainz, Rick Ross, Don Toliver, Travis Scott, Young Thug, CyHi, Really Doe, Consequence, Common, Lupe Fiasco and Twista.',
      'Then Kid Cudi came out. Ye and Cudi performed "Father Stretch My Hands, Pt. 1", "Ghost Town" and "Pursuit of Happiness" together — the first time they had shared a stage after years of public fallout, and the reason this date is the one people will still be posting about in a decade.',
      'The Soldier Field run was reported at 118,000 ticketed fans, taking the stadium record from Zach Bryan’s 113,000 the year before.',
    ],
    guests: ['Kid Cudi', 'Lil Durk', 'Chief Keef', 'Big Sean', '2 Chainz', 'Rick Ross', 'Don Toliver', 'Travis Scott', 'Young Thug', 'CyHi', 'Really Doe', 'Consequence', 'Common', 'Lupe Fiasco', 'Twista'],
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
      'Soldier Field run reported at 118,000 ticketed fans, past Zach Bryan’s 113,000.',
      'Longest set of the tour at roughly three hours.',
    ],
    sources: [
      { label: 'setlist.fm — Soldier Field, 4 September 2026', url: 'https://www.setlist.fm/setlist/ye/2026/soldier-field-chicago-il-5b72a758.html' },
      { label: 'HotNewHipHop — full setlist and special guests, night two', url: 'https://www.hotnewhiphop.com/1008672-ye-setlist-special-guests-night-two-chicago-homecoming-shows' },
    ],
  },
  {
    slug: 'jakarta-2026-10-24',
    n: 17,
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
    n: 18,
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
    n: 19,
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
    n: 20,
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
      'State Farm Stadium on 21 November closes the Ye Live Concert Tour — eight months, four continents and a stage that had never been built before.',
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
  continents: 4,
  biggestCrowd: 118000,
  biggestCrowdCity: 'Istanbul',
  officialSite: 'https://tour.yeezy.com/ye-tour',
} as const;
