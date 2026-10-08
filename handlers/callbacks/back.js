import { answerCallback } from "../../utils/callbackHelper.js";
import { buildSearchKeyboard, PAGE_SIZE } from "../../keyboards/searchKeyboard.js";
import { buildSeasonKeyboard } from "../../keyboards/seasonKeyboard.js";
import { cleanMovieTitle, escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Handle back button callback: b:<searchId>
 */
export async function handleBackCallback(botClient, event, session, searchId, chatId, messageId) {
    await answerCallback(botClient, event);
    const totalPages = Math.ceil(session.results.length / PAGE_SIZE);
    const escapedQuery = escapeHtml(session.query);
    const resultText = MESSAGES.SEARCH_RESULTS(escapedQuery, session.page, totalPages, session.results.length);

    const keyboard = buildSearchKeyboard(searchId, session.results, session.page);

    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: resultText,
        buttons: keyboard
    });
}

/**
 * Handle back to seasons callback: bs:<searchId>
 */
export async function handleBackToSeasonsCallback(botClient, event, session, searchId, chatId, messageId) {
    await answerCallback(botClient, event);
    const movie = session.selectedMovie;
    if (!movie || !session.seasons) return;

    const cleanTitle = cleanMovieTitle(movie.title);
    const escapedCleanTitle = escapeHtml(cleanTitle);

    const seasonText = MESSAGES.CHOOSE_SEASON(escapedCleanTitle);
    const keyboard = buildSeasonKeyboard(searchId, session.seasons);

    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: seasonText,
        buttons: keyboard
    });
}
