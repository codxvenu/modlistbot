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
 * @returns {Promise<Array<{ id: number, label: string, fullLabel: string, season: number|null, episodeLink: string|null, zipLink: string|null, link: string, raw: string }>>}
 */
export async function getMovieQualities(movieUrl) {
    const res = await fetch(movieUrl, { headers: { "User-Agent": USER_AGENT } });
    const html = await res.text();

    const sections = [...html.matchAll(/<(h[234])\b[^>]*>([\s\S]*?)<\/\1>([\s\S]*?)(?=<(?:h[234])\b|<\/article|<\/div\s*<\/div)/gi)];
    const qualities = [];

    for (const s of sections) {
        const title = s[2].replace(/<[^>]+>/g, "").trim();
        if (/related|comment|reply|share|tags|storyline|screenshot|trailer|synopsis|info:|download game of thrones/i.test(title)) continue;
        
        const body = s[3];
        const btns = [...body.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({
            href: m[1].replace(/&amp;/g, "&"),
            text: m[2].replace(/<[^>]+>/g, "").trim()
        })).filter(b => b.href.includes("archives") || /episode|batch|zip|download|server|links/i.test(b.text));
        
        if (btns.length === 0) continue;

        // Season detection
        const seasonMatch = title.match(/Season\s*(\d+)/i) || title.match(/\bS(\d+)\b/i);
        const season = seasonMatch ? parseInt(seasonMatch[1], 10) : null;

        // Button detection (episode links vs zip batch file)
        const epBtn = btns.find(b => /episode/i.test(b.text) && !/batch|all/i.test(b.text));
        const zipBtn = btns.find(b => /batch|zip/i.test(b.text));
        const genericBtn = btns.find(b => b.href.includes("archives"));

        const primaryLink = (zipBtn || epBtn || genericBtn || btns[0]).href;

        qualities.push({
            id: qualities.length,
            label: formatQualityLabel(title),
            fullLabel: season ? `S${String(season).padStart(2, "0")} • ${formatQualityLabel(title)}` : formatQualityLabel(title),
            season,
            episodeLink: epBtn ? epBtn.href : null,
            zipLink: zipBtn ? zipBtn.href : null,
            link: primaryLink,
            raw: title
        });
    }

    // Fallback if page structure uses unnested headings
    if (qualities.length === 0) {
        const hMatches = [...html.matchAll(/<(h[34])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => m[2].replace(/<[^>]+>/g, "").trim());
        const buttonMatches = [...html.matchAll(/<a\b[^>]*\bclass=["'][^"']*maxbutton[^"']*["'][^>]*\bhref=["']([^"']+)["']/gi)].map(m => m[1]);
        const minCount = Math.min(hMatches.length, buttonMatches.length);
        for (let i = 0; i < minCount; i++) {
            if (/related|comment|reply|storyline/i.test(hMatches[i])) continue;
            const seasonMatch = hMatches[i].match(/Season\s*(\d+)/i) || hMatches[i].match(/\bS(\d+)\b/i);
            const season = seasonMatch ? parseInt(seasonMatch[1], 10) : null;
            qualities.push({
                id: qualities.length,
                label: formatQualityLabel(hMatches[i]),
                fullLabel: season ? `S${String(season).padStart(2, "0")} • ${formatQualityLabel(hMatches[i])}` : formatQualityLabel(hMatches[i]),
                season,
                episodeLink: null,
                zipLink: null,
                link: buttonMatches[i],
                raw: hMatches[i]
            });
        }
    }

    return qualities;
}

/**
 * Fetch and extract individual episodes for a series quality
 * @param {string} episodeArchiveUrl
 * @returns {Promise<Array<{ episodeNumber: number, label: string, shortLabel: string, url: string }>>}
 */
export async function getSeriesEpisodes(episodeArchiveUrl) {
    const res = await fetch(episodeArchiveUrl, { headers: { "User-Agent": USER_AGENT } });
    const html = await res.text();

    const aTags = [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({
        url: m[1].replace(/&amp;/g, "&"),
        text: m[2].replace(/<[^>]+>/g, "").trim()
    })).filter(a => !/comment|batch/i.test(a.text) && (/episode\s*\d+|ep\s*\d+/i.test(a.text) || a.url.includes("?sid=")));

    return aTags.map((item, idx) => {
        const epMatch = item.text.match(/Episode\s*(\d+)/i) || item.text.match(/Ep\s*(\d+)/i);
        const epNum = epMatch ? parseInt(epMatch[1], 10) : (idx + 1);
        return {
            episodeNumber: epNum,
            label: `Episode ${epNum}`,
            shortLabel: `Ep ${epNum}`,
            url: item.url
        };
    });
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
 * @param {string} qualityLinkOrSid
 * @returns {Promise<{ token: string|null, botUsername: string|null, cdnLink: string|null, rawCdnLink: string|null, tgLink: string|null }>}
 */
export async function extractLinks(qualityLinkOrSid) {
    const jar = new CookieJar();
    let nextUrl = qualityLinkOrSid;
    let referer = "";

    // 1. If it's an archives page, fetch it first to find the ?sid= link
    if (qualityLinkOrSid.includes("/archives/")) {
        const resA = await fetch(qualityLinkOrSid, { headers: { "User-Agent": USER_AGENT } });
        jar.addFromHeaders(resA.headers);
        const htmlA = await resA.text();

        const allSidMatches = [...htmlA.matchAll(/<a\b[^>]*\bhref=["'](https?:\/\/[^"']+\/\?sid=([^"']+))["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({
            url: m[1].replace(/&amp;/g, "&"),
            sid: m[2],
            text: m[3].replace(/<[^>]+>/g, "").trim()
        })).filter(a => !/comment/i.test(a.text));

        if (allSidMatches.length > 0) {
            // Prefer Fast Server or G-Drive server or Episode 1 over dead batch folder
            const chosen = allSidMatches.find(a => /fast\s*server|g-drive|gdrive|server\s*1/i.test(a.text)) ||
                           allSidMatches.find(a => /episode\s*1\b/i.test(a.text)) ||
                           allSidMatches.find(a => !/batch/i.test(a.text)) ||
                           allSidMatches[0];
            nextUrl = chosen.url;
        } else {
            const sidMatch = htmlA.match(/href=["'](https?:\/\/[^"']+\/\?sid=([^"']+))["']/i);
            if (!sidMatch) throw new Error("Shortener link not found on quality page");
            nextUrl = sidMatch[1];
        }
        referer = qualityLinkOrSid;
    }

    // 2. Fetch shortener landing page (?sid=...)
    const resB = await fetch(nextUrl, {
        headers: { "User-Agent": USER_AGENT, "Referer": referer, "Cookie": jar.getCookieHeader() }
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

    const tgLinkObj = aTags.find(a => 
        (a.href.includes("seedtg") && a.href.includes("start=")) ||
        (a.href.includes("?start=") && (a.href.includes("t.me") || a.href.includes("seedtg"))) ||
        (a.text.toLowerCase().includes("telegram") && !a.text.toLowerCase().includes("join") && !a.href.includes("appdrivev5"))
    );
    const cdnLinkObj = aTags.find(a => a.href.startsWith("http") && (a.text.toLowerCase().includes("instant") || a.text.toLowerCase().includes("download v2") || a.text.toLowerCase().includes("download")));

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
