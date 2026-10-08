import { Button } from "telegram/tl/custom/button.js";
import { answerCallback } from "../../utils/callbackHelper.js";
import { getMovieQualities } from "../../scraper.js";
import { buildQualityKeyboard } from "../../keyboards/qualityKeyboard.js";
import { buildSeasonKeyboard } from "../../keyboards/seasonKeyboard.js";
import { cleanMovieTitle, escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";
import { ACTIONS } from "../../constants/actions.js";

/**
 * Handle movie selection callback: m:<searchId>:<movieIndex>
 */
export async function handleMovieSelectCallback(botClient, event, session, searchId, parts, chatId, messageId) {
    await answerCallback(botClient, event);
    const movieIndex = parseInt(parts[2], 10);
    const movie = session.results[movieIndex];
    if (!movie) return;

    session.selectedMovie = movie;
    const cleanTitle = cleanMovieTitle(movie.title);
    const escapedCleanTitle = escapeHtml(cleanTitle);

    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: MESSAGES.LOADING_QUALITIES(escapedCleanTitle)
    });

    try {
        const qualities = await getMovieQualities(movie.link);
        session.qualities = qualities;

        if (!qualities || qualities.length === 0) {
            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: MESSAGES.NO_QUALITIES(escapedCleanTitle),
                buttons: [
                    [Button.inline("🔙 Back to Results", Buffer.from(`${ACTIONS.BACK}:${searchId}`))]
                ]
            });
            return;
        }

        const seasons = [...new Set(qualities.map(q => q.season).filter(s => s !== null && s !== undefined))].sort((a, b) => a - b);
        session.seasons = seasons;

        // Multi-Season Series: present Season Selector
        if (seasons.length > 1) {
            const seasonText = MESSAGES.CHOOSE_SEASON(escapedCleanTitle);
            const keyboard = buildSeasonKeyboard(searchId, seasons);

            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: seasonText,
                buttons: keyboard
            });
            return;
        }

        // Single Season Series: display qualities with season title
        if (seasons.length === 1) {
            session.selectedSeason = seasons[0];
            const seasonQualities = qualities.filter(q => q.season === seasons[0]);
            const qualityText = MESSAGES.CHOOSE_QUALITY_SERIES(escapedCleanTitle, seasons[0]);
            const keyboard = buildQualityKeyboard(searchId, seasonQualities, { showBackToSeasons: false });

            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: qualityText,
                buttons: keyboard
            });
            return;
        }

        // Standard Movie
        const qualityText = MESSAGES.CHOOSE_QUALITY(escapedCleanTitle);
        const keyboard = buildQualityKeyboard(searchId, qualities, { showBackToSeasons: false });

        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: qualityText,
            buttons: keyboard
        });
    } catch (err) {
        console.error("Quality fetch error:", err);
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.QUALITIES_ERROR,
            buttons: [
                [Button.inline("🔙 Back to Results", Buffer.from(`${ACTIONS.BACK}:${searchId}`))]
            ]
        });
    }
}
