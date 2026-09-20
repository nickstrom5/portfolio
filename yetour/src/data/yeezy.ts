/**
 * THE YEEZY ARCHIVE — twelve rooms, 2004 to now.
 *
 * Written as a museum walk-through: each room is an era, each exhibit carries
 * an object label the way a vitrine would. Dates and partners are sourced (see
 * `yeezySources`); the wall text is editorial and reads as such.
 *
 * As everywhere on this site, nothing here reproduces a photograph. Each
 * exhibit is an original vector drawing — which is as high-resolution as an
 * image gets, since it has no resolution at all.
 */

export type Figure =
  | 'bapesta' | 'hightop' | 'midtop' | 'boot' | 'runner' | 'stripe'
  | 'chunky' | 'foam' | 'slide' | 'varsity' | 'bomber' | 'fur'
  | 'gown' | 'bodysuit' | 'tee' | 'hoodie' | 'puffer' | 'sock' | 'pod' | 'shades';

export interface Exhibit {
  id: string;
  label: string;
  year: string;
  figure: Figure;
  /** Museum-style materials line. */
  material: string;
  /** The object label a visitor would read on the wall. */
  note: string;
}

export interface Room {
  id: string;
  n: number;
  title: string;
  years: string;
  /** Partner, venue or billing. */
  billing: string;
  accent: string;
  /** One line under the room number, for the floor plan and the rail. */
  strap: string;
  wall: string[];
  exhibits: Exhibit[];
}

export const rooms: Room[] = [
  {
    id: 'pastelle',
    n: 1,
    title: 'Pastelle',
    years: '2004 — 2009',
    billing: 'His own label, never released',
    accent: '#d9a441',
    strap: 'The label that never opened',
    wall: [
      'Before any of it, there was Pastelle. He started it around the time of The College Dropout and worked on it for five years: a full streetwear label with collections, samples and a logo, which never reached a single shop.',
      'The public saw it once. At the 2008 American Music Awards he performed in a Pastelle varsity jacket, and that jacket is the most famous garment from a brand that does not technically exist. He shelved it shortly after, reportedly because it was not ready.',
      'People who worked on it describe it less as a failed business than as a five-year design education conducted in private. Everything in the eleven rooms after this one was rehearsed here.',
    ],
    exhibits: [
      { id: 'pastelle-varsity', label: 'Pastelle varsity jacket', year: '2008', figure: 'varsity', material: 'Wool body, leather sleeves, chenille patch', note: 'Worn on stage at the American Music Awards in November 2008 and effectively the brand’s only public appearance. Never sold at retail.' },
      { id: 'bapesta', label: 'Bapesta × Kanye West', year: '2007', figure: 'bapesta', material: 'Patent leather, rubber cup sole', note: 'Made with Nigo at A Bathing Ape and finished in the Dropout Bear artwork. The first product with his name on the box.' },
    ],
  },
  {
    id: 'lv-airyeezy',
    n: 2,
    title: 'Louis Vuitton & the Air Yeezy',
    years: '2009',
    billing: 'Louis Vuitton · Nike',
    accent: '#cfa94a',
    strap: 'A rapper on a luxury last',
    wall: [
      'In 2009 he did two things nobody had done. He designed footwear for Louis Vuitton — the Don, the Jasper and the Mr Hudson — at a point when a rapper on a luxury house’s product was genuinely unusual rather than a press release.',
      'And he got a signature shoe from Nike without being an athlete. The Air Yeezy 1, developed with Mark Smith, is the reason every musician since has been able to ask for one.',
      'These two objects are why the rest of this archive exists. The rest is scale.',
    ],
    exhibits: [
      { id: 'lv-don', label: 'Louis Vuitton "Don"', year: '2009', figure: 'hightop', material: 'Calf leather, patent overlays', note: 'One of three silhouettes he designed for Louis Vuitton’s 2009 footwear line, alongside the Jasper and the Mr Hudson.' },
      { id: 'airyeezy1', label: 'Nike Air Yeezy 1', year: '2009', figure: 'midtop', material: 'Nubuck, patent leather strap, glow outsole', note: 'The first Nike signature shoe given to someone who was not an athlete. A 2008 sample pair later sold at auction for $1.8 million.' },
    ],
  },
  {
    id: 'dw',
    n: 3,
    title: 'DW Kanye West',
    years: '2011 — 2012',
    billing: 'Paris Fashion Week',
    accent: '#c2564f',
    strap: 'Named for his mother. Reviewed badly.',
    wall: [
      'DW is his mother’s initials. He put Donda West’s name on a womenswear label and took it to Paris, twice: a spring 2012 collection in October 2011 and a fall collection the following March, in front of Anna Wintour, Robin Givhan and a room full of people waiting to see whether he could actually do it.',
      'The reviews were brutal. Fur, leather, exposed construction, very short hems — read at the time as a musician playing dress-up rather than a designer with a point of view.',
      'He did not show a third season. What he did instead was disappear into internships and studios for three years and come back with an adidas contract. The failure in this room is the most important thing in the building.',
    ],
    exhibits: [
      { id: 'dw-fur', label: 'Fur coat, DW', year: '2011', figure: 'fur', material: 'Dyed fur, leather trim', note: 'From the spring 2012 collection shown in Paris in October 2011 — the pieces the critics reached for first, in both directions.' },
      { id: 'dw-gown', label: 'Leather dress, DW', year: '2012', figure: 'gown', material: 'Leather, exposed seams', note: 'From the second and final DW collection, shown in Paris in March 2012.' },
    ],
  },
  {
    id: 'airyeezy2',
    n: 4,
    title: 'Air Yeezy 2 & the exit',
    years: '2012 — 2014',
    billing: 'Nike',
    accent: '#ff3b2a',
    strap: 'The best-selling shoe he walked away from',
    wall: [
      'The Air Yeezy 2 arrived in June 2012 in Solar Red and Pure Platinum and sold out in minutes. It is, by most measures, the most desirable sneaker of its decade.',
      'He left anyway. The public version of the split is royalties: Nike would not pay them on a shoe by someone who was not an athlete. The Red October, released in February 2014 after he had already signed elsewhere, is the last Nike Yeezy.',
      'Nine months later he was an adidas designer, and the sneaker business changed shape.',
    ],
    exhibits: [
      { id: 'ay2-solar', label: 'Air Yeezy 2 "Solar Red"', year: '2012', figure: 'midtop', material: 'Anaconda-textured leather, moulded heel cage', note: 'June 2012. The scaled upper and the wing detail made it the most counterfeited sneaker of the era.' },
      { id: 'ay2-red', label: 'Air Yeezy 2 "Red October"', year: '2014', figure: 'midtop', material: 'Tonal red leather, red outsole', note: 'Released in February 2014 with no announcement and no marketing, months after he had already signed to adidas.' },
    ],
  },
  {
    id: 'apc',
    n: 5,
    title: 'A.P.C.',
    years: '2013 — 2014',
    billing: 'A.P.C. · Jean Touitou',
    accent: '#9aa3ad',
    strap: 'The plain years',
    wall: [
      'Two small capsule collections with Jean Touitou at A.P.C.: a t-shirt, a hoodie, a pair of jeans, a bomber, in grey and off-white, at prices that caused arguments.',
      'It is the least spectacular thing in this building and the most instructive. After the maximalism of DW, this is him learning that a plain heavyweight t-shirt with the right neck and the right drop is a product, and that the hard part is the pattern, not the print.',
      'Every Yeezy Season that follows is built out of this vocabulary.',
    ],
    exhibits: [
      { id: 'apc-tee', label: 'Hip Hop T-shirt, A.P.C.', year: '2013', figure: 'tee', material: 'Heavyweight cotton jersey', note: 'From the first capsule, spring 2013. A plain tee at a price that made it a talking point, which was arguably the design.' },
      { id: 'apc-hoodie', label: 'Hoodie, A.P.C.', year: '2014', figure: 'hoodie', material: 'Brushed cotton fleece', note: 'From the second capsule. Tonal, unbranded, and the direct ancestor of the Yeezy Gap Perfect Hoodie seven years later.' },
    ],
  },
  {
    id: 'season1',
    n: 6,
    title: 'Yeezy Season 1',
    years: 'February 2015',
    billing: 'adidas Originals · New York Fashion Week',
    accent: '#c9c4bb',
    strap: 'An army standing still',
    wall: [
      'February 2015. Models in tonal nude and grey layers, standing in formation, barely moving, under a single wash of light — a Vanessa Beecroft tableau rather than a runway.',
      'Distressed knits, bomber jackets, military cuts, bodysuits, and a colour palette that looked like it had been left in the sun. Half the room did not know what they were looking at. Within eighteen months every mall in America was selling a version of it.',
      'The Yeezy Boost 750 came out the same month and sold out in ten minutes.',
    ],
    exhibits: [
      { id: 'boost750', label: 'Yeezy Boost 750', year: '2015', figure: 'boot', material: 'Suede upper, strap closure, Boost midsole', note: 'The first adidas Yeezy, released February 2015. A high-top boot on a foam midsole, in one colour, in tiny numbers.' },
      { id: 's1-bomber', label: 'Bomber jacket, Season 1', year: '2015', figure: 'bomber', material: 'Distressed nylon, ribbed trim', note: 'Military cut, washed finish, no branding anywhere on it. The look the next five years copied.' },
      { id: 's1-body', label: 'Bodysuit, Season 1', year: '2015', figure: 'bodysuit', material: 'Seamless stretch knit', note: 'Second-skin knitwear in tones matched to the wearer. The most imitated single idea of the whole project.' },
    ],
  },
  {
    id: 'season23',
    n: 7,
    title: 'Seasons 2 and 3',
    years: '2015 — 2016',
    billing: 'NYFW · Madison Square Garden',
    accent: '#f0821e',
    strap: 'Twenty thousand people in an arena, for clothes',
    wall: [
      'Season 2 came in September 2015: pink, tan, olive, weatherproof boots, cargo jackets, the palette people now think of as Yeezy.',
      'Season 3, on 11 February 2016, is the high-water mark. He filled Madison Square Garden — around twenty thousand people — with a Vanessa Beecroft installation of hundreds of models, premiered The Life of Pablo off a laptop in the middle of it, and streamed the whole thing to cinemas. A fashion show and an album launch and a piece of performance art, sold as one ticket.',
      'The Yeezy Boost 350 had arrived the previous June. By Season 3 it was the most wanted shoe on earth.',
    ],
    exhibits: [
      { id: 'boost350', label: 'Yeezy Boost 350 "Turtle Dove"', year: '2015', figure: 'runner', material: 'Primeknit upper, Boost midsole, gum outsole', note: 'June 2015. The silhouette that took Yeezy from a sneaker release to a category.' },
      { id: 's2-cargo', label: 'Cargo jacket, Season 2', year: '2015', figure: 'bomber', material: 'Weatherproof cotton, patch pockets', note: 'September 2015, New York. Olive and sand, built like workwear, priced like fashion.' },
      { id: 's3-body', label: 'Bodysuit, Season 3', year: '2016', figure: 'bodysuit', material: 'Stretch knit, raw-cut hems', note: 'Worn by hundreds of models standing in formation at Madison Square Garden on 11 February 2016.' },
    ],
  },
  {
    id: 'season456',
    n: 8,
    title: 'Seasons 4, 5 and 6',
    years: '2016 — 2018',
    billing: 'Roosevelt Island · Pier 59 · no runway',
    accent: '#b06ce0',
    strap: 'The part that went wrong, and the part that worked anyway',
    wall: [
      'Season 4, on 7 September 2016, was staged at Four Freedoms Park on Roosevelt Island. Guests were bussed out and left in direct sun; models in perspex heels struggled on the runway; some fainted. It is remembered as the show that did not work.',
      'Season 5, at Pier 59 in February 2017, was the correction: no spectacle, no installation, just clothes on a rotating stage. It was the best-reviewed collection of the whole run.',
      'Season 6, in 2018, had no runway at all. He photographed Kim Kardashian in the clothes as if by paparazzi, then hired lookalikes to do the same, and released it as a campaign. A fashion season delivered entirely as images.',
      'Underneath all of it the footwear kept compounding: the 350 V2 in 2016, the 700 Wave Runner in 2017, the shoe that started the chunky-sneaker decade.',
    ],
    exhibits: [
      { id: 'boost350v2', label: 'Yeezy Boost 350 V2', year: '2016', figure: 'stripe', material: 'Primeknit upper, side stripe, Boost midsole', note: 'The refinement that became the volume seller: a firmer upper and the lateral stripe you can identify from across a street.' },
      { id: 'boost700', label: 'Yeezy Boost 700 "Wave Runner"', year: '2017', figure: 'chunky', material: 'Mesh, suede and leather panels, Boost midsole', note: 'Deliberately ugly, deliberately heavy, and the shoe the entire industry spent the next five years imitating.' },
      { id: 's4-heel', label: 'Season 4 look', year: '2016', figure: 'bodysuit', material: 'Stretch knit, perspex heel', note: 'Roosevelt Island, 7 September 2016. The heels are the part everyone remembers, for the wrong reason.' },
    ],
  },
  {
    id: 'objects',
    n: 9,
    title: 'Season 8 and the object years',
    years: '2019 — 2021',
    billing: 'Paris · adidas',
    accent: '#57d3a5',
    strap: 'When the clothes became products',
    wall: [
      'Season 8 was shown in Paris on 27 February 2020, with North West performing at it. It is the last Yeezy runway show.',
      'What replaced the runway was objects. The Slide, a moulded foam sandal with no branding at all, became the best-selling thing the brand ever made by volume. The Foam Runner, in 2020, was a clog grown partly from algae, and it was genuinely unlike anything else on sale.',
      'This is the room where the project stops being fashion in the show-and-season sense and becomes industrial design: fewer pieces, stranger materials, enormous quantities.',
    ],
    exhibits: [
      { id: 'slide', label: 'Yeezy Slide', year: '2019', figure: 'slide', material: 'Moulded EVA foam, single piece', note: 'No logo, no stitching, one piece of foam. By volume, the most-sold Yeezy product there has ever been.' },
      { id: 'foam', label: 'Yeezy Foam Runner', year: '2020', figure: 'foam', material: 'EVA and algae-based foam, moulded', note: 'A perforated clog, partly grown rather than assembled. Ridiculed on arrival and sold out permanently thereafter.' },
      { id: 'sock', label: 'Knit runner', year: '2021', figure: 'sock', material: 'One-piece knit upper, foam sole unit', note: 'The sock-shoe end of the line: no laces, no tongue, no seams — the 450 and its relatives.' },
    ],
  },
  {
    id: 'gap',
    n: 10,
    title: 'Yeezy Gap',
    years: '2020 — 2022',
    billing: 'Gap · Balenciaga',
    accent: '#4a8bff',
    strap: 'A ten-year deal that lasted two',
    wall: [
      'Announced on 26 June 2020 as a multi-year partnership: Yeezy design, Gap distribution, aimed at the price point his own brand had never touched.',
      'The first product took a year. In June 2021 the Round Jacket arrived — a $200 recycled-nylon puffer with no collar and no logo, sold from a website with one image on it. The Perfect Hoodie followed at $90. Stores sold the clothes out of black bin bags, which was either a statement about consumption or a distribution failure, depending on who you asked.',
      'In January 2022 came Yeezy Gap Engineered by Balenciaga, with Demna, and a first drop that February. It is the strangest thing in this building: a Paris couture house engineering a Gap t-shirt.',
      'He terminated the deal in September 2022.',
    ],
    exhibits: [
      { id: 'round-jacket', label: 'Yeezy Gap Round Jacket', year: '2021', figure: 'puffer', material: 'Recycled nylon, down fill, no collar', note: 'June 2021, $200, in blue, black and red. The first Yeezy Gap product and the only one most people can name.' },
      { id: 'perfect-hoodie', label: 'Yeezy Gap Perfect Hoodie', year: '2021', figure: 'hoodie', material: 'Double-layered heavyweight cotton fleece', note: 'September 2021, $90. Unbranded, boxy, double-faced — the A.P.C. hoodie from room five, at mall scale.' },
      { id: 'balenciaga-tee', label: 'Engineered by Balenciaga', year: '2022', figure: 'tee', material: 'Cotton jersey, Balenciaga pattern block', note: 'Announced 7 January 2022, first drop 23 February: denim, logo tees, hoodies and puffers cut by Demna’s team.' },
    ],
  },
  {
    id: 'collapse',
    n: 11,
    title: 'Season 9 and the collapse',
    years: 'October 2022',
    billing: 'Paris',
    accent: '#8d949c',
    strap: 'The month it all ended',
    wall: [
      'He showed YZY Season 9 in Paris on 3 October 2022, wearing a shirt reading "White Lives Matter" and putting it on the runway. The reaction was immediate and it did not subside.',
      'Within days he made a series of antisemitic statements in public. Gap pulled Yeezy Gap product. On 25 October 2022, adidas terminated the partnership, ending the most profitable signature line in sportswear and writing off hundreds of millions in unsold stock.',
      'This room is here because an archive that skipped it would not be an archive. The clothes in the other eleven rooms are not separable from this one, and pretending otherwise is not curation.',
    ],
    exhibits: [
      { id: 's9-look', label: 'YZY Season 9 look', year: '2022', figure: 'hoodie', material: 'Heavyweight jersey', note: 'Paris, 3 October 2022. The last runway collection, and the one remembered for a shirt rather than for any garment on it.' },
      { id: 'shades', label: 'YZY shades', year: '2022', figure: 'shades', material: 'Injection-moulded frame, wraparound lens', note: 'The wraparound shield that outlived the partnership and became the visual signature of everything after it.' },
    ],
  },
  {
    id: 'yzy',
    n: 12,
    title: 'YZY, independent',
    years: '2023 — now',
    billing: 'YZY · no partner',
    accent: '#f2ede1',
    strap: 'No distributor, no retailer, no permission',
    wall: [
      'With no adidas, no Gap and no Nike, the brand rebuilt as a direct operation: product announced without warning, sold from his own site, shipped without a retailer in between.',
      'The YZY Pod in 2023 — a moulded one-piece foot covering somewhere between a sock and a shoe — is the clearest statement of the independent era. It exists to be argued about.',
      'In 2024 the remaining adidas stock was sold directly through yeezy.com. By 2026 the same operation was running a stadium tour and an album on its own label, and the merchandise table at those shows is the retail estate of the brand.',
      'Twelve rooms, twenty-two years, and it ends where it started: a label with no distributor, run out of his own hands.',
    ],
    exhibits: [
      { id: 'pod', label: 'YZY Pod', year: '2023', figure: 'pod', material: 'One-piece moulded foam', note: 'Neither shoe nor sock. Announced, photographed, argued about, sold direct.' },
      { id: 'yzy-tee', label: 'BULLY tour merchandise', year: '2026', figure: 'tee', material: 'Heavyweight cotton, tour print', note: 'Sold at the stadium merchandise table on the 2026 tour, which is now the brand’s physical retail footprint.' },
    ],
  },
];

export const yeezySources = [
  { label: 'Wikipedia — Yeezy (brand)', url: 'https://en.wikipedia.org/wiki/Yeezy_(brand)' },
  { label: 'Wikipedia — Adidas Yeezy', url: 'https://en.wikipedia.org/wiki/Adidas_Yeezy' },
  { label: 'Wikipedia — Yeezy Gap', url: 'https://en.wikipedia.org/wiki/Yeezy_Gap' },
  { label: 'Highsnobiety — Every YEEZY Season show so far', url: 'https://www.highsnobiety.com/p/yeezy-season-show-history/' },
  { label: 'Complex — A timeline of Kanye West’s clothing brands', url: 'https://www.complex.com/style/a/ian-stonebrook/kanye-west-clothing-brands-timeline' },
  { label: 'Complex — The untold story of Pastelle', url: 'https://www.complex.com/style/a/karizza-sanchez/kanye-west-pastelle-first-clothing-line-untold-story' },
  { label: 'Complex — Yeezy Season 3 at MSG, an oral history', url: 'https://www.complex.com/style/a/mike-destefano/yeezy-season-3-life-of-pablo-madison-square-garden-oral-history' },
  { label: 'Complex — A timeline of Yeezy Gap', url: 'https://www.complex.com/style/a/lei-takanashi/yeezy-gap-timeline-kanye-west' },
  { label: 'The Hollywood Reporter — Everything that happened at Yeezy Season 4', url: 'https://www.hollywoodreporter.com/news/general-news/yeezy-season-4-everything-happened-926310/' },
  { label: 'Forbes — Ahead of Yeezy Season 8, a look back at Seasons 1–7', url: 'https://www.forbes.com/sites/chrislambert/2020/02/29/ahead-of-yeezy-season-8-a-look-back-at-seasons-1-7/' },
];
