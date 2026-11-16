// Little Fern Playhouse: concept site for a small play studio. Calm and editorial, the opposite of Wiggle Room.
import { head, conceptNote } from './shared.mjs';

const slug = 'little-fern';
const base = `/demos/${slug}/`;
const nav = [['Programs', 'programs/'], ['Pricing', 'pricing/'], ['Events', 'events/'], ['Contact', 'contact/']];
const hours = '[null,[8.5,17],[8.5,17],[8.5,17],[8.5,17],[8.5,17],[9,15]]';
const C = { forest: '#24382b', sage: '#6f8f72', hill: '#9db59a', clay: '#b85a34', gold: '#e9b872', mist: '#a9c3c7', cream: '#faf5ea', wood: '#e3cfa6' };

const logo = `<svg viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M17 32V13" stroke="${C.forest}" stroke-width="2" stroke-linecap="round"/><path d="M17 16C8 16 4 10 4 3c8 0 13 5 13 13Z" fill="${C.sage}"/><path d="M17 23c8 0 12-5 12-12c-7 0-12 5-12 12Z" fill="${C.clay}"/></svg>`;

const svg = (w, h, label, inner) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${inner}</svg>`;
const rainbow = (cx, y, r) => [C.clay, C.gold, C.mist, C.cream].map((c, i) => `<path d="M${cx - r + i * 26} ${y}a${r - i * 26} ${r - i * 26} 0 0 1 ${2 * (r - i * 26)} 0" fill="none" stroke="${c}" stroke-width="22"/>`).join('');
const art = {
  hero: svg(440, 540, 'Illustration of a wooden rainbow toy and blocks in front of green hills', `<rect width="440" height="540" fill="#f1e3c0"/><circle cx="318" cy="170" r="54" fill="${C.gold}"/>
<path d="M0 372Q120 300 240 362T440 336V540H0Z" fill="${C.hill}"/><path d="M0 430Q150 372 290 428T440 416V540H0Z" fill="${C.sage}"/>
<rect y="462" width="440" height="78" fill="${C.wood}"/>${rainbow(214, 473, 112)}
<rect x="352" y="424" width="40" height="40" rx="4" fill="${C.mist}"/><path d="M350 424l22-30l22 30Z" fill="${C.clay}"/><circle cx="66" cy="446" r="18" fill="${C.gold}"/>
<path d="M92 300q-6-60 14-110" fill="none" stroke="${C.forest}" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="80" cy="262" rx="20" ry="9" fill="${C.forest}" transform="rotate(30 80 262)"/><ellipse cx="112" cy="244" rx="20" ry="9" fill="${C.forest}" transform="rotate(-36 112 244)"/><ellipse cx="84" cy="222" rx="18" ry="8" fill="${C.forest}" transform="rotate(34 84 222)"/><ellipse cx="116" cy="204" rx="16" ry="7" fill="${C.forest}" transform="rotate(-40 116 204)"/>`),
  play: svg(300, 340, 'Wooden rainbow toy and stacking blocks', `<rect width="300" height="340" fill="#f1ddd0"/><rect y="262" width="300" height="78" fill="${C.wood}"/>${rainbow(118, 273, 92)}
<rect x="224" y="226" width="38" height="38" rx="4" fill="${C.sage}"/><rect x="230" y="188" width="38" height="38" rx="4" fill="${C.gold}"/><circle cx="246" cy="168" r="20" fill="${C.clay}"/>`),
  baby: svg(300, 340, 'A hanging mobile with a moon, a star and a cloud', `<rect width="300" height="340" fill="#d6e3e4"/>
<path d="M150 0v96M70 96h160M86 96v70M150 96v110M214 96v56" fill="none" stroke="${C.forest}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M98 172a30 30 0 1 0 14 54a24 24 0 0 1-14-54Z" fill="${C.gold}"/>
<path d="M150 206l9 19l21 3l-15 15l4 21l-19-10l-19 10l4-21l-15-15l21-3Z" fill="${C.clay}"/>
<path d="M192 190a16 16 0 0 1 30-8a14 14 0 0 1 18 14a13 13 0 0 1-4 25h-42a16 16 0 0 1-2-31Z" fill="${C.cream}"/>`),
  makers: svg(300, 340, 'A paintbrush and pots of paint', `<rect width="300" height="340" fill="#f2d58a"/>
<g transform="rotate(32 150 150)"><rect x="140" y="40" width="20" height="150" rx="10" fill="${C.cream}"/><rect x="136" y="180" width="28" height="24" fill="${C.forest}"/><path d="M136 204h28q4 40-14 62q-18-22-14-62Z" fill="${C.clay}"/></g>
<circle cx="78" cy="262" r="34" fill="${C.sage}"/><circle cx="152" cy="282" r="26" fill="${C.clay}"/><circle cx="222" cy="264" r="32" fill="${C.mist}"/><circle cx="78" cy="262" r="18" fill="${C.hill}"/><circle cx="222" cy="264" r="16" fill="${C.cream}"/>`),
  forest: svg(300, 340, 'Trees under a low sun', `<rect width="300" height="340" fill="#dfe8da"/><circle cx="216" cy="110" r="38" fill="${C.gold}"/>
<path d="M0 270Q90 226 170 262T300 250V340H0Z" fill="${C.hill}"/>
<path d="M88 286V236M176 290V214M246 284V244" stroke="${C.forest}" stroke-width="6" stroke-linecap="round"/>
<path d="M88 132q44 60 36 112H52q-8-52 36-112Z" fill="${C.sage}"/><path d="M176 92q50 70 40 132h-80q-10-62 40-132Z" fill="${C.forest}"/><path d="M246 164q34 44 28 84h-56q-6-40 28-84Z" fill="${C.sage}"/>`),
  party: svg(300, 340, 'Bunting and a birthday cake', `<rect width="300" height="340" fill="#f1ddd0"/>
<path d="M0 60Q150 130 300 60" fill="none" stroke="${C.forest}" stroke-width="2.5"/>
<path d="M36 76l30 14l-24 24Z" fill="${C.clay}"/><path d="M96 98l30 8l-18 28Z" fill="${C.gold}"/><path d="M158 106l30-4l-10 32Z" fill="${C.sage}"/><path d="M218 96l28-12l-2 34Z" fill="${C.mist}"/>
<rect x="72" y="244" width="156" height="56" rx="8" fill="${C.cream}"/><rect x="98" y="198" width="104" height="46" rx="8" fill="${C.gold}"/>
<path d="M72 262q20 16 39 0t39 0t39 0t39 0" fill="none" stroke="${C.clay}" stroke-width="5"/>
<rect x="146" y="162" width="8" height="36" rx="3" fill="${C.sage}"/><path d="M150 138q10 12 0 22q-10-10 0-22Z" fill="${C.clay}"/>`),
};

const programs = [
  { key: 'play', name: 'Open Play', age: 'Birth to 6 years', short: 'Ninety unhurried minutes in the studio, with a new invitation to play set out each week.', long: 'Ninety unhurried minutes in the studio. We set out a new invitation to play each week and then step back, so children can follow whatever catches their eye.', facts: ['90 minutes', 'Up to 12 children', 'Book ahead or drop in'] },
  { key: 'baby', name: 'Baby & Me', age: 'Birth to 12 months', short: 'A gentle hour of songs, textures and tummy time, and other parents who are in it too.', long: 'A gentle hour of songs, textures and tummy time, led by an early-years teacher. Half of it is for the babies and half is for meeting other parents who are in it too.', facts: ['60 minutes', 'Up to 8 babies', 'Tea included'] },
  { key: 'makers', name: 'Little Makers', age: '2 to 5 years', short: 'Clay, paint, glue and getting gloriously messy somewhere that is not your kitchen.', long: 'Clay, paint, glue and getting gloriously messy somewhere that is not your kitchen. Each term follows one material, so skills build from week to week.', facts: ['45 minutes', 'Up to 10 children', 'Aprons provided'] },
  { key: 'forest', name: 'Forest Fridays', age: '3 to 6 years', short: 'A morning outdoors in the orchard next door: mud kitchen, bug hunts and a snack by the fire pit.', long: 'A morning outdoors in the orchard next door, in every kind of weather. Mud kitchen, bug hunts, den building and a warm snack by the fire pit.', facts: ['2 hours', 'Up to 10 children', 'Drop-off welcome from age 4'] },
  { key: 'party', name: 'Celebrations', age: 'Any age', short: 'The whole studio to yourselves for two hours, styled simply and set up before you arrive.', long: 'The whole studio to yourselves for two hours on a Saturday afternoon or any Sunday. We style it simply, set it up before you arrive and tidy it after.', facts: ['2 hours', 'Up to 12 children', 'From $350'] },
];

const timetable = {
  Mon: [['9:00am', 'Open Play', 'All ages'], ['11:00am', 'Baby & Me', '0 to 12 months'], ['3:00pm', 'Open Play', 'All ages']],
  Tue: [['9:00am', 'Little Makers', '2 to 5 years'], ['10:30am', 'Open Play', 'All ages'], ['3:00pm', 'Open Play', 'All ages']],
  Wed: [['9:00am', 'Open Play', 'All ages'], ['11:00am', 'Baby & Me', '0 to 12 months'], ['3:30pm', 'Little Makers', '2 to 5 years']],
  Thu: [['9:00am', 'Open Play', 'All ages'], ['10:45am', 'Little Makers', '2 to 5 years'], ['3:00pm', 'Open Play', 'All ages']],
  Fri: [['9:00am', 'Forest Fridays', '3 to 6 years'], ['9:30am', 'Open Play', 'All ages'], ['2:00pm', 'Open Play', 'All ages']],
  Sat: [['9:00am', 'Open Play', 'All ages'], ['10:45am', 'Open Play', 'All ages'], ['1:00pm', 'Celebrations', 'Private bookings']],
};

const events = [
  ['family', 'Sat', '21', 'Nov', 'Lantern Walk', 'Make a paper lantern in the studio, then carry it through the orchard at dusk.', '4:30pm · Free for members, $10 per family'],
  ['workshop', 'Wed', '25', 'Nov', 'Clay Morning', 'Pinch pots and tiny creatures with ceramicist Ana Ruiz. Pieces are fired and ready a week later.', '9:30am · Ages 3 to 6 · $24'],
  ['grownups', 'Thu', '3', 'Dec', 'New Parent Circle', 'An easy evening for parents of babies under one. Bring your questions, or just bring yourself.', '7:00pm · Free · Babies in arms welcome'],
  ['workshop', 'Sat', '5', 'Dec', 'Wreath Making', 'Foraged greenery, dried orange and ribbon. One wreath per family to take home.', '1:30pm · All ages · $30 per family'],
  ['family', 'Fri', '11', 'Dec', 'Winter Story Evening', 'Pyjamas on, lights low, three stories and a cup of warm milk before bed.', '5:30pm · Ages 2 to 6 · $8'],
  ['grownups', 'Thu', '17', 'Dec', 'First Aid for Little Ones', 'A two-hour practical session on choking, bumps and fevers with a paediatric nurse.', '6:30pm · Adults only · $40'],
];
const eventRow = ([cat, day, num, month, name, text, info]) => `<li data-cat="${cat}"><p class="date"><small>${day}</small>${num}<small style="margin:4px 0 0">${month}</small></p><div><h3>${name}</h3><p>${text}</p><p class="info">${info}</p></div><a class="btn btn-line" href="${base}contact/">Save a place</a></li>`;

const cta = (title, text, label = 'Book a first visit') => `<section class="sec bg-forest cta"><div class="wrap"><div><h2>${title}</h2><p>${text}</p></div><a class="btn" href="${base}contact/">${label}</a></div></section>`;

const pages = [
  {
    path: '',
    title: 'Little Fern Playhouse | A calm play studio for ages 0 to 6',
    desc: 'A sunlit, screen-free play studio for children from birth to six, with small groups, natural materials and room to explore.',
    body: `<section class="hero"><div class="wrap">
<div><p class="eyebrow">Play studio · Birth to six</p>
<h1>Slow play for <em>small people.</em></h1>
<p class="lead">A sunlit, shoes-off studio where children from birth to six explore at their own pace, in groups small enough that everyone gets noticed.</p>
<div class="btns"><a class="btn" href="${base}contact/">Book a first visit</a><a class="btn btn-line" href="${base}programs/">See our programs</a></div>
<p class="meta"><span class="pill" data-hours="${hours}">Open Monday to Saturday</span><span>18 Orchard Lane, Alder Bay</span></p></div>
<div class="arch">${art.hero}</div></div></section>
<section class="values" aria-label="What makes us different"><div class="wrap">
<div><h2>Twelve children, at most</h2><p>Every session is capped, so it never tips over into chaos.</p></div>
<div><h2>Wood, wool and clay</h2><p>Simple, natural materials that leave room for imagination.</p></div>
<div><h2>Screens stay in bags</h2><p>For the children and, gently, for the grown-ups too.</p></div></div></section>
<section class="sec"><div class="wrap"><div class="sec-head"><p class="eyebrow">Programs</p><h2>A week with room to <em>wander</em></h2><p>Come for open play, stay for a class, or let us host the birthday.</p></div>
<div class="grid g3">${programs.slice(0, 3).map((p) => `<article class="program"><div class="arch">${art[p.key]}</div><span class="tag" style="align-self:flex-start">${p.age}</span><h3>${p.name}</h3><p>${p.short}</p></article>`).join('')}</div>
<div class="btns"><a class="btn btn-line" href="${base}programs/">All programs and the timetable</a></div></div></section>
<section class="sec bg-forest"><div class="wrap"><blockquote class="pull"><p>“It is the one place my daughter slows down. She spent forty minutes pouring water between two jugs and came out glowing.”</p><footer>Hannah, parent of a three-year-old</footer></blockquote></div></section>
<section class="sec"><div class="wrap"><div class="sec-head"><p class="eyebrow">Coming up</p><h2>At the playhouse this month</h2></div>
<ul class="events">${events.slice(0, 3).map(eventRow).join('')}</ul>
<div class="btns"><a class="btn btn-line" href="${base}events/">See every event</a></div></div></section>
<section class="sec bg-sage"><div class="wrap grid g2" style="align-items:center"><div><p class="eyebrow">Membership</p><h2>Make it part of your week</h2><p class="lead">Members book a week ahead of everyone else and pay from $14.75 a session. Pause or cancel whenever you need to.</p><div class="btns"><a class="btn" href="${base}pricing/">See pricing</a></div></div>
<ul class="ticks" style="font-size:1.1rem"><li>Four, eight or unlimited sessions a month</li><li>Early booking for classes and events</li><li>Guest passes for grandparents and friends</li><li>No joining fee and no contract</li></ul></div></section>`,
  },
  {
    path: 'programs/',
    title: 'Programs and timetable | Little Fern Playhouse',
    desc: 'Open Play, Baby & Me, Little Makers, Forest Fridays and private celebrations, with the weekly timetable for each day.',
    hero: ['Programs', 'Five ways to spend a morning', 'Every session is small, led by an early-years teacher and built around what children choose to do.'],
    body: `<section class="sec"><div class="wrap">
${programs.map((p) => `<article class="feature"><div class="arch">${art[p.key]}</div><div><span class="tag">${p.age}</span><h2>${p.name}</h2><p>${p.long}</p><p class="facts">${p.facts.map((f) => `<span class="tag" style="background:var(--blush)">${f}</span>`).join('')}</p></div></article>`).join('')}
</div></section>
<section class="sec bg-paper" data-scope><div class="wrap"><div class="sec-head"><p class="eyebrow">Timetable</p><h2>This week at the playhouse</h2><p>Pick a day. Sessions open for booking seven days ahead, or fourteen for members.</p></div>
<div class="tabs" data-tabs role="group" aria-label="Day of the week">${Object.keys(timetable).map((d, i) => `<button type="button" data-tab="${d}" aria-pressed="${i === 0}">${d}</button>`).join('')}</div>
${Object.entries(timetable).map(([d, rows], i) => `<ul class="rows" data-panel="${d}"${i ? ' hidden' : ''}>${rows.map(([t, n, a]) => `<li><span class="time">${t}</span><strong>${n}</strong><span>${a}</span></li>`).join('')}</ul>`).join('')}
</div></section>
${cta('Not sure where to start?', 'Your first Open Play session is on us. Come and see how it feels.')}`,
  },
  {
    path: 'pricing/',
    title: 'Pricing and membership | Little Fern Playhouse',
    desc: 'Drop-in sessions from $18, five-session bundles and monthly memberships with early booking. No joining fee, no contract.',
    hero: ['Pricing', 'Come once, or come every week', 'One child and one grown-up are included in every price. Babies under six months come free with a sibling.'],
    body: `<section class="sec" data-scope><div class="wrap">
<div class="sec-head"><h2>Choose what fits your week</h2></div>
<div class="tabs" data-tabs role="group" aria-label="Pricing type"><button type="button" data-tab="membership" aria-pressed="true">Membership</button><button type="button" data-tab="dropin" aria-pressed="false">Drop-in</button></div>
<div class="grid g3" data-panel="membership">
<article class="plan"><span class="tag" style="align-self:flex-start">Once a week</span><h3>Seedling</h3><p class="price">$59 <small>a month</small></p><p>For families finding their rhythm.</p><ul class="ticks"><li>4 Open Play sessions a month</li><li>Book 14 days ahead</li><li>10% off classes and events</li></ul><a class="btn btn-line" href="${base}contact/">Choose Seedling</a></article>
<article class="plan pick"><span class="tag" style="align-self:flex-start;background:var(--butter)">Most families pick this</span><h3>Sprout</h3><p class="price">$95 <small>a month</small></p><p>Twice a week, with a class thrown in.</p><ul class="ticks"><li>8 Open Play sessions a month</li><li>1 class of your choice each month</li><li>Book 14 days ahead</li><li>2 guest passes a month</li></ul><a class="btn" href="${base}contact/">Choose Sprout</a></article>
<article class="plan"><span class="tag" style="align-self:flex-start">Come any time</span><h3>Fern</h3><p class="price">$139 <small>a month</small></p><p>The studio as your second living room.</p><ul class="ticks"><li>Unlimited Open Play</li><li>2 classes of your choice each month</li><li>4 guest passes a month</li><li>20% off celebrations</li></ul><a class="btn btn-line" href="${base}contact/">Choose Fern</a></article></div>
<div class="grid g3" data-panel="dropin" hidden>
<article class="plan"><span class="tag" style="align-self:flex-start">Single visit</span><h3>Open Play session</h3><p class="price">$18</p><p>Ninety minutes in the studio for one child and one grown-up.</p><ul class="ticks"><li>Siblings are $9 each</li><li>Book up to 7 days ahead</li></ul><a class="btn btn-line" href="${base}contact/">Book a session</a></article>
<article class="plan"><span class="tag" style="align-self:flex-start">Save $10</span><h3>Bundle of five</h3><p class="price">$80</p><p>Five Open Play sessions to use within three months.</p><ul class="ticks"><li>Share between siblings</li><li>Book up to 7 days ahead</li></ul><a class="btn btn-line" href="${base}contact/">Buy a bundle</a></article>
<article class="plan"><span class="tag" style="align-self:flex-start">Classes</span><h3>Class, per session</h3><p class="price">$22</p><p>Baby & Me, Little Makers or Forest Fridays, booked one at a time.</p><ul class="ticks"><li>Materials included</li><li>Term of 8 weeks for $150</li></ul><a class="btn btn-line" href="${base}programs/">See the timetable</a></article></div>
</div></section>
<section class="sec bg-blush"><div class="wrap grid g2" style="align-items:center"><div><p class="eyebrow">Celebrations</p><h2>Birthdays, from $350</h2><p class="lead">Two hours with the whole studio to yourselves, for up to twelve children. Styled, set up and tidied by us.</p></div>
<ul class="ticks" style="font-size:1.1rem"><li>A play host for the whole party</li><li>Table styling with seasonal flowers</li><li>Fruit, juice and tea for the grown-ups</li><li>Add a craft activity for $60</li></ul></div></section>
<section class="sec"><div class="wrap"><div class="sec-head center"><h2>Before you ask</h2></div>
<div class="faq">
<details><summary>Can I try it before joining?</summary><p>Yes. Your first Open Play session is free. Book a first visit from the Contact page and we will find a quiet time to show you round.</p></details>
<details><summary>What if we miss a session?</summary><p>Cancel up to two hours before and the session goes back on your account. Unused membership sessions roll over for one month.</p></details>
<details><summary>Can I pause my membership?</summary><p>Any time, for as long as you need. There is no joining fee and no contract, so you can also stop altogether with a week's notice.</p></details>
<details><summary>Do grandparents or nannies need their own pass?</summary><p>No. The price covers one child and whichever grown-up brings them that day. A second adult is always welcome at no charge.</p></details>
</div></div></section>
${cta('Start with a free session', 'Tell us your child’s age and a day that suits, and we will do the rest.')}`,
  },
  {
    path: 'events/',
    title: 'Events and workshops | Little Fern Playhouse',
    desc: 'Seasonal workshops, family evenings and sessions for parents at Little Fern Playhouse. Filter by type and save a place.',
    hero: ['Events', 'Small gatherings, worth leaving the house for', 'Workshops, family evenings and a few things just for the grown-ups. Places are limited, so each one is booked ahead.'],
    body: `<section class="sec" data-scope><div class="wrap">
<div class="sec-head"><h2>What's coming up</h2></div>
<div class="tabs" data-tabs role="group" aria-label="Filter events"><button type="button" data-tab="all" aria-pressed="true">All events</button><button type="button" data-tab="workshop" aria-pressed="false">Workshops</button><button type="button" data-tab="family" aria-pressed="false">Family</button><button type="button" data-tab="grownups" aria-pressed="false">For grown-ups</button></div>
<ul class="events">${events.map(eventRow).join('')}</ul>
<p class="count" aria-live="polite">Showing <span data-count>${events.length}</span> events through December.</p></div></section>
<section class="sec bg-sage"><div class="wrap grid g2" style="align-items:center"><div><p class="eyebrow">Host your own</p><h2>Borrow the studio</h2><p class="lead">Baby showers, playgroup meetups, a class of your own. The studio is free on Sundays and most evenings.</p><div class="btns"><a class="btn" href="${base}contact/">Ask about hiring</a></div></div>
<ul class="ticks" style="font-size:1.1rem"><li>Room for 30 adults, or 12 children with their grown-ups</li><li>Kitchenette, sound system and a projector</li><li>Step-free, with stroller parking inside</li></ul></div></section>`,
  },
  {
    path: 'contact/',
    title: 'Contact and first visits | Little Fern Playhouse',
    desc: 'Book a free first visit to Little Fern Playhouse at 18 Orchard Lane, Alder Bay. Opening hours, directions and contact details.',
    hero: ['Contact', 'Come and see it for yourself', 'Your first Open Play session is free. Tell us a little about your child and we will suggest a good time.'],
    body: `<section class="sec"><div class="wrap grid g2">
<div><form class="form" data-demo-form>
<div class="pair"><label>Your name<input type="text" name="name" autocomplete="name" required></label><label>Email<input type="email" name="email" autocomplete="email" required></label></div>
<div class="pair"><label>Child's age<select name="age"><option>Under 1</option><option>1 to 2</option><option>3 to 4</option><option>5 to 6</option></select></label><label>A day that suits<select name="day"><option>Any weekday</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option></select></label></div>
<label>Anything we should know? <textarea name="message" rows="5" placeholder="Allergies, nap times, what they love"></textarea></label>
<button class="btn" type="submit">Request a first visit</button></form>
<div class="thanks" data-thanks hidden tabindex="-1"><h2>Thank you</h2><p>On a live site this would reach the studio and you would hear back with two or three times to choose from. This is a concept site, so nothing was sent.</p></div></div>
<div class="info-card"><p><span class="pill" data-hours="${hours}">Open Monday to Saturday</span></p>
<h2>Opening hours</h2><table class="hours"><tbody><tr><td>Monday to Friday</td><td>8:30am to 5pm</td></tr><tr><td>Saturday</td><td>9am to 3pm</td></tr><tr><td>Sunday</td><td>Private hire only</td></tr></tbody></table>
<h2>Find us</h2><p>18 Orchard Lane, Alder Bay<br><a href="tel:+15550174410">(555) 017-4410</a><br><a href="mailto:hello@littlefern.example">hello@littlefern.example</a></p>
<h2>Getting here</h2><p>We are the green door beside the orchard gate. There are ten parking spaces behind the studio, and the number 7 bus stops at the end of the lane.</p></div>
</div></section>`,
  },
];

function layout(p) {
  const here = base + p.path;
  return `<!doctype html>
<html lang="en">
<head>
${head({ title: p.title, desc: p.desc, path: here, theme: '#faf5ea', icon: logo, css: `${base}styles.css`, fonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&display=swap' })}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap bar">
<a class="logo" href="${base}">${logo}Little Fern Playhouse</a>
<button class="menu" type="button" data-menu aria-expanded="false" aria-controls="nav">Menu</button>
<nav id="nav" aria-label="Main">${nav.map(([label, path]) => `<a href="${base}${path}"${path === p.path ? ' aria-current="page"' : ''}>${label}</a>`).join('')}<a class="btn" href="${base}contact/">Book a visit</a></nav>
</div></header>
<main id="main">
${p.hero ? `<section class="page-hero"><div class="wrap"><p class="eyebrow">${p.hero[0]}</p><h1>${p.hero[1]}</h1><p class="lead">${p.hero[2]}</p></div></section>` : ''}
${p.body}
</main>
<footer class="foot"><div class="wrap">
<div class="grid"><div><a class="logo" href="${base}">${logo}Little Fern Playhouse</a><p>A calm, screen-free play studio for children from birth to six.</p></div>
<div><p class="title">Visit</p><ul><li>18 Orchard Lane, Alder Bay</li><li>Mon to Fri, 8:30am to 5pm</li><li>Saturday, 9am to 3pm</li></ul></div>
<div><p class="title">Explore</p><ul>${nav.map(([label, path]) => `<li><a href="${base}${path}">${label}</a></li>`).join('')}</ul></div></div>
<p class="note">${conceptNote('Little Fern Playhouse')}</p>
</div></footer>
</body>
</html>
`;
}

export default { slug, pages, layout };
