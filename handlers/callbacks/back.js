import { answerCallback } from "../../utils/callbackHelper.js";
import { buildSearchKeyboard, PAGE_SIZE } from "../../keyboards/searchKeyboard.js";
import { escapeHtml } from "../../utils/formatters.js";
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
