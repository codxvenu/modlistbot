import { Button } from "telegram/tl/custom/button.js";
import { answerCallback } from "../../utils/callbackHelper.js";
import { extractLinks } from "../../scraper.js";
import { cleanMovieTitle, escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";
import { ACTIONS } from "../../constants/actions.js";
import { buildDownloadMethodKeyboard } from "../../keyboards/downloadMethodKeyboard.js";

/**
 * Handle quality selection callback: q:<searchId>:<qualityIndex>
 * 1. Extracts download links first.
 * 2. Checks link availability.
 * 3. If nothing available -> prompts to retry or select another quality.
 * 4. If links available -> presents available download options (CDN vs Telegram).
 */
export async function handleQualitySelectCallback(botClient, event, session, searchId, parts, chatId, messageId) {
    await answerCallback(botClient, event);
    const qualityIndex = parseInt(parts[2], 10);
    const quality = session.qualities[qualityIndex];
    const movie = session.selectedMovie;

    if (!quality || !movie) return;

    const cleanTitle = cleanMovieTitle(movie.title);
    const escapedCleanTitle = escapeHtml(cleanTitle);
    const escapedQualityLabel = escapeHtml(quality.label);
    const movieIndex = session.results.indexOf(movie);

    // 1. Show extracting message first
    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: MESSAGES.EXTRACTING_LINKS(escapedCleanTitle, escapedQualityLabel)
    });

    try {
        // 2. Extract links (or reuse previously extracted links for this quality if still fresh)
        if (!session.extractedLinks) {
            session.extractedLinks = {};
        }

        let links = session.extractedLinks[qualityIndex];
        if (!links) {
            console.log(`[Scraper] Extracting links for: ${quality.link}`);
            links = await extractLinks(quality.link);
            session.extractedLinks[qualityIndex] = links;
        }

        const hasCdn = Boolean(links?.cdnLink);
        const hasTg = Boolean(links?.token);

        // 3. If nothing is available, ask to retry with another quality
        if (!hasCdn && !hasTg) {
            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: MESSAGES.NO_LINKS_AVAILABLE(escapedCleanTitle, escapedQualityLabel),
                buttons: botClient.buildReplyMarkup([
                    [
                        Button.inline("🔄 Retry", Buffer.from(`${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityIndex}`))
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

        // 4. Links came! Present only the available options to the user
        const keyboard = buildDownloadMethodKeyboard(searchId, qualityIndex, movieIndex, { hasCdn, hasTg });
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.CHOOSE_DOWNLOAD_METHOD(escapedCleanTitle, escapedQualityLabel, hasCdn, hasTg),
            buttons: keyboard
        });

    } catch (err) {
        console.error("Link extraction error:", err);
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.NO_LINKS_AVAILABLE(escapedCleanTitle, escapedQualityLabel),
            buttons: botClient.buildReplyMarkup([
                [
                    Button.inline("🔄 Retry", Buffer.from(`${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityIndex}`))
                ],
                [
                    Button.inline("🔙 Back to Qualities", Buffer.from(`${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`))
                ],
                [
                    Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))
                ]
            ])
        });
    }
}
