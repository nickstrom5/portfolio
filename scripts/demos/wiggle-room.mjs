// Wiggle Room: concept site for an indoor play center. Bright, chunky, built for a parent on a phone.
import { head, conceptNote, target } from './shared.mjs';

const slug = 'wiggle-room';
const base = `/demos/${slug}/`;
const INK = '#1d2a4d';
const nav = [['Play', 'play/'], ['Pricing', 'pricing/'], ['Parties & events', 'parties/'], ['Visit', 'visit/']];
const hours = '[[10,18],[9,18],[9,18],[9,18],[9,18],[9,20],[9,20]]';

const logo = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#ffc83d" stroke="${INK}" stroke-width="2.5"/><circle cx="14" cy="17" r="2.2" fill="${INK}"/><circle cx="26" cy="17" r="2.2" fill="${INK}"/><path d="M12 25q4 5 8 0t8 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/></svg>`;

const wave = (fill) => `<svg class="wave" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30Q150 0 300 30T600 30T900 30T1200 30V60H0Z" fill="${fill}"/></svg>`;

const g = (inner) => `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;
const art = {
  hero: `<svg class="hero-art" viewBox="0 0 520 470" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustration of a play structure with a slide, a tunnel and a ball pit">
${g(`<circle cx="392" cy="104" r="78" fill="#ffc83d"/>
<path d="M96 96a26 26 0 0 1 50-8a22 22 0 0 1 30 20a20 20 0 0 1-8 38H92a25 25 0 0 1 4-50Z" fill="#fff"/>
<path d="M52 400V262a104 104 0 0 1 208 0v138h-58V262a46 46 0 0 0-92 0v138Z" fill="#0f9f8f"/>
<rect x="300" y="196" width="78" height="204" rx="10" fill="#ffd9e2"/>
<path d="M300 236h78M300 280h78M300 324h78M300 368h78" fill="none"/>
<path d="M339 196v-62" fill="none"/><path d="M339 134l44 14l-44 16Z" fill="#e8452f"/>
<path d="M378 214c62 0 50 170 128 170v30c-98 0-80-170-128-170Z" fill="#e8452f"/>
<rect x="14" y="392" width="492" height="66" rx="33" fill="#cdeaff"/>
<circle cx="64" cy="404" r="26" fill="#ffc83d"/><circle cx="118" cy="420" r="22" fill="#e8452f"/><circle cx="170" cy="402" r="25" fill="#fff"/>
<circle cx="226" cy="420" r="23" fill="#0f9f8f"/><circle cx="280" cy="404" r="25" fill="#ffd9e2"/><circle cx="334" cy="420" r="22" fill="#ffc83d"/>
<circle cx="388" cy="406" r="25" fill="#fff"/><circle cx="444" cy="420" r="23" fill="#e8452f"/>
<path d="M214 78l8 18l18 8l-18 8l-8 18l-8-18l-18-8l18-8Z" fill="#e8452f"/>
<path d="M470 236l5 12l12 5l-12 5l-5 12l-5-12l-12-5l12-5Z" fill="#fff"/>`)}</svg>`,
  tiny: `<rect width="320" height="200" fill="#ffd9e2"/><rect y="168" width="320" height="32" fill="#fff" opacity=".55"/>
${g(`<rect x="38" y="108" width="60" height="60" rx="12" fill="#ffc83d"/><rect x="98" y="108" width="60" height="60" rx="12" fill="#0f9f8f"/><rect x="68" y="48" width="60" height="60" rx="12" fill="#e8452f"/>
<path d="M182 168v-48a44 44 0 0 1 88 0v48h-24v-48a20 20 0 0 0-40 0v48Z" fill="#fff"/><circle cx="292" cy="148" r="20" fill="#cdeaff"/><circle cx="226" cy="44" r="15" fill="#ffc83d"/>`)}`,
  climb: `<rect width="320" height="200" fill="#cdeaff"/><rect y="168" width="320" height="32" fill="#fff" opacity=".55"/>
${g(`<path d="M52 30v138M142 30v138" fill="none"/><path d="M52 60l90 44M142 60l-90 44M52 118l90 44M142 118l-90 44" fill="none" stroke-width="2"/>
<rect x="38" y="42" width="118" height="16" rx="8" fill="#e8452f"/><rect x="38" y="102" width="118" height="16" rx="8" fill="#ffc83d"/>
<path d="M156 100c64 0 54 56 132 56v14c-92 0-80-54-132-54Z" fill="#0f9f8f"/>
<path d="M214 40a16 16 0 0 1 31-4a14 14 0 0 1 20 13a13 13 0 0 1-5 25h-48a16 16 0 0 1 2-34Z" fill="#fff"/>`)}`,
  makers: `<rect width="320" height="200" fill="#c9f1e4"/>
${g(`<rect x="150" y="44" width="124" height="112" rx="8" fill="#fff" transform="rotate(6 212 100)"/>
<path d="M176 118q14-32 28-8t28-10t22 8" fill="none" stroke="#e8452f" stroke-width="5"/>
<rect x="54" y="46" width="22" height="112" rx="8" fill="#e8452f" transform="rotate(-18 65 102)"/><rect x="88" y="46" width="22" height="112" rx="8" fill="#ffc83d" transform="rotate(-6 99 102)"/><rect x="122" y="46" width="22" height="112" rx="8" fill="#0f9f8f" transform="rotate(8 133 102)"/>
<circle cx="268" cy="160" r="16" fill="#ffc83d"/><circle cx="40" cy="170" r="10" fill="#ffd9e2"/>`)}`,
  cafe: `<rect width="320" height="200" fill="#ffc83d"/>
${g(`<ellipse cx="150" cy="152" rx="76" ry="12" fill="#fff"/><path d="M104 84h92v30a46 40 0 0 1-92 0Z" fill="#fff"/><path d="M196 94h12a15 15 0 0 1 0 30h-14" fill="none"/>
<path d="M132 70q-8-10 0-20t0-20M166 70q-8-10 0-20t0-20" fill="none"/>
<circle cx="258" cy="140" r="24" fill="#e9a66b"/><circle cx="250" cy="134" r="2" fill="${INK}"/><circle cx="266" cy="140" r="2" fill="${INK}"/><circle cx="254" cy="150" r="2" fill="${INK}"/>`)}`,
};
const zoneArt = (key, label) => `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${art[key]}</svg>`;

const map = `<svg viewBox="0 0 600 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map showing Wiggle Room on Juniper Street, next to Fountain Park">
<rect width="600" height="320" fill="#e6f1e0"/><circle cx="470" cy="90" r="80" fill="#bfe3b4"/><rect x="40" y="200" width="150" height="90" rx="14" fill="#d8e6f5"/>
<path d="M0 170h600M300 0v320M0 60l230 110M410 320l90-150" stroke="#fff" stroke-width="26" fill="none"/>
<g font-family="Nunito, sans-serif" font-weight="800" font-size="14" fill="#4a5677"><text x="26" y="160">Juniper Street</text><text x="470" y="96" text-anchor="middle">Fountain Park</text><text x="115" y="250" text-anchor="middle">Free parking</text></g>
<g stroke="${INK}" stroke-width="3"><path d="M300 176c-30-36-44-52-44-74a44 44 0 0 1 88 0c0 22-14 38-44 74Z" fill="#e8452f"/><circle cx="300" cy="102" r="15" fill="#fff"/></g></svg>`;

const zones = [
  { key: 'tiny', bg: 'pink', age: 'Ages 0 to 3', name: 'Tiny Town', text: 'A gated soft-play world for crawlers and new walkers, away from the big-kid traffic.', label: 'Soft play blocks and a small arch', ticks: ['Padded floor, low climbers and a baby ball pit', 'Sensory wall with lights, textures and sounds', 'Nursing nook and changing room right beside it'] },
  { key: 'climb', bg: 'sky', age: 'Ages 4 to 10', name: 'The Big Climb', text: 'Three levels of nets, bridges and tunnels that end in a pair of racing slides.', label: 'Climbing frame with a net and a slide', ticks: ['Twin 20-foot racing slides', 'Spider net, rope bridge and lookout tower', 'Grown-ups fit too, and yes, you are allowed'] },
  { key: 'makers', bg: 'mint', age: 'All ages', name: 'Makers Corner', text: 'A calmer table for building, drawing and the craft of the day, included with entry.', label: 'Crayons and a drawing', ticks: ['A new craft every day at 11am and 3pm', 'Giant foam blocks and magnetic tiles', 'Take your masterpiece home'] },
];

const reviews = [
  ['We came for an hour and stayed for three. My four-year-old slept the whole drive home.', 'Priya, mum of two'],
  ['Best party we have thrown. We showed up with a cake and they handled everything else.', 'Marcus, dad of a new six-year-old'],
  ['Clean, bright and the coffee is actually good. Tiny Town is perfect for my one-year-old.', 'Elena, mum of one'],
];

const events = [
  ['Fri', 'Nov', '20', 'Glow Night', 'Lights down, glow sticks out, music up. 5pm to 8pm, regular entry.', 'All ages'],
  ['Sun', 'Nov', '22', 'Sensory Hour', 'Low lights, no music and a smaller crowd, before we open to everyone. 9am to 10am.', 'Quiet play'],
  ['Tue', 'Nov', '24', 'Toddler Tunes', 'Songs, shakers and bubbles with Miss Jo. 10am, free with entry.', 'Ages 0 to 3'],
  ['Fri', 'Dec', '4', 'Parents’ Night Out', 'Drop the kids for pizza, play and a movie. 5pm to 8pm, $35 per child, booking needed.', 'Ages 4 to 10'],
  ['Sat', 'Dec', '12', 'Winter Wiggle Party', 'Snow machine, hot chocolate bar and cookie decorating all afternoon.', 'All ages'],
];

const band = (title, text, cta, href) => `<section class="band"><div class="wrap"><div><h2>${title}</h2><p>${text}</p></div><a class="btn btn-sun" href="${base}${href}">${cta}</a></div></section>`;

const pages = [
  {
    path: '',
    title: 'Wiggle Room | Indoor play, café and parties',
    desc: 'Three floors of slides, climbers and soft play for ages 0 to 10, with a café for the grown-ups. Walk in any day.',
    body: `<section class="hero"><div class="wrap">
<div><p class="eyebrow">Indoor play · Café · Parties</p>
<h1>Big play for <em>little legs.</em></h1>
<p class="lead">Three floors of slides, climbers and soft play for ages 0 to 10, with good coffee for the grown-ups. Walk in any day, no booking needed.</p>
<div class="btns"><a class="btn btn-sun" href="${base}pricing/">See prices</a><a class="btn" href="${base}parties/">Plan a party</a></div>
<p class="meta"><span class="pill" data-hours="${hours}">Open daily from 9am</span><span>240 Juniper Street, Brightwater</span></p></div>
${art.hero}</div>
${wave(INK)}</section>
<section class="stats" aria-label="At a glance"><div class="wrap">
<p><strong>12,000 sq ft</strong><span>of indoor play</span></p><p><strong>Ages 0 to 10</strong><span>with a zone for each size</span></p><p><strong>3 times a day</strong><span>every surface is cleaned</span></p><p><strong>Grown-ups free</strong><span>and the Wi-Fi is too</span></p></div></section>
<section class="sec"><div class="wrap"><div class="sec-head"><p class="eyebrow">What's inside</p><h2>Something for every size</h2><p>Babies get their own gated space, big kids get the tall stuff, and everyone meets in the middle to make things.</p></div>
<div class="grid g3">${zones.map((z) => `<article class="card"><div class="zone-art">${zoneArt(z.key, z.label)}</div><span class="tag bg-${z.bg}" style="align-self:flex-start;margin-top:14px">${z.age}</span><h3>${z.name}</h3><p>${z.text}</p></article>`).join('')}</div>
<div class="btns"><a class="btn" href="${base}play/">Explore the play zones</a></div></div></section>
<section class="sec bg-sky"><div class="wrap"><div class="sec-head"><p class="eyebrow">Your first visit</p><h2>In the door in two minutes</h2></div>
<ol class="grid g3 steps"><li><strong>Sign the waiver online</strong>Do it once from your phone and it covers the whole family for a year.</li><li><strong>Check in, socks on</strong>Everyone plays in socks. Forgot yours? Grip socks are $3 at the desk.</li><li><strong>Play as long as you like</strong>Entry is good all day, so pop out for lunch and come back.</li></ol></div></section>
<section class="sec"><div class="wrap"><div class="sec-head"><p class="eyebrow">Prices</p><h2>Simple prices, no surprises</h2></div>
<div class="grid g3"><article class="card"><span class="tag bg-mint" style="align-self:flex-start">Walk in</span><h3>Day pass</h3><p class="price">$10 <small>from, per child</small></p><p>All-day play. Babies under one and grown-ups are free.</p></article>
<article class="card pop"><span class="tag bg-white" style="align-self:flex-start">Most popular</span><h3>Monthly membership</h3><p class="price">$45 <small>a month</small></p><p>Unlimited weekday play and 10% off parties and the café.</p></article>
<article class="card"><span class="tag bg-pink" style="align-self:flex-start">Save 20%</span><h3>10-visit pass</h3><p class="price">$110</p><p>Ten visits to share between siblings. Never expires.</p></article></div>
<div class="btns"><a class="btn btn-sun" href="${base}pricing/">See all prices</a></div></div></section>
${band('Birthdays without the cleanup', 'A private room, a party host, pizza and two hours of play. You bring the cake.', 'See party packages', 'parties/')}
<section class="sec bg-mint"><div class="wrap"><div class="sec-head"><p class="eyebrow">Parents say</p><h2>Loved by small people and their tall people</h2></div>
<div class="grid g3">${reviews.map(([q, who]) => `<blockquote class="quote"><p class="stars" aria-label="5 out of 5 stars">★★★★★</p><p>${q}</p><footer>${who}</footer></blockquote>`).join('')}</div></div></section>`,
  },
  {
    path: 'play/',
    title: 'Play zones | Wiggle Room',
    desc: 'Tiny Town for babies and toddlers, The Big Climb for ages 4 to 10, Makers Corner for everyone and a café for grown-ups.',
    hero: ['bg-sky', 'Play zones', 'Four ways to wear them out', 'Every zone is included with entry. Move between them as often as you like.'],
    body: `<section class="sec"><div class="wrap">
${zones.map((z) => `<article class="feature"><div class="feature-art">${zoneArt(z.key, z.label)}</div><div><span class="tag bg-${z.bg}">${z.age}</span><h2>${z.name}</h2><p>${z.text}</p><ul class="ticks">${z.ticks.map((t) => `<li>${t}</li>`).join('')}</ul></div></article>`).join('')}
<article class="feature"><div class="feature-art">${zoneArt('cafe', 'A cup of coffee and a cookie')}</div><div><span class="tag bg-sun">For the grown-ups</span><h2>The Perch Café</h2><p>Proper espresso and a seat with a clear view of the whole play floor.</p><ul class="ticks"><li>Local roast coffee, tea and fresh pastries</li><li>Kids' lunch boxes, fruit pots and toasties</li><li>Nut-free kitchen, with gluten-free options every day</li></ul></div></article>
</div></section>
<section class="sec bg-pink"><div class="wrap"><div class="sec-head"><p class="eyebrow">Good to know</p><h2>House rules, the short version</h2></div>
<div class="grid g4"><div class="quote"><h3>Socks on</h3><p>Kids and grown-ups. Grip socks are $3 at the desk.</p></div><div class="quote"><h3>Stay close</h3><p>A grown-up stays with their children for the whole visit.</p></div><div class="quote"><h3>Step-free</h3><p>Ramp entry, a lift to every floor and an accessible restroom.</p></div><div class="quote"><h3>Feeling ill?</h3><p>Stay home and we'll move your booking for free.</p></div></div></div></section>
${band('Ready to play?', 'Walk in any day. Sign the waiver ahead of time and skip the line.', 'Check prices', 'pricing/')}`,
  },
  {
    path: 'pricing/',
    title: 'Prices and memberships | Wiggle Room',
    desc: 'Day passes from $10, a 10-visit pass and monthly memberships. Grown-ups and babies under one always play free.',
    hero: ['bg-sun', 'Prices', 'Simple prices, no surprises', 'Entry is good all day. Grown-ups and babies under one are always free.'],
    body: `<section class="sec" data-scope><div class="wrap">
<div class="sec-head"><h2>Day passes</h2><p>Pick a day to see the price.</p></div>
<div class="switch" data-tabs role="group" aria-label="Day of the week"><button type="button" data-tab="weekday" aria-pressed="true">Mon to Thu</button><button type="button" data-tab="weekend" aria-pressed="false">Fri to Sun</button></div>
<div class="grid g3" style="margin-top:28px">
<article class="card"><span class="tag bg-pink" style="align-self:flex-start">Under 1</span><h3>Crawlers</h3><p class="price">Free</p><p>With a paying sibling or on their own. Tiny Town is all theirs.</p></article>
<article class="card"><span class="tag bg-mint" style="align-self:flex-start">Ages 1 to 3</span><h3>Toddlers</h3><p class="price" data-v-weekday="$10" data-v-weekend="$13">$10</p><p>All-day play in Tiny Town and Makers Corner.</p></article>
<article class="card"><span class="tag bg-sky" style="align-self:flex-start">Ages 4 to 10</span><h3>Big kids</h3><p class="price" data-v-weekday="$14" data-v-weekend="$17">$14</p><p>All-day play in every zone, The Big Climb included.</p></article></div></div></section>
<section class="sec bg-sky"><div class="wrap"><div class="sec-head"><p class="eyebrow">Come often?</p><h2>Passes and memberships</h2></div>
<div class="grid g3">
<article class="card"><h3>10-visit pass</h3><p class="price">$110</p><ul class="ticks"><li>Ten visits, any day of the week</li><li>Share it between siblings</li><li>Never expires</li></ul><a class="btn" href="${base}visit/">Buy at the desk</a></article>
<article class="card pop"><span class="tag bg-white" style="align-self:flex-start">Most popular</span><h3>Monthly membership</h3><p class="price">$45 <small>a month</small></p><ul class="ticks"><li>Unlimited play, Monday to Thursday</li><li>Half-price entry Friday to Sunday</li><li>10% off parties and the café</li><li>Add a sibling for $20</li></ul><a class="btn" href="${base}visit/">Join today</a></article>
<article class="card"><h3>Annual membership</h3><p class="price">$420 <small>a year</small></p><ul class="ticks"><li>Unlimited play, every day</li><li>Two free guest passes a month</li><li>First pick of party dates</li></ul><a class="btn" href="${base}visit/">Ask about annual</a></article></div></div></section>
<section class="sec"><div class="wrap"><div class="sec-head"><h2>Questions parents ask</h2></div>
<div class="faq">
<details><summary>Do I need to book ahead?</summary><p>No. Walk in any time we're open. On rainy weekends we can fill up, so it's worth a quick call before you set off.</p></details>
<details><summary>Can I bring my own food?</summary><p>Baby food and birthday cake for a booked party, yes. Otherwise please use the café. Our kitchen is nut-free, so we ask that outside snacks stay in the bag.</p></details>
<details><summary>Can I leave and come back?</summary><p>Yes. Your wristband is good until we close, so nap time and lunch runs are no problem.</p></details>
<details><summary>Can I pause a membership?</summary><p>Any time, for up to three months a year. Tell us at the desk or send a message from the Visit page.</p></details>
</div></div></section>
${band('Planning a birthday?', 'Party packages start at $289 and members save 10%.', 'See party packages', 'parties/')}`,
  },
  {
    path: 'parties/',
    title: 'Parties and events | Wiggle Room',
    desc: 'Birthday party packages with a private room, host and pizza, plus weekly events like Glow Night and Sensory Hour.',
    hero: ['bg-pink', 'Parties & events', 'Parties they talk about until the next one', 'You bring the cake and the kids. We do the setting up, the hosting and all of the cleaning.'],
    body: `<section class="sec"><div class="wrap"><div class="sec-head"><h2>Build your party</h2><p>Pick a package and a headcount to see a price right away. No forms, no waiting for a quote.</p></div>
<form class="estimator" data-estimator>
<div>
<fieldset><legend>1. Choose a package</legend><div class="options">
<label class="option"><input type="radio" name="package" data-base="289" data-included="10" data-extra="15"><span>Mini Wiggle<br><small>90 minutes, Monday to Thursday, shared party table</small></span><span>$289</span></label>
<label class="option"><input type="radio" name="package" data-base="429" data-included="16" data-extra="15" checked><span>Big Wiggle<br><small>2 hours, private room, party host, pizza and juice</small></span><span>$429</span></label>
<label class="option"><input type="radio" name="package" data-base="899" data-included="30" data-extra="12"><span>The Whole Place<br><small>2.5 hours after closing, the entire play floor to yourselves</small></span><span>$899</span></label></div></fieldset>
<div style="margin-bottom:26px"><label class="label" for="kids">2. How many children? <strong data-kids>16</strong></label><input type="range" id="kids" name="kids" min="6" max="40" value="16"></div>
<fieldset><legend>3. Add extras</legend><div class="options">
<label class="option"><input type="checkbox" data-flat="60"><span>Balloon arch in your colors</span><span>$60</span></label>
<label class="option"><input type="checkbox" data-per="6"><span>Goodie bags</span><span>$6 each</span></label>
<label class="option"><input type="checkbox" data-flat="45"><span>Coffee and pastries for the grown-ups</span><span>$45</span></label></div></fieldset>
</div>
<aside class="card bg-sun total" aria-live="polite"><p class="eyebrow" style="color:${INK}">Your estimate</p><p class="price" data-total>$429</p><p data-note>Up to 16 children are included in this package.</p><a class="btn" href="${base}visit/">Check a date</a></aside>
</form></div></section>
<section class="sec bg-mint"><div class="wrap"><div class="sec-head"><p class="eyebrow">Every party includes</p><h2>The boring parts, handled</h2></div>
<div class="grid g4"><div class="quote"><h3>Setup</h3><p>Table dressed, plates out and candles ready before you arrive.</p></div><div class="quote"><h3>A host</h3><p>One of our team runs the day so you can be in the photos.</p></div><div class="quote"><h3>Invites</h3><p>A printable and a text-ready invite with the waiver link built in.</p></div><div class="quote"><h3>Cleanup</h3><p>Walk out with the presents. We deal with the rest.</p></div></div></div></section>
<section class="sec"><div class="wrap"><div class="sec-head"><p class="eyebrow">What's on</p><h2>Upcoming events</h2><p>Events are included with entry unless we say otherwise.</p></div>
<ul class="events">${events.map(([d, month, day, name, text, tag]) => `<li><p class="date"><small>${d}</small> <span>${month}</span> <span>${day}</span></p><div><h3>${name}</h3><p>${text}</p></div><span class="tag bg-sun">${tag}</span></li>`).join('')}</ul></div></section>
${band('Got a date in mind?', 'Saturdays book up about six weeks out. Send us a message and we will hold your slot for 48 hours.', 'Ask about a date', 'visit/')}`,
  },
  {
    path: 'visit/',
    title: 'Visit and contact | Wiggle Room',
    desc: 'Find Wiggle Room at 240 Juniper Street, Brightwater. Opening hours, parking, directions and a contact form.',
    hero: ['bg-mint', 'Visit', 'Come and say hi', 'We are on Juniper Street next to Fountain Park, with free parking right outside.'],
    body: `<section class="sec"><div class="wrap grid g2">
<div><h2>Send us a message</h2><p class="lead" style="margin-bottom:24px">Party dates, memberships, lost shoes. We answer within one working day.</p>
<form class="form" data-demo-form>
<label>Your name<input type="text" name="name" autocomplete="name" required></label>
<label>Email<input type="email" name="email" autocomplete="email" required></label>
<label>What's it about?<select name="topic"><option>Booking a party</option><option>Memberships and passes</option><option>Group or school visit</option><option>Something else</option></select></label>
<label>Message<textarea name="message" rows="5" required></textarea></label>
<button class="btn btn-sun" type="submit">Send message</button></form>
<div class="thanks" data-thanks hidden tabindex="-1"><h2>Thanks, got it!</h2><p>On a live site this would land in the front desk inbox and you would get a confirmation email. This is a concept site, so nothing was sent.</p></div></div>
<div><div class="card"><p><span class="pill" data-hours="${hours}">Open daily from 9am</span></p><h2 style="font-size:1.6rem;margin:16px 0 10px">Opening hours</h2>
<table class="hours"><tbody><tr><td>Monday to Thursday</td><td>9am to 6pm</td></tr><tr><td>Friday and Saturday</td><td>9am to 8pm</td></tr><tr><td>Sunday</td><td>10am to 6pm</td></tr></tbody></table>
<h2 style="font-size:1.6rem;margin:26px 0 10px">Find us</h2><p>240 Juniper Street, Brightwater<br><a href="tel:+15550142200">(555) 014-2200</a><br><a href="mailto:hello@wiggleroom.example">hello@wiggleroom.example</a></p></div>
<div class="map" style="margin-top:24px">${map}</div></div>
</div></section>
<section class="sec bg-sky"><div class="wrap"><div class="sec-head"><h2>Getting here</h2></div>
<div class="grid g3"><div class="quote"><h3>By car</h3><p>Free parking for 60 cars beside the building, with six wide family bays by the door.</p></div><div class="quote"><h3>By bus</h3><p>Routes 12 and 40 stop at Fountain Park, a two-minute walk away.</p></div><div class="quote"><h3>With a stroller</h3><p>Step-free from the car park to every floor, with indoor stroller parking at the entrance.</p></div></div></div></section>`,
  },
];

function layout(p) {
  const here = base + p.path;
  return `<!doctype html>
<html lang="en">
<head>
${head({ slug, title: p.title, desc: p.desc, path: here, theme: '#fff8ec', icon: logo, css: `${base}styles.css`, fonts: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@500;700;800;900&display=swap' })}
</head>
<body>
${target.top}<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap bar">
<a class="logo" href="${base}">${logo}Wiggle Room</a>
<button class="menu" type="button" data-menu aria-expanded="false" aria-controls="nav">Menu</button>
<nav id="nav" aria-label="Main">${nav.map(([label, path]) => `<a href="${base}${path}"${path === p.path ? ' aria-current="page"' : ''}>${label}</a>`).join('')}<a class="btn btn-sun" href="${base}parties/">Book a party</a></nav>
</div></header>
<main id="main">
${p.hero ? `<section class="page-hero ${p.hero[0]}"><div class="wrap"><p class="eyebrow">${p.hero[1]}</p><h1>${p.hero[2]}</h1><p class="lead">${p.hero[3]}</p></div></section>` : ''}
${p.body}
</main>
<footer class="foot"><div class="wrap">
<div class="grid"><div><a class="logo" href="${base}">${logo}Wiggle Room</a><p>Indoor play, café and parties for ages 0 to 10.</p></div>
<div><p class="title">Visit</p><ul><li>240 Juniper Street, Brightwater</li><li>Mon to Thu, 9am to 6pm</li><li>Fri and Sat, 9am to 8pm</li><li>Sunday, 10am to 6pm</li></ul></div>
<div><p class="title">Explore</p><ul>${nav.map(([label, path]) => `<li><a href="${base}${path}">${label}</a></li>`).join('')}</ul></div></div>
<p class="note">${conceptNote('Wiggle Room')}</p>
</div></footer>
${target.bottom}</body>
</html>
`;
}

export default { slug, pages, layout, heroSvg: art.hero, fontFaces: [['Fredoka', 'fredoka', 600, 'normal'], ['Nunito', 'nunito', 500, 'normal'], ['Nunito', 'nunito', 700, 'normal'], ['Nunito', 'nunito', 800, 'normal'], ['Nunito', 'nunito', 900, 'normal']] };
