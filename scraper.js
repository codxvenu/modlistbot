/**
 * ModList / MoviesMod Scraper
 * 100% Zero-Playwright Pure Fetch Architecture
 */

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Lightweight in-memory Cookie Jar for maintaining session across redirects and forms
 */
export class CookieJar {
    constructor() {
        this.cookies = new Map();
    }

    addFromHeaders(headers) {
        if (!headers) return;
        const raw = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie")].filter(Boolean);
        for (const str of raw) {
            if (!str) continue;
            const parts = str.split(";");
            const first = parts[0].trim();
            const eqIdx = first.indexOf("=");
            if (eqIdx !== -1) {
                const k = first.slice(0, eqIdx).trim();
                const v = first.slice(eqIdx + 1).trim();
                this.cookies.set(k, v);
            }
        }
    }

    set(k, v) {
        this.cookies.set(k, v);
    }

    getCookieHeader() {
        return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    }
}

/**
 * Resolve base URL freshly from modlist.in redirect (no browser)
 * @returns {Promise<string>}
 */
export async function getBaseUrl() {
    try {
        const res = await fetch("https://modlist.in/?type=hollywood", {
            headers: { "User-Agent": USER_AGENT },
            redirect: "follow"
        });
        const html = await res.text();
        const metaMatch = html.match(/content=["']\d+;\s*url=([^"'>\s]+)["']/i);
        if (metaMatch) {
            let u = metaMatch[1];
            if (!u.endsWith("/")) u += "/";
            return u;
        }
        if (res.url && !res.url.includes("modlist.in")) {
            const origin = new URL(res.url).origin;
            return origin.endsWith("/") ? origin : origin + "/";
        }
    } catch (e) {
        console.warn("[Scraper] BaseUrl fetch failed, using fallback:", e.message);
    }
    return "https://moviesmod.ai.in/";
}

/**
 * Search movies / series from modlist using pure fetch
 * @param {string} query
 * @returns {Promise<Array<{ title: string, link: string }>>}
 */
export async function searchMovies(query) {
    const baseUrl = await getBaseUrl();
    const searchUrl = `${baseUrl}search/${encodeURIComponent(query.trim()).replace(/%20/g, "+")}`;
    const res = await fetch(searchUrl, {
        headers: { "User-Agent": USER_AGENT }
    });
    const html = await res.text();

    const articleMatches = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)];
    const results = [];
    const seen = new Set();

    for (const match of articleMatches) {
        const articleHtml = match[1];
        const aMatch = articleHtml.match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*\btitle=["']([^"']+)["']/i) ||
                       articleHtml.match(/<a\b[^>]*\btitle=["']([^"']+)["'][^>]*\bhref=["']([^"']+)["']/i);
        if (aMatch) {
            const link = aMatch[1].startsWith("http") ? aMatch[1] : aMatch[2];
            const title = aMatch[1].startsWith("http") ? aMatch[2] : aMatch[1];
            if (link && title && !seen.has(link)) {
                seen.add(link);
                results.push({ title: title.trim(), link: link.trim() });
            }
        }
    }
    return results;
}

/**
 * Format quality label to show resolution, bit depth, and size
 * e.g., '720p 10bit [530MB]'
 * @param {string} rawText
 * @returns {string}
 */
export function formatQualityLabel(rawText) {
    if (!rawText) return "Standard Quality";
    
    const sizeMatch = rawText.match(/\[([\d\.]+\s*(?:MB|GB|mb|gb))\]/i) || 
                      rawText.match(/\(([\d\.]+\s*(?:MB|GB|mb|gb))\)/i) ||
                      rawText.match(/(\d+(?:\.\d+)?\s*(?:MB|GB))/i);
    const sizeStr = sizeMatch ? `[${sizeMatch[1].toUpperCase().replace(/\s+/, "")}]` : "";

    const resMatch = rawText.match(/(480p|720p|1080p|2160p|4K)/i);
    const bitMatch = rawText.match(/(10bit|hevc|x264|x265)/i);
    
    let qualityStr = "";
    if (resMatch) {
        qualityStr = resMatch[1].toUpperCase();
        if (bitMatch) qualityStr += ` ${bitMatch[1]}`;
    }

    if (qualityStr && sizeStr) return `${qualityStr} ${sizeStr}`;
    if (qualityStr) return qualityStr;
    if (sizeStr) return `Download ${sizeStr}`;

    return rawText.replace(/^Download\s+/i, "").replace(/\{.*?\}/g, "").trim().slice(0, 40);
}

/**
 * Get available qualities for a movie / series page
 * @param {string} movieUrl
 * @returns {Promise<Array<{ label: string, raw: string, link: string }>>}
 */
export async function getMovieQualities(movieUrl) {
    const res = await fetch(movieUrl, { headers: { "User-Agent": USER_AGENT } });
    const html = await res.text();

    const sections = [...html.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4|<\/article|<\/div\s*<\/div)/gi)];
    const qualities = [];

    for (const s of sections) {
        const title = s[1].replace(/<[^>]+>/g, "").trim();
        if (/related|comment|reply|share|tags/i.test(title)) continue;
        
        const body = s[2];
        const btnMatch = body.match(/<a\b[^>]*\bhref=["']([^"']*(?:archives|\/archives\/)[^"']*)["'][^>]*>/i) ||
                         body.match(/<a\b[^>]*\bclass=["'][^"']*maxbutton[^"']*["'][^>]*\bhref=["']([^"']+)["']/i);
        
        if (btnMatch) {
            qualities.push({
                label: formatQualityLabel(title),
                raw: title,
                link: btnMatch[1]
            });
        }
    }

    // Fallback if page structure uses standard unnested headings
    if (qualities.length === 0) {
        const h4Matches = [...html.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi)].map(m => m[1].replace(/<[^>]+>/g, "").trim());
        const buttonMatches = [...html.matchAll(/<a\b[^>]*\bclass=["'][^"']*maxbutton[^"']*["'][^>]*\bhref=["']([^"']+)["']/gi)].map(m => m[1]);
        const minCount = Math.min(h4Matches.length, buttonMatches.length);
        for (let i = 0; i < minCount; i++) {
            if (/related|comment|reply/i.test(h4Matches[i])) continue;
            qualities.push({
                label: formatQualityLabel(h4Matches[i]),
                raw: h4Matches[i],
                link: buttonMatches[i]
            });
        }
    }

    return qualities;
}

/**
 * Resolves an intermediate CDN URL (e.g. instant.video-gen.xyz/...) into the direct
 * file download link (e.g. video-downloads.googleusercontent.com/...)
 * so clicking the button in Telegram starts the direct download immediately.
 * @param {string} cdnUrl
 * @returns {Promise<string>}
 */
export async function resolveDirectCdnLink(cdnUrl) {
    if (!cdnUrl) return null;
    try {
        const res = await fetch(cdnUrl, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://driveseed.org/"
            },
            redirect: "follow"
        });

        const finalUrl = res.url;
        const urlObj = new URL(finalUrl);
        const directUrl = urlObj.searchParams.get("url");
        if (directUrl && directUrl.startsWith("http")) {
            return directUrl;
        }

        const html = await res.text();
        const btnMatch = html.match(/id=["']downloadBtn["'][^>]*href=["']([^"']+)["']/i);
        if (btnMatch && btnMatch[1] && btnMatch[1] !== "#" && btnMatch[1].startsWith("http")) {
            return btnMatch[1];
        }

        return finalUrl;
    } catch (e) {
        console.warn("[Scraper] Direct CDN link resolution failed, using fallback:", e.message);
        return cdnUrl;
    }
}

/**
 * Extract final download links:
 * - Telegram Start Token + Bot Username
 * - Direct CDN Download Link (resolved directly to file, no middle page)
 * @param {string} qualityLink
 * @returns {Promise<{ token: string|null, botUsername: string|null, cdnLink: string|null, rawCdnLink: string|null, tgLink: string|null }>}
 */
export async function extractLinks(qualityLink) {
    const jar = new CookieJar();

    // 1. Fetch archives or series landing page
    const resA = await fetch(qualityLink, { headers: { "User-Agent": USER_AGENT } });
    jar.addFromHeaders(resA.headers);
    const htmlA = await resA.text();

    const sidMatch = htmlA.match(/href=["'](https?:\/\/[^"']+\/\?sid=([^"']+))["']/i);
    if (!sidMatch) throw new Error("Shortener link not found on quality page");
    const nextUrl = sidMatch[1];

    // 2. Fetch shortener landing page (?sid=...)
    const resB = await fetch(nextUrl, {
        headers: { "User-Agent": USER_AGENT, "Referer": qualityLink, "Cookie": jar.getCookieHeader() }
    });
    jar.addFromHeaders(resB.headers);
    const htmlB = await resB.text();

    // 3. Form 1 submission
    const formMatch1 = htmlB.match(/<form\b[^>]*action=["']([^"']*)["'][^>]*>([\s\S]*?)<\/form>/i);
    if (!formMatch1) throw new Error("Form 1 not found on shortener landing page");
    const postAction1 = new URL(formMatch1[1] || nextUrl, nextUrl).href;
    const params1 = new URLSearchParams();
    for (const inp of [...formMatch1[2].matchAll(/<input\b[^>]*\bname=["']([^"']+)["'][^>]*\bvalue=["']([^"']*)["']/gi)]) {
        params1.append(inp[1], inp[2]);
    }

    const resC = await fetch(postAction1, {
        method: "POST",
        headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": nextUrl,
            "Cookie": jar.getCookieHeader()
        },
        body: params1.toString()
    });
    jar.addFromHeaders(resC.headers);
    const htmlC = await resC.text();

    // 4. Form 2 submission
    const formMatch2 = htmlC.match(/<form\b[^>]*action=["']([^"']*)["'][^>]*>([\s\S]*?)<\/form>/i);
    if (!formMatch2) throw new Error("Form 2 not found on verification page");
    const postAction2 = new URL(formMatch2[1] || postAction1, postAction1).href;
    const params2 = new URLSearchParams();
    for (const inp of [...formMatch2[2].matchAll(/<input\b[^>]*\bname=["']([^"']+)["'][^>]*\bvalue=["']([^"']*)["']/gi)]) {
        params2.append(inp[1], inp[2]);
    }

    const resD = await fetch(postAction2, {
        method: "POST",
        headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": postAction1,
            "Cookie": jar.getCookieHeader()
        },
        body: params2.toString()
    });
    jar.addFromHeaders(resD.headers);
    const htmlD = await resD.text();

    // 5. Dynamic session cookie injection
    const cookieMatch = htmlD.match(/(?:sc|s_\w+)\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/i);
    if (!cookieMatch) throw new Error("Session cookie function not found");
    const cookieName = cookieMatch[1];
    const cookieValue = cookieMatch[2];
    jar.set(cookieName, cookieValue);

    // 6. Target redirect
    const goMatch = htmlD.match(/\.setAttribute\(["']href["'],\s*["']([^"']+)["']/i);
    let targetGoUrl = goMatch ? goMatch[1].replace(/\\/g, "") : `${new URL(postAction2).origin}/?lp_go=${cookieName}`;
    targetGoUrl = new URL(targetGoUrl, postAction2).href;

    const resE = await fetch(targetGoUrl, {
        headers: {
            "User-Agent": USER_AGENT,
            "Referer": postAction2,
            "Cookie": jar.getCookieHeader()
        }
    });
    jar.addFromHeaders(resE.headers);
    const htmlE = await resE.text();

    // 7. Drive redirect (window.location.replace or meta refresh)
    const replaceMatchE = htmlE.match(/window\.location\.replace\(["']([^"']+)["']\)/i) ||
                          htmlE.match(/content=["']\d+;\s*url=([^"'>\s]+)["']/i);
    if (!replaceMatchE) throw new Error("Drive redirect destination not found");
    const driveRedirectUrl = replaceMatchE[1].replace(/\\/g, "");

    const resF = await fetch(driveRedirectUrl, {
        headers: { "User-Agent": USER_AGENT, "Referer": targetGoUrl }
    });
    const htmlF = await resF.text();

    // 8. File page redirect
    let fileUrl = driveRedirectUrl;
    const replaceMatchF = htmlF.match(/window\.location\.replace\(["']([^"']+)["']\)/i) ||
                          htmlF.match(/content=["']\d+;\s*url=([^"'>\s]+)["']/i);
    if (replaceMatchF) {
        fileUrl = new URL(replaceMatchF[1].replace(/\\/g, ""), driveRedirectUrl).href;
    }

    // 9. Fetch final download page
    const resG = await fetch(fileUrl, {
        headers: { "User-Agent": USER_AGENT, "Referer": driveRedirectUrl }
    });
    const htmlG = await resG.text();

    // 10. Extract download links
    const aTags = [...htmlG.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({
        href: m[1].replace(/&amp;/g, "&"),
        text: m[2].replace(/<[^>]+>/g, "").trim()
    }));

    const tgLinkObj = aTags.find(a => a.text.toLowerCase().includes("telegram") || a.href.includes("t.me") || a.href.includes("seedtg"));
    const cdnLinkObj = aTags.find(a => a.text.toLowerCase().includes("instant") || a.text.toLowerCase().includes("download v2") || a.text.toLowerCase().includes("download"));

    if (!tgLinkObj && !cdnLinkObj) {
        throw new Error("No download links found on final Drive page");
    }

    // Parse Telegram start token & bot username
    let startToken = null;
    let botUsername = null;
    if (tgLinkObj) {
        try {
            const urlObj = new URL(tgLinkObj.href);
            startToken = urlObj.searchParams.get("start");
            if (startToken) startToken = decodeURIComponent(startToken);
            
            const rawBot = urlObj.searchParams.get("bot");
            if (rawBot) {
                botUsername = rawBot.startsWith("@") ? rawBot : `@${rawBot}`;
            }
        } catch {}
    }

    // Resolve direct CDN download URL so user directly downloads the file
    let directCdnLink = null;
    if (cdnLinkObj?.href) {
        console.log(`[Scraper] Resolving direct download link from CDN page: ${cdnLinkObj.href.slice(0, 60)}...`);
        directCdnLink = await resolveDirectCdnLink(cdnLinkObj.href);
    }

    return {
        token: startToken,
        botUsername: botUsername,
        cdnLink: directCdnLink,
        rawCdnLink: cdnLinkObj ? cdnLinkObj.href : null,
        tgLink: tgLinkObj ? tgLinkObj.href : null
    };
}

/**
 * Convenience helper to extract Telegram token only
 * @param {string} qualityLink
 * @returns {Promise<string|null>}
 */
export async function extractTgToken(qualityLink) {
    const res = await extractLinks(qualityLink);
    return res.token;
}
