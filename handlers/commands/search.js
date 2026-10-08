import { searchMovies } from "../../scraper.js";
import { createSession } from "../../state/searchSessions.js";
import { buildSearchKeyboard, PAGE_SIZE } from "../../keyboards/searchKeyboard.js";
import { escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Handle /search <query> command
 */
export async function handleSearchCommand(botClient, senderId, text) {
    const query = text.replace(/^\/search\s*/i, "").trim();

    if (!query) {
        await botClient.sendMessage(senderId, {
            parseMode: "html",
            message: MESSAGES.SEARCH_EMPTY_PROMPT
        });
        return;
    }

    const escapedQuery = escapeHtml(query);
    const waitMsg = await botClient.sendMessage(senderId, {
        parseMode: "html",
        message: MESSAGES.SEARCHING(escapedQuery)
    });

    try {
        const results = await searchMovies(query);

        if (!results || results.length === 0) {
            await botClient.editMessage(senderId, {
                message: waitMsg.id,
                parseMode: "html",
                text: MESSAGES.NO_RESULTS(escapedQuery)
            });
            return;
        }

        const searchId = createSession(senderId, query, results);
        const totalPages = Math.ceil(results.length / PAGE_SIZE);

        const resultText = MESSAGES.SEARCH_RESULTS(escapedQuery, 0, totalPages, results.length);
        const keyboard = buildSearchKeyboard(searchId, results, 0);

        await botClient.editMessage(senderId, {
            message: waitMsg.id,
            parseMode: "html",
            text: resultText,
            buttons: keyboard
        });
    } catch (err) {
        console.error("Search error:", err);
        await botClient.editMessage(senderId, {
            message: waitMsg.id,
            parseMode: "html",
            text: MESSAGES.SEARCH_ERROR
        });
    }
}
