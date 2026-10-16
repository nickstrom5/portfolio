/**
 * Applies the saved theme before first paint, so a dark-mode visitor never
 * sees a flash of the light theme. Inlined early in the <head> of Base.astro
 * and resume.astro, before the CSP <meta>, on purpose (see astro.config.mjs).
 * astro.config.mjs hashes this exact text for the CSP, so the hash can never
 * fall out of step with the script.
 */
export const themeInit =
  "try{const s=localStorage.getItem('theme');if(s==='light'||s==='dark')document.documentElement.dataset.theme=s}catch{}";
