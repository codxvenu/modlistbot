/**
 * User-facing HTML messages and templates
 */
export const MESSAGES = {
    WELCOME: 
`<b>👋 Welcome!</b>

Send <code>/search movie name</code> to get started.
<i>Example:</i> <code>/search Inception</code>`,

    HELP: 
`<b>📖 Quick Guide</b>

• Type <code>/search &lt;name&gt;</code> to find movies/series
• Pick your preferred quality & size
• Choose Instant Download (CDN) or direct Telegram File!`,

    STATUS: (cachedCount) => 
`<b>⚡ Status:</b> 🟢 Online
<b>📦 Cached Files:</b> <code>${cachedCount}</code>`,

    STATUS_ACTIVE: `🟢 Bot is active and running!`,

    SEARCH_EMPTY_PROMPT: 
`⚠️ Send movie name with /search
<i>Example:</i> <code>/search Inception</code>`,

    SEARCHING: (escapedQuery) => 
`🔍 Searching for <b>${escapedQuery}</b>...`,

    NO_RESULTS: (escapedQuery) => 
`❌ No results found for <b>${escapedQuery}</b>.`,

    SEARCH_RESULTS: (escapedQuery, page, totalPages, count) => 
`🎬 <b>Results for:</b> <i>${escapedQuery}</i> (${totalPages > 1 ? `Page ${page + 1}/${totalPages}` : `${count} found`})
Select below:`,

    SEARCH_ERROR: `⚠️ Search failed. Please try again.`,

    SESSION_EXPIRED: `⚠️ Session expired. Please send <code>/search movie name</code> again.`,

    LOADING_QUALITIES: (cleanTitle) => 
`⏳ Loading qualities for <b>${cleanTitle}</b>...`,

    NO_QUALITIES: (cleanTitle) => 
`⚠️ No qualities found for <b>${cleanTitle}</b>.`,

    CHOOSE_QUALITY: (cleanTitle) => 
`🎬 <b>${cleanTitle}</b>

Choose quality:`,

    QUALITIES_ERROR: `⚠️ Failed to load qualities. Please try again.`,

    SEARCH_CLOSED: `❌ Search closed.`,

    EXTRACTING_LINKS: (cleanTitle, qualityLabel) =>
`⏳ <b>Extracting download links...</b>

🎬 <b>${cleanTitle}</b>
📦 <b>${qualityLabel}</b>

<i>Please wait a moment...</i>`,

    NO_LINKS_AVAILABLE: (cleanTitle, qualityLabel) =>
`⚠️ <b>No download links available for this quality.</b>

🎬 <b>${cleanTitle}</b>
📦 <b>${qualityLabel}</b>

<i>Please retry or choose another quality option below.</i>`,

    CHOOSE_DOWNLOAD_METHOD: (cleanTitle, qualityLabel, hasCdn = true, hasTg = true) => {
        let optionsText = "";
        if (hasCdn) optionsText += "• <b>⚡ Instant Download:</b> High-speed direct link (expires in 5 min)\n";
        if (hasTg) optionsText += "• <b>📁 Telegram File:</b> Sent directly to this chat (auto-deleted in 5 min)";
        return `🎬 <b>${cleanTitle}</b>\n📦 <b>${qualityLabel}</b>\n\n<b>Select Download Method:</b>\n${optionsText.trim()}`;
    },

    GENERATING_CDN: (cleanTitle, qualityLabel) =>
`⏳ <b>Preparing Instant Download link...</b>

🎬 <b>${cleanTitle}</b>
📦 <b>${qualityLabel}</b>`,

    CDN_LINK_READY: (cleanTitle, qualityLabel) =>
`<b>⚡ Instant Download Ready!</b>

🎬 <b>${cleanTitle}</b>
📦 <b>${qualityLabel}</b>

⏳ <i>This download link will expire in 5 minutes!</i>`,

    CDN_LINK_EXPIRED: (cleanTitle, qualityLabel) =>
`<b>⌛ Link Expired</b>

🎬 <b>${cleanTitle}</b>
📦 <b>${qualityLabel}</b>

<i>The instant download link has expired. Click below to generate a new link.</i>`,

    CDN_NOT_AVAILABLE: `❌ Instant download is currently not available for this file. Please choose Telegram File.`,

    FORWARDING: (cleanTitle) => 
`⏳ Forwarding <b>${cleanTitle}</b>...`,

    CACHED_FILE_READY: (cleanTitle, qualityLabel) => 
`<b>✅ File Ready!</b>

🎬 <b>${cleanTitle}</b>

📦 <b>${qualityLabel}</b>

<i>Enjoy your movie! 🍿</i>`,

    PREPARING_FILE: (cleanTitle, qualityLabel) => 
`⏳ <b>Preparing your file...</b>

🎬 <b>${cleanTitle}</b>
📦 <b>${qualityLabel}</b>

<i>Please wait a moment...</i>`,

    FILE_READY: 
`<b>✅ File Ready!</b>

⏳ <i>This file will be deleted in 5 minutes.</i>`,

    FILE_DELETED: (cleanTitle, qualityLabel) =>
`<b>🗑 File Deleted</b>

🎬 <b>${cleanTitle}</b>
📦 <b>${qualityLabel}</b>

<i>The file has been deleted after 5 minutes to save storage. Click below to get it again.</i>`,

    DELIVERY_ERROR: `❌ Could not retrieve file. Please try again.`
};
