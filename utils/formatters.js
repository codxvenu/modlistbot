/**
 * HTML escaping utility
 */
export function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Clean ModList movie titles by stripping prefixes, technical tags, and brackets
 */
export function cleanMovieTitle(title) {
    if (!title) return "";
    return title
        .replace(/^Download\s+/i, "")
        .split(/WEB-DL|BluRay|HDRip|480p|720p|1080p|\|\|/i)[0]
        .replace(/\{.*?\}/g, "")
        .trim() || title;
}
