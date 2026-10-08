import { answerCallback } from "../../utils/callbackHelper.js";
import { buildSearchKeyboard, PAGE_SIZE } from "../../keyboards/searchKeyboard.js";
import { escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Handle pagination button callback: p:<searchId>:<pageIndex>
 */
export async function handlePaginationCallback(botClient, event, session, searchId, parts, chatId, messageId) {
    await answerCallback(botClient, event);
    const targetPage = parseInt(parts[2], 10);
    session.page = targetPage;

    const totalPages = Math.ceil(session.results.length / PAGE_SIZE);
    const escapedQuery = escapeHtml(session.query);
    const resultText = MESSAGES.SEARCH_RESULTS(escapedQuery, targetPage, totalPages, session.results.length);

    const keyboard = buildSearchKeyboard(searchId, session.results, targetPage);

    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: resultText,
        buttons: keyboard
    });
}
