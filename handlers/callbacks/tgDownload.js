import { Button } from "telegram/tl/custom/button.js";
import { answerCallback } from "../../utils/callbackHelper.js";
import { extractLinks } from "../../scraper.js";
import { fetchAndDeliverFile, forwardFromCache, getCacheKey, getCachedFile } from "../../cdnFetcher.js";
import { cleanMovieTitle, escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";
import { ACTIONS } from "../../constants/actions.js";

/**
 * Handle Telegram File delivery callback: dl_tg:<searchId>:<qualityIndex>
 */
export async function handleTgDownloadCallback(botClient, event, session, searchId, parts, chatId, messageId) {
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
    const cacheKey = getCacheKey(displayTitle, quality.label);

    const targetUrl = episode ? episode.url : (quality.zipLink || quality.link);
    const linkCacheKey = episode ? `ep_${qualityIndex}_${episodeIndex}` : `batch_${qualityIndex}`;

    const backAction = episodeIndex !== null
        ? `${ACTIONS.SELECT_SERIES_EPISODES}:${searchId}:${qualityIndex}`
        : (quality.season ? `${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityIndex}` : `${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`);

    const retryAction = episodeIndex !== null
        ? `${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}:${episodeIndex}`
        : `${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}`;

    let deliveredFwd = null;

    // 1. Check Backup Channel Cache First!
    const isCached = getCachedFile(cacheKey);
    if (isCached) {
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.FORWARDING(escapedCleanTitle)
        });

        deliveredFwd = await forwardFromCache(cacheKey, chatId, botClient);
    }

    // 2. Fresh extraction & delivery if not in backup channel
    if (!deliveredFwd) {
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.PREPARING_FILE(escapedCleanTitle, escapedQualityLabel)
        });

        try {
            let links = session.extractedLinks?.[linkCacheKey];
            if (!links || !links.token) {
                console.log(`[Scraper] Extracting links for: ${targetUrl}`);
                links = await extractLinks(targetUrl);
                if (!session.extractedLinks) session.extractedLinks = {};
                session.extractedLinks[linkCacheKey] = links;
            }

            if (!links.token) {
                await botClient.editMessage(chatId, {
                    message: messageId,
                    parseMode: "html",
                    text: MESSAGES.NO_LINKS_AVAILABLE(escapedCleanTitle, escapedQualityLabel),
                    buttons: botClient.buildReplyMarkup([
                        [Button.inline(episodeIndex !== null ? "🔙 Back to Episodes" : "🔙 Back", Buffer.from(backAction))]
                    ])
                });
                return;
            }

            console.log(`[CDN] Delivering token: ${links.token} via bot: ${links.botUsername || "@tgcdn_bot"}`);
            deliveredFwd = await fetchAndDeliverFile({
                token: links.token,
                botUsername: links.botUsername,
                userChatId: chatId,
                movieTitle: displayTitle,
                qualityLabel: quality.label,
                botClient
            });
        } catch (err) {
            console.error("Delivery error:", err);
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

    // Determine the message ID of the delivered file
    let deliveredMsgId = null;
    if (Array.isArray(deliveredFwd) && deliveredFwd.length > 0) {
        deliveredMsgId = deliveredFwd[0].id;
    } else if (deliveredFwd?.id) {
        deliveredMsgId = deliveredFwd.id;
    }

    // Delete the preparing message
    await botClient.deleteMessages(chatId, [messageId], { revoke: true }).catch(() => {});

    // Send file ready notice
    const noticeMsg = await botClient.sendMessage(chatId, {
        parseMode: "html",
        message: MESSAGES.FILE_READY
    });

    // Schedule 5-minute auto-deletion of the file and edit notice with "Get File Again" button
    setTimeout(async () => {
        try {
            if (deliveredMsgId) {
                console.log(`[AutoDelete] Deleting file message ${deliveredMsgId} for user ${chatId}`);
                await botClient.deleteMessages(chatId, [deliveredMsgId], { revoke: true }).catch(() => {});
            }

            await botClient.editMessage(chatId, {
                message: noticeMsg.id,
                parseMode: "html",
                text: MESSAGES.FILE_DELETED(escapedCleanTitle, escapedQualityLabel),
                buttons: botClient.buildReplyMarkup([
                    [Button.inline("🔄 Get File Again", Buffer.from(retryAction))],
                    [Button.inline(episodeIndex !== null ? "🔙 Back to Episodes" : "🔙 Back", Buffer.from(backAction))]
                ])
            });
        } catch (delErr) {
            console.warn("[AutoDelete] Could not delete/edit expired file message:", delErr.message);
        }
    }, 5 * 60 * 1000);
}
