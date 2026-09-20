/**
 * André Troutman — the tour's music director, the man with the tube in his
 * mouth, and the reason a 1980 funk instrument is the signature sound of a
 * 2026 stadium tour.
 */

export const andre = {
  name: 'André Troutman',
  role: 'Music director, talk box, featured artist and producer',
  base: 'Jacksonville, Florida',
  joined: 'March 2025',
  debut: 'Mexico City, January 2026',
  relation: 'Younger cousin of Roger Troutman',
} as const;

export interface Beat {
  when: string;
  title: string;
  body: string;
}

export const andreTimeline: Beat[] = [
  {
    when: 'A family reunion in Ohio',
    title: 'The first time he heard it done properly',
    body: 'He got serious about the talk box after hearing his cousin Rufus play one during the Sunday service at a Troutman family reunion. He wanted it on a keytar, by his own account, because he wanted to look cool.',
  },
  {
    when: 'Learning it',
    title: '"A lot of practice, a lot of weird faces, and a lot of bad notes"',
    body: 'His own description of the learning curve. The talk box is one of the few instruments where getting it wrong is visible from the back of a stadium.',
  },
  {
    when: '2017',
    title: 'Talk box on Big Sean’s "Same Time, Pt. 1"',
    body: 'From I Decided. He also worked with R&B artists including Major and Rhyon Nicole Brown before anyone outside the credits knew his name.',
  },
  {
    when: 'March 2025',
    title: 'Starts working with Ye',
    body: 'Brought in to help with music and production for live shows. Within a year he was orchestrating a stadium tour.',
  },
  {
    when: 'January 2026',
    title: 'First shows together, in Mexico City',
    body: 'His live debut with Ye, on the talk box, at the Mexico City dates that preceded the tour proper.',
  },
  {
    when: 'March 2026',
    title: 'Featured artist and producer on BULLY',
    body: '"ALL THE LOVE" is his record as much as anyone’s. He is credited as a featured artist and a producer on the album, and as the tour’s music director.',
  },
  {
    when: 'April — November 2026',
    title: 'On the globe, nearly every night',
    body: 'From SoFi to Istanbul to Soldier Field, the talk box has been a fixed element of the show. Where the reporting names a guest at all, his name is usually the first one.',
  },
];

export interface Ancestor {
  name: string;
  life: string;
  body: string;
}

export const lineage: Ancestor[] = [
  {
    name: 'Roger Troutman',
    life: '1951 — 1999',
    body: 'Founder of Zapp, out of Hamilton, Ohio, and the man who made the talk box a lead instrument rather than a novelty. "More Bounce to the Ounce" and "Computer Love" are the foundation documents of G-funk; his hook on 2Pac and Dr. Dre’s "California Love" put the sound in every car in America in 1996. He was killed in 1999, in a murder-suicide, by his own brother.',
  },
  {
    name: 'Zapp',
    life: '1977 —',
    body: 'The Troutman brothers’ band: Roger, Larry, Lester and Terry. A family business that became one of the most sampled catalogues in hip-hop, and the reason West Coast rap sounds the way it does.',
  },
  {
    name: 'André Troutman',
    life: 'Now',
    body: 'The younger cousin, carrying the instrument on the largest stages his family has ever played. It is not an impression of Roger — it is the same family, the same tube, a different decade.',
  },
];

export interface TalkBoxFact {
  term: string;
  body: string;
}

/** How the instrument actually works, and where it came from. */
export const talkBox: TalkBoxFact[] = [
  {
    term: 'What it is',
    body: 'A speaker driver in a box, sealed to a length of plastic tube. The tube goes in the player’s mouth. Whatever the driver is fed — a keyboard, a guitar, a synth — arrives as raw sound inside the mouth, and the mouth shapes it into vowels and consonants. A microphone in front of the face picks up the result.',
  },
  {
    term: 'What it is not',
    body: 'Not a vocoder and not Auto-Tune. A vocoder is electronics: it analyses a voice and imposes its shape on a carrier signal. A talk box is plumbing and anatomy — the filtering is done by a human mouth, in the room, in real time. That is why it cannot be faked convincingly and why it is always played live.',
  },
  {
    term: 'Where it came from',
    body: 'The idea runs back through Alvino Rey’s singing guitar and Pete Drake’s "talking" pedal steel in 1964. Bob Heil built the Heil Talk Box in 1973 for Joe Walsh, who used it on "Rocky Mountain Way"; Peter Frampton made it famous on Frampton Comes Alive! in 1976.',
  },
  {
    term: 'How it became a Black instrument',
    body: 'Roger Troutman took a rock guitarist’s toy and made it the lead voice of a funk band, then hip-hop sampled Zapp into the ground. By the nineties the talk box was shorthand for the West Coast, and a rock effect had become a fixture of Black American popular music.',
  },
  {
    term: 'Why it works in a stadium',
    body: 'It is the one thing on the 2026 stage that no screen can do. A 50-foot sphere is projecting planets and there is still a man at the front with a tube in his mouth making a keyboard talk — an analogue trick from 1973 holding its own against the largest production in touring.',
  },
];

export const andreSources = [
  { label: 'News4JAX — How Jacksonville musician André Troutman honors his family’s musical legacy with Kanye West', url: 'https://www.news4jax.com/news/local/2026/06/01/how-jacksonville-musician-andre-troutman-honors-his-familys-musical-legacy-while-on-the-world-stage-with-kanye-west/' },
  { label: 'Wikipedia — André Troutman', url: 'https://en.wikipedia.org/wiki/Andr%C3%A9_Troutman' },
  { label: 'Wikipedia — Roger Troutman', url: 'https://en.wikipedia.org/wiki/Roger_Troutman' },
  { label: 'Wikipedia — Zapp', url: 'https://en.wikipedia.org/wiki/Zapp' },
  { label: 'Wikipedia — "ALL THE LOVE"', url: 'https://en.wikipedia.org/wiki/All_the_Love_(Kanye_West_song)' },
];
