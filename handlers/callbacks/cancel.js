import { answerCallback } from "../../utils/callbackHelper.js";
import { deleteSession } from "../../state/searchSessions.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Handle cancel button callback: c:<searchId>
 */
export async function handleCancelCallback(botClient, event, searchId, chatId, messageId) {
    await answerCallback(botClient, event);
    deleteSession(searchId);
    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: MESSAGES.SEARCH_CLOSED
    });
}
