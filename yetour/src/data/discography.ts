/**
 * Ye's studio discography, for the /discography/ player.
 *
 * `spotifyId` is verified against a public open.spotify.com/album link for that
 * record; where no id could be verified the card falls back to a Spotify search
 * deep link rather than embedding a guessed id that would render an error.
 * Track counts and dates are standard-edition figures.
 *
 * Cover art is NOT reproduced. Each record gets an original generated mark
 * drawn from its palette — same rule as the rest of this archive.
 */
import type { AlbumId } from '@/data/tour';

export type Motif = 'orb' | 'bars' | 'split' | 'grid' | 'rays' | 'twin' | 'scatter' | 'frame' | 'ridge' | 'cross' | 'halftone' | 'prism';

export interface Palette {
  /** Primary signal colour. Must clear 4.5:1 on `bg`. */
  accent: string;
  /** Page background while this record is selected. */
  bg: string;
  /** Raised surfaces. */
  panel: string;
  /** Hairlines. */
  line: string;
  /** Ambient wash behind the page. */
  wash: string;
  /** Secondary tone inside the generated mark. */
  ink: string;
}

export interface Record_ {
  id: string;
  title: string;
  /** Billed artist, when it is not Ye alone. */
  billed?: string;
  year: number;
  released: string;
  label: string;
  tracks: number;
  runtime?: string;
  kind: 'solo' | 'collab';
  /** Links this record to the live-set song data in tour.ts. */
  setKey?: AlbumId;
  spotifyId?: string;
  /** Why it matters, in two sentences. Editorial. */
  note: string;
  palette: Palette;
  motif: Motif;
}

export const records: Record_[] = [
  {
    id: 'the-college-dropout',
    title: 'The College Dropout',
    year: 2004,
    released: '10 February 2004',
    label: 'Roc-A-Fella / Def Jam',
    tracks: 21,
    runtime: '76:23',
    kind: 'solo',
    setKey: 'cd',
    spotifyId: '3ff2p3LnR6V7m6BinwhNaQ',
    note: 'The producer nobody wanted to hear rap, rapping. Sped-up soul, a jaw wired shut, and "Jesus Walks" — still the oldest song standing in the 2026 set.',
    palette: { accent: '#e0a736', bg: '#0c0a05', panel: '#151107', line: '#2b230f', wash: '#4a3308', ink: '#8a6a1f' },
    motif: 'orb',
  },
  {
    id: 'late-registration',
    title: 'Late Registration',
    year: 2005,
    released: '30 August 2005',
    label: 'Roc-A-Fella / Def Jam',
    tracks: 21,
    runtime: '70:19',
    kind: 'solo',
    setKey: 'lr',
    spotifyId: '5ll74bqtkcXlKE7wwkMq4g',
    note: 'Jon Brion on strings and harpsichord, a rap record arranged like a film score. "Gold Digger" made him unavoidable; "Touch the Sky" made him a stadium act.',
    palette: { accent: '#d9705f', bg: '#0c0706', panel: '#160c0a', line: '#2e1714', wash: '#4a1a16', ink: '#8a3c30' },
    motif: 'split',
  },
  {
    id: 'graduation',
    title: 'Graduation',
    year: 2007,
    released: '11 September 2007',
    label: 'Roc-A-Fella / Def Jam',
    tracks: 13,
    runtime: '51:37',
    kind: 'solo',
    setKey: 'grad',
    spotifyId: '4SZko61aMnmgvNhfhgTuD3',
    note: 'Stadium synths, Daft Punk, and the week he outsold 50 Cent and changed what a rapper was allowed to sound like. "Homecoming" and "Can’t Tell Me Nothing" are still load-bearing live.',
    palette: { accent: '#c06ce8', bg: '#09070f', panel: '#120c1c', line: '#251733', wash: '#3d1a5c', ink: '#6b3a99' },
    motif: 'rays',
  },
  {
    id: '808s-and-heartbreak',
    title: '808s & Heartbreak',
    year: 2008,
    released: '24 November 2008',
    label: 'Roc-A-Fella / Def Jam',
    tracks: 12,
    runtime: '52:07',
    kind: 'solo',
    setKey: 'h808s',
    spotifyId: '2JK89jt4unItFroOr0kT3g',
    note: 'Auto-Tune, a drum machine and grief, made three weeks after his mother died. Hated on arrival, then quietly responsible for the next fifteen years of rap.',
    palette: { accent: '#ef5a70', bg: '#0b0708', panel: '#160c0f', line: '#2e171d', wash: '#4d1220', ink: '#963243' },
    motif: 'twin',
  },
  {
    id: 'my-beautiful-dark-twisted-fantasy',
    title: 'My Beautiful Dark Twisted Fantasy',
    year: 2010,
    released: '22 November 2010',
    label: 'Roc-A-Fella / Def Jam',
    tracks: 13,
    runtime: '68:34',
    kind: 'solo',
    setKey: 'mbdtf',
    spotifyId: '20r762YmB5HeofjMCiPMLv',
    note: 'Exile in Hawaii, a rotating cast of everyone, and maximalism as apology. It ends on "Runaway", which is how every night of the 2026 tour ends too.',
    palette: { accent: '#f0662f', bg: '#0e0705', panel: '#1a0c07', line: '#331a10', wash: '#5c1d08', ink: '#9c4218' },
    motif: 'halftone',
  },
  {
    id: 'watch-the-throne',
    title: 'Watch the Throne',
    billed: 'JAY-Z & Kanye West',
    year: 2011,
    released: '8 August 2011',
    label: 'Roc-A-Fella / Roc Nation / Def Jam',
    tracks: 12,
    runtime: '47:15',
    kind: 'collab',
    setKey: 'wtt',
    spotifyId: '2P2Xwvh2xWXIZ1OWY9S9o5',
    note: 'Two of the richest men in the genre making a record about what that costs. "Niggas in Paris" is still the biggest single moment in the 2026 catalogue block.',
    palette: { accent: '#d4af4f', bg: '#0a0904', panel: '#141108', line: '#2b2411', wash: '#4a3a0c', ink: '#8a7223' },
    motif: 'prism',
  },
  {
    id: 'yeezus',
    title: 'Yeezus',
    year: 2013,
    released: '18 June 2013',
    label: 'Def Jam / Roc-A-Fella',
    tracks: 10,
    runtime: '40:07',
    kind: 'solo',
    setKey: 'yeezus',
    spotifyId: '0XTAmejG8F97wF5MWoVbaY',
    note: 'Industrial, abrasive, finished in fifteen days with Rick Rubin stripping it back to nothing. Four of its ten tracks run back to back in the middle of every 2026 show.',
    palette: { accent: '#ff4232', bg: '#0a0909', panel: '#141212', line: '#2e1a18', wash: '#4a0f0a', ink: '#a02218' },
    motif: 'bars',
  },
  {
    id: 'the-life-of-pablo',
    title: 'The Life of Pablo',
    year: 2016,
    released: '14 February 2016',
    label: 'GOOD Music / Def Jam',
    tracks: 20,
    kind: 'solo',
    setKey: 'tlop',
    spotifyId: '7gsWAHLeT0w7es6FofOXk1',
    note: 'The first album that kept changing after release — tracks re-mixed, re-sequenced and re-uploaded for weeks. Track counts vary by version, which is the whole point of it.',
    palette: { accent: '#f5841f', bg: '#0d0904', panel: '#190f07', line: '#331f0e', wash: '#5c2f06', ink: '#9c5510' },
    motif: 'frame',
  },
  {
    id: 'ye',
    title: 'ye',
    year: 2018,
    released: '1 June 2018',
    label: 'GOOD Music / Def Jam',
    tracks: 7,
    runtime: '23:45',
    kind: 'solo',
    setKey: 'ye',
    spotifyId: '5EBGCvO6upi3GNknMVe9x9',
    note: 'Twenty-three minutes cut in Wyoming and premiered round a campfire, with "I hate being bi-polar it’s awesome" written over a mountain. "Ghost Town" is the reason the Kid Cudi reunion in Chicago landed the way it did.',
    palette: { accent: '#5fd9ab', bg: '#050c09', panel: '#0a1712', line: '#153026', wash: '#0d4434', ink: '#2d8a6b' },
    motif: 'ridge',
  },
  {
    id: 'kids-see-ghosts',
    title: 'KIDS SEE GHOSTS',
    billed: 'Kanye West & Kid Cudi',
    year: 2018,
    released: '8 June 2018',
    label: 'GOOD Music / Def Jam',
    tracks: 7,
    runtime: '23:47',
    kind: 'collab',
    setKey: 'ksg',
    spotifyId: '6pwuKxMUkNg673KETsXPUV',
    note: 'Seven songs, twenty-three minutes, the best thing either of them did that decade. Everything about the 4 September 2026 reunion runs through this record.',
    palette: { accent: '#ff8fb8', bg: '#0c060a', panel: '#180c14', line: '#301828', wash: '#4d1638', ink: '#99406b' },
    motif: 'cross',
  },
  {
    id: 'jesus-is-king',
    title: 'JESUS IS KING',
    year: 2019,
    released: '25 October 2019',
    label: 'GOOD Music / Def Jam',
    tracks: 11,
    runtime: '27:04',
    kind: 'solo',
    setKey: 'jik',
    spotifyId: '0FgZKfoU2Br5sHOfvZKTI9',
    note: 'The gospel turn, made in public through the Sunday Service choir. Divisive then; the choral arrangements never left the live show.',
    palette: { accent: '#4f9dff', bg: '#04080e', panel: '#0a1220', line: '#152538', wash: '#12365c', ink: '#2a5fa3' },
    motif: 'rays',
  },
  {
    id: 'donda',
    title: 'Donda',
    year: 2021,
    released: '29 August 2021',
    label: 'GOOD Music / Def Jam',
    tracks: 27,
    runtime: '108:25',
    kind: 'solo',
    setKey: 'donda',
    spotifyId: '340MjPcVdiQRnMigrPybZA',
    note: 'Named for his mother and built in three stadium listening events with the artist living inside the venue. Nearly two hours long; "Off the Grid", "Praise God" and "Moon" all made 2026.',
    palette: { accent: '#b4bcc5', bg: '#070808', panel: '#101214', line: '#242a30', wash: '#262c33', ink: '#5c646d' },
    motif: 'grid',
  },
  {
    id: 'donda-2',
    title: 'Donda 2',
    year: 2022,
    released: '23 February 2022',
    label: 'YZY — Stem Player only',
    tracks: 22,
    kind: 'solo',
    note: 'Released exclusively on his own $200 hardware and never delivered to streaming, which is why there is no player on this card. It exists, and it is not on Spotify.',
    palette: { accent: '#8b98a5', bg: '#05070a', panel: '#0d1116', line: '#1e2733', wash: '#1e2733', ink: '#4a5560' },
    motif: 'scatter',
  },
  {
    id: 'vultures-1',
    title: 'VULTURES 1',
    billed: '¥$ — Kanye West & Ty Dolla $ign',
    year: 2024,
    released: '10 February 2024',
    label: 'YZY',
    tracks: 16,
    runtime: '55:56',
    kind: 'collab',
    spotifyId: '0k7ALIqqds5oGFtpMsaHLK',
    note: 'The independent era starts here: no major label, a listening event economy, and a duo record billed to ¥$. It arrived after two years of him being unsignable.',
    palette: { accent: '#cac5bc', bg: '#080808', panel: '#121212', line: '#262422', wash: '#2a2724', ink: '#6b665e' },
    motif: 'scatter',
  },
  {
    id: 'vultures-2',
    title: 'VULTURES 2',
    billed: '¥$ — Kanye West & Ty Dolla $ign',
    year: 2024,
    released: '3 August 2024',
    label: 'YZY',
    tracks: 16,
    kind: 'collab',
    spotifyId: '2LaSVrn1EJc9ouFyp69g4e',
    note: 'Surprise-released to streaming hours after a YouTube livestream, with North and Chicago West, Playboi Carti, Future, Lil Wayne and half of Atlanta on it.',
    palette: { accent: '#9fb0bb', bg: '#06080a', panel: '#0f1317', line: '#212a31', wash: '#222c33', ink: '#52606b' },
    motif: 'bars',
  },
  {
    id: 'bully',
    title: 'BULLY',
    year: 2026,
    released: '28 March 2026',
    label: 'YZY / Gamma',
    tracks: 18,
    runtime: '30:12 physical · 42:26 streaming',
    kind: 'solo',
    setKey: 'bully',
    spotifyId: '5poA9SAx0Xiz1cf17fWBLS',
    note: 'The twelfth album, five years in the making, announced with four words: BULLY ON THE WAY NO AI. Four days later the globe switched on at SoFi Stadium.',
    palette: { accent: '#f2ede1', bg: '#0a0b0c', panel: '#141618', line: '#2a2c2e', wash: '#3a362e', ink: '#7d7a72' },
    motif: 'frame',
  },
];

export const defaultRecord = records.find((r) => r.id === 'bully')!;

export function spotifyEmbed(r: Record_): string | undefined {
  return r.spotifyId ? `https://open.spotify.com/embed/album/${r.spotifyId}?utm_source=ye_live_2026&theme=0` : undefined;
}

export function spotifySearch(r: Record_): string {
  const q = `${r.billed ?? 'Kanye West'} ${r.title}`;
  return `https://open.spotify.com/search/${encodeURIComponent(q)}/albums`;
}
