import { Button } from "telegram/tl/custom/button.js";
import { answerCallback } from "../../utils/callbackHelper.js";
import { extractLinks, getSeriesEpisodes } from "../../scraper.js";
import { cleanMovieTitle, escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";
import { ACTIONS } from "../../constants/actions.js";
import { buildEpisodeKeyboard } from "../../keyboards/episodeKeyboard.js";
import { buildDownloadMethodKeyboard } from "../../keyboards/downloadMethodKeyboard.js";

/**
 * Handle Full Season Batch Zip selection: sz:<searchId>:<qualityId>
 */
export async function handleSeriesBatchCallback(botClient, event, session, searchId, parts, chatId, messageId) {
    await answerCallback(botClient, event);
    const qualityId = parseInt(parts[2], 10);
    const quality = session.qualities.find(q => q.id === qualityId) || session.qualities[qualityId];
    const movie = session.selectedMovie;
    if (!quality || !movie) return;

    const cleanTitle = cleanMovieTitle(movie.title);
    const escapedCleanTitle = escapeHtml(cleanTitle);
    const escapedQualityLabel = escapeHtml(quality.label);
    const movieIndex = session.results.indexOf(movie);
    const targetLink = quality.zipLink || quality.link;

    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: MESSAGES.EXTRACTING_LINKS(escapedCleanTitle, `${escapedQualityLabel} (Full Season Zip)`)
    });

    try {
        if (!session.extractedLinks) session.extractedLinks = {};
        let links = session.extractedLinks[`batch_${qualityId}`];
        if (!links) {
            console.log(`[SeriesBatch] Extracting links for: ${targetLink}`);
            links = await extractLinks(targetLink);
            session.extractedLinks[`batch_${qualityId}`] = links;
        }

        const hasCdn = Boolean(links?.cdnLink);
        const hasTg = Boolean(links?.token);

        if (!hasCdn && !hasTg) {
            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: MESSAGES.NO_LINKS_AVAILABLE(escapedCleanTitle, `${escapedQualityLabel} (Full Season Zip)`),
                buttons: botClient.buildReplyMarkup([
                    [Button.inline("🔄 Retry", Buffer.from(`${ACTIONS.SELECT_SERIES_BATCH}:${searchId}:${qualityId}`))],
                    [Button.inline("🔙 Back to Options", Buffer.from(`${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityId}`))],
                    [Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))]
                ])
            });
            return;
        }

        const keyboard = buildDownloadMethodKeyboard(searchId, qualityId, movieIndex, {
            hasCdn,
            hasTg,
            isSeriesBatch: true
        });

        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.CHOOSE_DOWNLOAD_METHOD(escapedCleanTitle, `${escapedQualityLabel} (Full Season Zip)`, hasCdn, hasTg),
            buttons: keyboard
        });
    } catch (err) {
        console.error("[SeriesBatch] Extraction error:", err);
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.NO_LINKS_AVAILABLE(escapedCleanTitle, `${escapedQualityLabel} (Full Season Zip)`),
            buttons: botClient.buildReplyMarkup([
                [Button.inline("🔄 Retry", Buffer.from(`${ACTIONS.SELECT_SERIES_BATCH}:${searchId}:${qualityId}`))],
                [Button.inline("🔙 Back to Options", Buffer.from(`${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityId}`))],
                [Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))]
            ])
        });
    }
}

/**
 * Handle Individual Episodes selection: se:<searchId>:<qualityId>
 */
export async function handleSeriesEpisodesCallback(botClient, event, session, searchId, parts, chatId, messageId) {
    await answerCallback(botClient, event);
    const qualityId = parseInt(parts[2], 10);
    const quality = session.qualities.find(q => q.id === qualityId) || session.qualities[qualityId];
    const movie = session.selectedMovie;
    if (!quality || !movie) return;

    const cleanTitle = cleanMovieTitle(movie.title);
    const escapedCleanTitle = escapeHtml(cleanTitle);
    const escapedQualityLabel = escapeHtml(quality.label);

    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: MESSAGES.LOADING_EPISODES(escapedCleanTitle, escapedQualityLabel)
    });

    try {
        let episodes = session.episodes;
        if (!episodes || session.episodesQualityId !== qualityId) {
            console.log(`[SeriesEpisodes] Fetching episodes from: ${quality.episodeLink}`);
            episodes = await getSeriesEpisodes(quality.episodeLink);
            session.episodes = episodes;
            session.episodesQualityId = qualityId;
        }

        if (!episodes || episodes.length === 0) {
            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: MESSAGES.NO_EPISODES(escapedCleanTitle, escapedQualityLabel),
                buttons: botClient.buildReplyMarkup([
                    [Button.inline("🔙 Back to Options", Buffer.from(`${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityId}`))]
                ])
            });
            return;
        }

        const keyboard = buildEpisodeKeyboard(searchId, qualityId, episodes);
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.CHOOSE_EPISODE(escapedCleanTitle, escapedQualityLabel),
            buttons: keyboard
        });
    } catch (err) {
        console.error("[SeriesEpisodes] Fetch error:", err);
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.NO_EPISODES(escapedCleanTitle, escapedQualityLabel),
            buttons: botClient.buildReplyMarkup([
                [Button.inline("🔙 Back to Options", Buffer.from(`${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityId}`))]
            ])
        });
    }
}
