/**
 * Donda West (1949–2007) — the educator the 2021 album, the school, the
 * holding company and half the mythology are named for.
 *
 * Facts here are sourced; see `dondaSources`. There is no photograph of her on
 * this site: the images that exist are owned by the people who took them, so
 * her page carries an original drawn plate and a link to where the real
 * pictures live. Same rule as everywhere else in this archive.
 */

export interface Milestone {
  year: string;
  title: string;
  body: string;
}

export const donda = {
  name: 'Donda Clairann West',
  maiden: 'née Williams',
  born: '12 July 1949',
  bornPlace: 'Oklahoma City, Oklahoma',
  died: '10 November 2007',
  diedPlace: 'Los Angeles, California',
  title: 'Professor and chair, Department of English, Communications, Media and Theatre, Chicago State University',
  years: '27 years at Chicago State',
  book: 'Raising Kanye: Life Lessons from the Mother of a Hip-Hop Superstar (2007)',
} as const;

export const milestones: Milestone[] = [
  {
    year: '1971',
    title: 'BA in English, Virginia Union University',
    body: 'A historically Black university in Richmond, Virginia, and the start of a career spent almost entirely inside Black institutions of higher education.',
  },
  {
    year: 'Early 1970s',
    title: 'Teaching at Morris Brown College',
    body: 'Her first teaching post, at the HBCU in Atlanta, before the doctorate and before Chicago.',
  },
  {
    year: '1980',
    title: 'Doctorate, Auburn University',
    body: 'A PhD at a newly desegregated Southern university, finished the same year she joined the faculty at Chicago State.',
  },
  {
    year: '1980',
    title: 'Joins Chicago State University',
    body: 'She would spend 27 years there, rising to chair of the Department of English, Communications, Media and Theatre.',
  },
  {
    year: '1987',
    title: 'Fulbright year at Nanjing University',
    body: 'She taught English in China for a year as a Fulbright scholar and took her son with her. He was ten, and it is the reason a kid from South Shore spent a year in Nanjing.',
  },
  {
    year: 'Chicago State',
    title: 'Founded the Gwendolyn Brooks Center for Black Literature and Creative Writing',
    body: 'Named for the first Black writer to win the Pulitzer Prize, and still the thing her colleagues name first when asked what she built.',
  },
  {
    year: '2004',
    title: 'Retires to manage her son',
    body: 'She left the university in July 2004, six months after The College Dropout, to run West Brands — the parent company of his businesses — as chief executive.',
  },
  {
    year: '2004 —',
    title: 'Chair of the Kanye West Foundation',
    body: 'A nonprofit aimed at cutting dropout rates and raising literacy, including the Loop Dreams programme. An English professor building a dropout-prevention charity for the artist who made The College Dropout.',
  },
  {
    year: '2007',
    title: 'Raising Kanye',
    body: 'Her memoir, published months before she died: part parenting book, part account of a Black single mother raising a son she expected to be extraordinary.',
  },
  {
    year: '10 Nov 2007',
    title: 'Death in Los Angeles',
    body: 'She died the day after elective cosmetic surgery, aged 58. Nothing in his work after this point is untouched by it.',
  },
  {
    year: '2009',
    title: 'The Donda West Law',
    body: 'California Assembly Bill 1116, signed by Governor Schwarzenegger on 11 October 2009, made it illegal to perform elective cosmetic surgery without a physical examination and written clearance from a licensed practitioner within the previous 30 days. Her name is on a patient-safety statute.',
  },
];

export const namedForHer = [
  { name: 'Donda (2021)', body: 'His tenth album, made in public across three stadium listening events.' },
  { name: 'Donda’s Academy (2022)', body: 'A private school built around basketball, choir and design.' },
  { name: 'Donda Services', body: 'The entity that bought back her house on South Shore Drive in 2018.' },
  { name: '"Hey Mama" (2005)', body: 'Written for her while she was alive. He could not finish performing it for years afterwards.' },
  { name: 'The Runaway outro (2026)', body: 'Since Istanbul, the tour closer runs into an extended outro built on a spoken-word sample of her voice.' },
];

export const house = {
  address: '7815 S. South Shore Drive, Chicago, Illinois',
  neighbourhood: 'South Shore',
  built: 'circa 1905',
  size: 'about 1,600 square feet',
  status: 'Owned by an entity in his name. Restored. Behind on its property taxes.',
  timeline: [
    { year: '1985 — 2003', body: 'Donda West owns the house. Her son grows up in it, moves back into the basement as an adult, and makes his first records there.' },
    { year: '2003', body: 'She sells it. The property changes hands several times over the next decade.' },
    { year: '2016', body: 'A nonprofit led by Che "Rhymefest" Smith — a longtime collaborator and co-writer on "Jesus Walks" — buys the house and announces a plan to turn it into an arts incubator.' },
    { year: '2017', body: 'The nonprofit reports the building is in worse condition than expected and says it will be demolished and replaced.' },
    { year: 'Dec 2018', body: 'Donda Services, an entity in Kanye West’s name, buys the house for $225,000. The demolition does not happen.' },
    { year: 'Oct 2019', body: 'A work permit is issued to replace the roof. Renovation runs, on and off, for years.' },
    { year: '2021', body: 'For the Donda listening event at Soldier Field he first tries to move the actual house to the stadium floor, then settles for building a full-scale replica of it there instead.' },
    { year: 'Since', body: 'The restoration is reported complete, with a gate carrying the initials "DH". Cook County records have also shown an overdue property tax bill on it of around $1,514.' },
  ],
};

export const dondaSources = [
  { label: 'Wikipedia — Donda West', url: 'https://en.wikipedia.org/wiki/Donda_West' },
  { label: 'California Legislature — AB 1116, the Donda West Law (chaptered text)', url: 'https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=200920100AB1116' },
  { label: 'Preservation Chicago — Kanye West buys his childhood home to prevent demolition', url: 'https://www.preservationchicago.org/win-grammy-winning-performer-kanye-west-buys-his-childhood-home-to-prevent-demolition/' },
  { label: 'DNAinfo Chicago — Boyhood home to be torn down for a South Side arts centre', url: 'https://www.dnainfo.com/chicago/20171005/south-shore/kanye-west-boyhood-home-south-side-music-museum-rhymefest-che-smith-dondas-mom-lite-houses/' },
  { label: 'Archinect — He originally planned to move the actual house to Soldier Field', url: 'https://archinect.com/news/article/150279978/kanye-west-originally-planned-to-move-his-actual-childhood-home-to-chicago-s-soldier-field-for-donda-listening-event' },
  { label: 'Wikimedia Commons — photographs of Donda West', url: 'https://commons.wikimedia.org/wiki/Category:Donda_West' },
];
