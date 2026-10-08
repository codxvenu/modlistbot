import { Button } from "telegram/tl/custom/button.js";
import { answerCallback } from "../../utils/callbackHelper.js";
import { extractLinks } from "../../scraper.js";
import { cleanMovieTitle, escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";
import { ACTIONS } from "../../constants/actions.js";
import { buildDownloadMethodKeyboard } from "../../keyboards/downloadMethodKeyboard.js";

/**
 * Handle Episode selection callback: ep:<searchId>:<qualityId>:<episodeIndex>
 */
export async function handleEpisodeSelectCallback(botClient, event, session, searchId, parts, chatId, messageId) {
    await answerCallback(botClient, event);
    const qualityId = parseInt(parts[2], 10);
    const episodeIndex = parseInt(parts[3], 10);

    const quality = session.qualities?.find(q => q.id === qualityId) || session.qualities?.[qualityId];
    const episode = session.episodes?.[episodeIndex];
    const movie = session.selectedMovie;

    if (!quality || !episode || !movie) return;

    const cleanTitle = cleanMovieTitle(movie.title);
    const escapedCleanTitle = escapeHtml(cleanTitle);
    const escapedEpisodeLabel = escapeHtml(episode.label);
    const escapedQualityLabel = escapeHtml(quality.label);
    const movieIndex = session.results.indexOf(movie);

    // 1. Show extracting message
    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: MESSAGES.EXTRACTING_LINKS(escapedCleanTitle, `${escapedEpisodeLabel} • ${escapedQualityLabel}`)
    });

    try {
        if (!session.extractedEpisodeLinks) {
            session.extractedEpisodeLinks = {};
        }

        const cacheKey = `${qualityId}_${episodeIndex}`;
        let links = session.extractedEpisodeLinks[cacheKey];

        if (!links) {
            console.log(`[EpisodeSelect] Extracting links for ${episode.label}: ${episode.url.slice(0, 60)}...`);
            links = await extractLinks(episode.url);
            session.extractedEpisodeLinks[cacheKey] = links;
        }

        const hasCdn = Boolean(links?.cdnLink);
        const hasTg = Boolean(links?.token);

        if (!hasCdn && !hasTg) {
            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: MESSAGES.NO_LINKS_AVAILABLE(escapedCleanTitle, `${escapedEpisodeLabel} • ${escapedQualityLabel}`),
                buttons: botClient.buildReplyMarkup([
                    [Button.inline("🔄 Retry", Buffer.from(`${ACTIONS.SELECT_EPISODE}:${searchId}:${qualityId}:${episodeIndex}`))],
                    [Button.inline("🔙 Back to Episodes", Buffer.from(`${ACTIONS.SELECT_SERIES_EPISODES}:${searchId}:${qualityId}`))],
                    [Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))]
                ])
            });
            return;
        }

        const keyboard = buildDownloadMethodKeyboard(searchId, qualityId, movieIndex, {
            hasCdn,
            hasTg,
            episodeIndex
        });

        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.CHOOSE_DOWNLOAD_METHOD(escapedCleanTitle, `${escapedEpisodeLabel} • ${escapedQualityLabel}`, hasCdn, hasTg),
            buttons: keyboard
        });
    } catch (err) {
        console.error("[EpisodeSelect] Extraction error:", err);
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.NO_LINKS_AVAILABLE(escapedCleanTitle, `${escapedEpisodeLabel} • ${escapedQualityLabel}`),
            buttons: botClient.buildReplyMarkup([
                [Button.inline("🔄 Retry", Buffer.from(`${ACTIONS.SELECT_EPISODE}:${searchId}:${qualityId}:${episodeIndex}`))],
                [Button.inline("🔙 Back to Episodes", Buffer.from(`${ACTIONS.SELECT_SERIES_EPISODES}:${searchId}:${qualityId}`))],
                [Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))]
            ])
        });
    }
}
