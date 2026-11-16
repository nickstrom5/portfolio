// Helpers shared by the concept sites under public/demos/.
export const origin = 'https://work-with-nick.com';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** <head> for a concept-site page. Concept sites are noindex and use their own fonts and CSS. */
export function head({ title, desc, path, fonts, css, theme, icon }) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${origin}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta name="theme-color" content="${theme}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<link rel="stylesheet" href="${css}">
<script src="/demos/site.js" defer></script>`;
}

/** The line every concept site carries in its footer. */
export const conceptNote = (name) =>
  `Concept site designed and built by <a href="${origin}/">Nick Soderstrom</a>. ${name} is a fictional business, so the names, prices and reviews here are placeholders.`;
