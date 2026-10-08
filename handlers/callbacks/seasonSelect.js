import { answerCallback } from "../../utils/callbackHelper.js";
import { buildQualityKeyboard } from "../../keyboards/qualityKeyboard.js";
import { cleanMovieTitle, escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Handle season selection callback: s:<searchId>:<seasonNumber>
 */
export async function handleSeasonSelectCallback(botClient, event, session, searchId, parts, chatId, messageId) {
    await answerCallback(botClient, event);
    const seasonNumber = parseInt(parts[2], 10);
    const movie = session.selectedMovie;
    if (!movie) return;

    session.selectedSeason = seasonNumber;
    const cleanTitle = cleanMovieTitle(movie.title);
    const escapedCleanTitle = escapeHtml(cleanTitle);

    const seasonQualities = (session.qualities || []).filter(q => q.season === seasonNumber);
    const qualityText = MESSAGES.CHOOSE_QUALITY_SERIES(escapedCleanTitle, seasonNumber);
    const keyboard = buildQualityKeyboard(searchId, seasonQualities, { showBackToSeasons: true });

    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: qualityText,
        buttons: keyboard
    });
}
