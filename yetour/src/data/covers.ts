/**
 * Album cover URLs on Spotify's image CDN, keyed by Spotify album id.
 *
 * Populated by `npm run covers`, which asks Spotify's public oEmbed endpoint
 * for each album's artwork. Committing the result means the build does not
 * depend on Spotify being reachable; when an id is missing here the build
 * looks it up live and simply carries on if that fails.
 */
export const coverCache: Record<string, string> = {};
