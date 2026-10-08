import { Button } from "telegram/tl/custom/button.js";
import { answerCallback } from "../../utils/callbackHelper.js";
import { extractLinks } from "../../scraper.js";
import { cleanMovieTitle, escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";
import { ACTIONS } from "../../constants/actions.js";
import { buildDownloadMethodKeyboard } from "../../keyboards/downloadMethodKeyboard.js";
import { buildSeriesTypeKeyboard } from "../../keyboards/seriesTypeKeyboard.js";
import { handleSeriesEpisodesCallback } from "./seriesTypeSelect.js";

/**
 * Handle quality selection callback: q:<searchId>:<qualityIndex>
 * 1. Checks if quality has series options (Batch vs Episodes).
 * 2. Extracts download links.
 * 3. Checks link availability.
 * 4. If nothing available -> prompts to retry or select another quality.
 * 5. If links available -> presents available download options (CDN vs Telegram).
 */
export async function handleQualitySelectCallback(botClient, event, session, searchId, parts, chatId, messageId) {
    await answerCallback(botClient, event);
    const qualityIndex = parseInt(parts[2], 10);
    const quality = session.qualities?.find(q => q.id === qualityIndex) || session.qualities?.[qualityIndex];
    const movie = session.selectedMovie;

    if (!quality || !movie) return;

    const cleanTitle = cleanMovieTitle(movie.title);
    const escapedCleanTitle = escapeHtml(cleanTitle);
    const escapedQualityLabel = escapeHtml(quality.label);
    const movieIndex = session.results.indexOf(movie);

    // If series has both batch zip and individual episode links, ask user preference
    if (quality.episodeLink && quality.zipLink) {
        const text = MESSAGES.CHOOSE_SERIES_DOWNLOAD_TYPE(escapedCleanTitle, escapedQualityLabel, quality.season);
        const keyboard = buildSeriesTypeKeyboard(searchId, qualityIndex, {
            hasBatch: true,
            hasEpisodes: true,
            season: quality.season
        });
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text,
            buttons: keyboard
        });
        return;
    }

    // If series has only episode links, open episode list directly
    if (quality.episodeLink && !quality.zipLink) {
        return await handleSeriesEpisodesCallback(botClient, event, session, searchId, parts, chatId, messageId);
    }

    // Standard movie or zip-only release: Show extracting message first
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
