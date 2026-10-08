import { Button } from "telegram/tl/custom/button.js";
import { answerCallback } from "../../utils/callbackHelper.js";
import { getMovieQualities } from "../../scraper.js";
import { buildQualityKeyboard } from "../../keyboards/qualityKeyboard.js";
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

        const qualityText = MESSAGES.CHOOSE_QUALITY(escapedCleanTitle);
        const keyboard = buildQualityKeyboard(searchId, qualities);

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
