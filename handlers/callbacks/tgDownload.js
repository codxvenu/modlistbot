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
    const quality = session.qualities[qualityIndex];
    const movie = session.selectedMovie;

    if (!quality || !movie) return;

    const cleanTitle = cleanMovieTitle(movie.title);
    const escapedCleanTitle = escapeHtml(cleanTitle);
    const escapedQualityLabel = escapeHtml(quality.label);
    const movieIndex = session.results.indexOf(movie);
    const cacheKey = getCacheKey(movie.title, quality.label);

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
            let links = session.extractedLinks?.[qualityIndex];
            if (!links || !links.token) {
                console.log(`[Scraper] Extracting links for: ${quality.link}`);
                links = await extractLinks(quality.link);
                if (!session.extractedLinks) session.extractedLinks = {};
                session.extractedLinks[qualityIndex] = links;
            }

            if (!links.token) {
                await botClient.editMessage(chatId, {
                    message: messageId,
                    parseMode: "html",
                    text: MESSAGES.NO_LINKS_AVAILABLE(escapedCleanTitle, escapedQualityLabel),
                    buttons: botClient.buildReplyMarkup([
                        [
                            Button.inline("🔙 Back to Qualities", Buffer.from(`${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`))
                        ]
                    ])
                });
                return;
            }

            console.log(`[CDN] Delivering token: ${links.token} via bot: ${links.botUsername || "@tgcdn_bot"}`);
            deliveredFwd = await fetchAndDeliverFile({
                token: links.token,
                botUsername: links.botUsername,
                userChatId: chatId,
                movieTitle: movie.title,
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
                    [
                        Button.inline("🔄 Try Again", Buffer.from(`${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}`))
                    ],
                    [
                        Button.inline("🔙 Back to Qualities", Buffer.from(`${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`))
                    ],
                    [
                        Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))
                    ]
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
                    [
                        Button.inline("🔄 Get File Again", Buffer.from(`${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}`))
                    ],
                    [
                        Button.inline("🔙 Back to Qualities", Buffer.from(`${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`))
                    ]
                ])
            });
        } catch (delErr) {
            console.warn("[AutoDelete] Could not delete/edit expired file message:", delErr.message);
        }
    }, 5 * 60 * 1000);
}
