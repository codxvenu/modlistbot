import { Button } from "telegram/tl/custom/button.js";
import { answerCallback } from "../../utils/callbackHelper.js";
import { extractLinks, resolveDirectCdnLink } from "../../scraper.js";
import { cleanMovieTitle, escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";
import { ACTIONS } from "../../constants/actions.js";

/**
 * Handle Instant Download (CDN link) callback: dl_cdn:<searchId>:<qualityIndex>
 */
export async function handleCdnDownloadCallback(botClient, event, session, searchId, parts, chatId, messageId) {
    await answerCallback(botClient, event);
    const qualityIndex = parseInt(parts[2], 10);
    const episodeIndex = parts[3] !== undefined ? parseInt(parts[3], 10) : null;

    const quality = session.qualities?.find(q => q.id === qualityIndex) || session.qualities?.[qualityIndex];
    const episode = episodeIndex !== null ? session.episodes?.[episodeIndex] : null;
    const movie = session.selectedMovie;

    if (!quality || !movie) return;

    const cleanTitle = cleanMovieTitle(movie.title);
    const displayTitle = episode
        ? `${cleanTitle} - S${String(quality.season || 1).padStart(2, "0")}${episode.shortLabel || `E${episode.episodeNumber}`}`
        : (quality.season ? `${cleanTitle} (Season ${quality.season})` : cleanTitle);

    const escapedCleanTitle = escapeHtml(displayTitle);
    const escapedQualityLabel = escapeHtml(quality.label);
    const movieIndex = session.results.indexOf(movie);

    const targetUrl = episode ? episode.url : (quality.zipLink || quality.link);
    const linkCacheKey = episode ? `ep_${qualityIndex}_${episodeIndex}` : `batch_${qualityIndex}`;

    // Retrieve already-extracted link from session or extract fresh if expired
    let links = session.extractedLinks?.[linkCacheKey];
    if (!links || !links.cdnLink) {
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.GENERATING_CDN(escapedCleanTitle, escapedQualityLabel)
        });

        try {
            console.log(`[CDN] Extracting fresh instant download link for: ${targetUrl}`);
            links = await extractLinks(targetUrl);
            if (!session.extractedLinks) session.extractedLinks = {};
            session.extractedLinks[linkCacheKey] = links;
        } catch (err) {
            console.error("[CDN] Extraction error:", err);
            const retryAction = episodeIndex !== null
                ? `${ACTIONS.DOWNLOAD_CDN}:${searchId}:${qualityIndex}:${episodeIndex}`
                : `${ACTIONS.DOWNLOAD_CDN}:${searchId}:${qualityIndex}`;
            const backAction = episodeIndex !== null
                ? `${ACTIONS.SELECT_SERIES_EPISODES}:${searchId}:${qualityIndex}`
                : (quality.season ? `${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityIndex}` : `${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`);

            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: MESSAGES.DELIVERY_ERROR,
                buttons: botClient.buildReplyMarkup([
                    [Button.inline("🔄 Try Again", Buffer.from(retryAction))],
                    [Button.inline(episodeIndex !== null ? "🔙 Back to Episodes" : "🔙 Back", Buffer.from(backAction))],
                    [Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))]
                ])
            });
            return;
        }
    }

    let cdnLink = links?.cdnLink || links?.rawCdnLink;
    if (cdnLink && (cdnLink.includes("video-gen.xyz") || cdnLink.includes("video-seed.dev"))) {
        cdnLink = await resolveDirectCdnLink(cdnLink);
        if (links) links.cdnLink = cdnLink;
    }

    const backAction = episodeIndex !== null
        ? `${ACTIONS.SELECT_SERIES_EPISODES}:${searchId}:${qualityIndex}`
        : (quality.season ? `${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityIndex}` : `${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`);

    if (!cdnLink) {
        const tgAction = episodeIndex !== null
            ? `${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}:${episodeIndex}`
            : `${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}`;

        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.CDN_NOT_AVAILABLE,
            buttons: botClient.buildReplyMarkup([
                [Button.inline("📁 Telegram File", Buffer.from(tgAction))],
                [Button.inline(episodeIndex !== null ? "🔙 Back to Episodes" : "🔙 Back", Buffer.from(backAction))]
            ])
        });
        return;
    }

    // Prepare buttons: Direct File Download URL button + optional Telegram File switch + Back
    const actionButtons = [
        [Button.url("⚡ Direct Instant Download", cdnLink)]
    ];

    if (links?.token) {
        const tgAction = episodeIndex !== null
            ? `${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}:${episodeIndex}`
            : `${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}`;
        actionButtons.push([
            Button.inline("📁 Send to Telegram Instead", Buffer.from(tgAction))
        ]);
    }

    actionButtons.push([
        Button.inline(episodeIndex !== null ? "🔙 Back to Episodes" : "🔙 Back", Buffer.from(backAction))
    ]);

    // Send ready message with 5-minute expiry warning
    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: MESSAGES.CDN_LINK_READY(escapedCleanTitle, escapedQualityLabel),
        buttons: botClient.buildReplyMarkup(actionButtons)
    });

    // 5-minute expiration timer
    setTimeout(async () => {
        try {
            // Invalidate session cached link so "Get Link Again" generates fresh
            if (session.extractedLinks) {
                delete session.extractedLinks[linkCacheKey];
            }

            const retryAction = episodeIndex !== null
                ? `${ACTIONS.DOWNLOAD_CDN}:${searchId}:${qualityIndex}:${episodeIndex}`
                : `${ACTIONS.DOWNLOAD_CDN}:${searchId}:${qualityIndex}`;

            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: MESSAGES.CDN_LINK_EXPIRED(escapedCleanTitle, escapedQualityLabel),
                buttons: botClient.buildReplyMarkup([
                    [Button.inline("🔄 Get Link Again", Buffer.from(retryAction))],
                    [Button.inline(episodeIndex !== null ? "🔙 Back to Episodes" : "🔙 Back", Buffer.from(backAction))]
                ])
            });
        } catch (expireErr) {
            console.warn("[CDN] Could not update expired message:", expireErr.message);
        }
    }, 5 * 60 * 1000);
}
