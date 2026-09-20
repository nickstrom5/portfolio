/**
 * Selected credits outside his own albums.
 *
 * Not exhaustive — the full production discography runs to hundreds of entries.
 * This is a curated set of the placements that are widely documented and that
 * matter to the story the rest of this archive tells.
 */

export interface Feature {
  year: number;
  artist: string;
  song: string;
  /** Other credited guests on the record. */
  with?: string;
  /** He produced this one as well as rapping on it. */
  produced?: boolean;
  note?: string;
}

/** Records where Ye appears as a featured artist. */
export const features: Feature[] = [
  { year: 2003, artist: 'Twista', song: 'Slow Jamz', with: 'Jamie Foxx', produced: true, note: 'His first US number one, months before The College Dropout. He produced it, rapped on it, and it belonged to someone else.' },
  { year: 2004, artist: 'Dilated Peoples', song: 'This Way', produced: true },
  { year: 2004, artist: 'Brandy', song: 'Talk About Our Love', produced: true },
  { year: 2004, artist: 'Janet Jackson', song: 'My Baby', produced: true },
  { year: 2004, artist: 'John Legend', song: 'Number One', produced: true },
  { year: 2004, artist: "Cam'ron", song: 'Down and Out', with: 'Syleena Johnson', produced: true },
  { year: 2005, artist: 'Jamie Foxx', song: 'Extravaganza' },
  { year: 2006, artist: 'The Game', song: "Wouldn't Get Far", produced: true },
  { year: 2006, artist: 'Nas', song: 'Still Dreaming', with: 'Chrisette Michele', produced: true },
  { year: 2007, artist: 'Common', song: 'Southside', produced: true },
  { year: 2008, artist: 'Estelle', song: 'American Boy', note: 'A UK number one and the closest thing to a pop standard in his guest catalogue.' },
  { year: 2008, artist: 'T.I.', song: 'Swagga Like Us', with: 'JAY-Z, Lil Wayne' },
  { year: 2008, artist: 'Young Jeezy', song: 'Put On', note: 'The auto-tuned third verse, cut weeks before 808s. Still in the 2026 set.' },
  { year: 2008, artist: 'Lil Wayne', song: 'Lollipop (Remix)' },
  { year: 2009, artist: 'Drake', song: 'Forever', with: 'Lil Wayne, Eminem' },
  { year: 2010, artist: 'Kid Cudi', song: 'Erase Me' },
  { year: 2011, artist: 'Katy Perry', song: 'E.T.', note: 'A Hot 100 number one for five weeks — his most commercially successful guest verse.' },
  { year: 2011, artist: 'Big Sean', song: 'Marvin & Chardonnay', with: 'Roscoe Dash' },
  { year: 2012, artist: 'Chief Keef', song: "I Don't Like (Remix)", with: 'Pusha T, Jadakiss, Big Sean', note: 'The G.O.O.D. Music remix that took Chicago drill national. Both Keef and Ye played it at Soldier Field in 2026.' },
  { year: 2012, artist: '2 Chainz', song: 'Birthday Song' },
  { year: 2015, artist: 'A$AP Rocky', song: 'Jukebox Joints' },
  { year: 2016, artist: 'Chance the Rapper', song: 'All We Got', with: "Chicago Children's Choir" },
  { year: 2018, artist: 'Lil Pump', song: 'I Love It', with: 'Adele Givens' },
  { year: 2020, artist: 'Ty Dolla $ign', song: 'Ego Death', with: 'FKA twigs, Skrillex' },
  { year: 2022, artist: 'The Game', song: 'Eazy' },
];

export interface ProducedCredit {
  year: number;
  artist: string;
  /** A single song, or an album when he shaped the whole record. */
  work: string;
  scope: 'song' | 'album';
  note?: string;
}

/** Production and co-writing for other artists. */
export const produced: ProducedCredit[] = [
  { year: 2000, artist: 'Beanie Sigel', work: 'The Truth', scope: 'song', note: 'The Roc-A-Fella placement that got him in the building. He was 22 and still could not get anyone to let him rap.' },
  { year: 2001, artist: 'JAY-Z', work: 'Izzo (H.O.V.A.)', scope: 'song', note: 'The Jackson 5 flip that made a producer famous. The Blueprint is where the chipmunk-soul era starts.' },
  { year: 2001, artist: 'JAY-Z', work: 'Takeover', scope: 'song' },
  { year: 2001, artist: 'JAY-Z', work: "Heart of the City (Ain't No Love)", scope: 'song' },
  { year: 2002, artist: 'Talib Kweli', work: 'Get By', scope: 'song', note: 'Built on Nina Simone’s "Sinnerman". Still the best argument for what he could do with a sample.' },
  { year: 2002, artist: 'JAY-Z', work: "'03 Bonnie & Clyde", scope: 'song' },
  { year: 2003, artist: 'Alicia Keys', work: "You Don't Know My Name", scope: 'song' },
  { year: 2003, artist: 'Ludacris', work: 'Stand Up', scope: 'song' },
  { year: 2003, artist: 'JAY-Z', work: 'Encore', scope: 'song' },
  { year: 2003, artist: 'JAY-Z', work: 'Lucifer', scope: 'song' },
  { year: 2004, artist: 'Twista', work: 'Overnight Celebrity', scope: 'song' },
  { year: 2004, artist: 'John Legend', work: 'Used to Love U', scope: 'song' },
  { year: 2005, artist: 'Common', work: 'Be', scope: 'album', note: 'He produced almost all of it, and it is the record that put Common back in the conversation.' },
  { year: 2005, artist: 'The Game', work: 'Dreams', scope: 'song' },
  { year: 2005, artist: 'Keyshia Cole', work: 'I Changed My Mind', scope: 'song' },
  { year: 2008, artist: 'Lil Wayne', work: 'Let the Beat Build', scope: 'song' },
  { year: 2009, artist: 'JAY-Z', work: 'Run This Town', scope: 'song' },
  { year: 2010, artist: 'Drake', work: 'Find Your Love', scope: 'song' },
  { year: 2011, artist: 'Beyoncé', work: 'Party', scope: 'song' },
  { year: 2018, artist: 'Pusha T', work: 'DAYTONA', scope: 'album', note: 'Seven songs, twenty-one minutes, produced start to finish in Wyoming. The first of five albums he shipped in five weeks.' },
  { year: 2018, artist: 'Nas', work: 'Nasir', scope: 'album' },
  { year: 2018, artist: 'Teyana Taylor', work: 'K.T.S.E.', scope: 'album' },
  { year: 2018, artist: 'Kids See Ghosts', work: 'KIDS SEE GHOSTS', scope: 'album', note: 'Billed as a duo with Kid Cudi. Eight years later the two of them shared a stage at Soldier Field again.' },
  { year: 2019, artist: 'Sunday Service Choir', work: 'Jesus Is Born', scope: 'album' },
];

export interface Venture {
  name: string;
  partner?: string;
  years: string;
  category: 'Footwear' | 'Fashion' | 'Hardware' | 'Film' | 'Education' | 'Architecture' | 'Live';
  note: string;
}

/** Credits outside recorded music. */
export const ventures: Venture[] = [
  {
    name: 'Air Yeezy 1 & 2',
    partner: 'Nike',
    years: '2009 — 2012',
    category: 'Footwear',
    note: 'The first Nike signature shoe given to someone who was not an athlete. A 2008 sample pair sold at auction in 2021 for $1.8 million.',
  },
  {
    name: '"Don" and "Jasper"',
    partner: 'Louis Vuitton',
    years: '2009',
    category: 'Footwear',
    note: 'A rapper designing for Louis Vuitton in 2009 was genuinely unusual. Everything that followed in luxury streetwear runs through it.',
  },
  {
    name: 'Kanye × A.P.C.',
    partner: 'A.P.C.',
    years: '2013 — 2014',
    category: 'Fashion',
    note: 'Two small, plain, expensive capsule collections. The anti-logo period.',
  },
  {
    name: 'Yeezy',
    partner: 'adidas',
    years: '2013 — 2022',
    category: 'Footwear',
    note: 'Boost 750, 350, 700, Foam Runner and Slide. One of the most profitable signature lines in sportswear history until adidas ended the partnership in 2022.',
  },
  {
    name: 'Yeezy Gap',
    partner: 'Gap',
    years: '2020 — 2022',
    category: 'Fashion',
    note: 'A ten-year deal that lasted two, including the Engineered by Balenciaga line. Clothes sold out of bin bags in stores.',
  },
  {
    name: 'Stem Player',
    partner: 'Kano Computing',
    years: '2021',
    category: 'Hardware',
    note: 'A $200 handheld that splits any track into four stems you can mute and rework. Donda 2 was released on it and nowhere else, and still has not reached streaming.',
  },
  {
    name: "Donda's Academy",
    years: '2022 —',
    category: 'Education',
    note: 'A private school named for his mother, with a curriculum built around basketball, choir and design.',
  },
  {
    name: 'Yeezy Home',
    years: '2018 —',
    category: 'Architecture',
    note: 'Dome prototypes on the Calabasas property and a stated ambition to build low-cost housing. Mostly unbuilt, entirely in character.',
  },
  {
    name: 'Runaway',
    years: '2010',
    category: 'Film',
    note: 'A 35-minute film he directed to carry My Beautiful Dark Twisted Fantasy. The song still closes every night of the 2026 tour.',
  },
  {
    name: 'Cruel Summer',
    years: '2012',
    category: 'Film',
    note: 'A seven-screen film premiered in a custom pavilion at Cannes. Almost nobody has seen it since.',
  },
  {
    name: 'Jesus Is King',
    partner: 'IMAX',
    years: '2019',
    category: 'Film',
    note: 'A Sunday Service film shot in James Turrell’s Roden Crater and released to IMAX screens alongside the album.',
  },
  {
    name: 'Sunday Service',
    years: '2019 —',
    category: 'Live',
    note: 'A travelling gospel choir that reworked his own catalogue, from Coachella to the Donda events. The choral arrangements never left the live show.',
  },
  {
    name: 'Donda listening events',
    years: '2021',
    category: 'Live',
    note: 'Three stadium events, two at Mercedes-Benz Stadium and one at Soldier Field, where he lived in the venue and rebuilt his childhood home on the floor.',
  },
];

export const creditSources = [
  { label: 'Wikipedia — Kanye West production discography', url: 'https://en.wikipedia.org/wiki/Kanye_West_production_discography' },
  { label: 'Wikipedia — Kanye West discography', url: 'https://en.wikipedia.org/wiki/Kanye_West_discography' },
  { label: 'Rolling Stone — 20 songs you didn’t know Kanye West produced', url: 'https://www.rollingstone.com/music/music-lists/20-songs-you-didnt-know-kanye-west-produced-11859/' },
  { label: 'Wikipedia — List of awards and nominations received by Kanye West', url: 'https://en.wikipedia.org/wiki/List_of_awards_and_nominations_received_by_Kanye_West' },
];
