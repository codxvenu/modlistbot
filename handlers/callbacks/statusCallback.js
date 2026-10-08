import { answerCallback } from "../../utils/callbackHelper.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Handle cmd_status button callback
 */
export async function handleStatusCallback(botClient, event, chatId) {
    await answerCallback(botClient, event);
    await botClient.sendMessage(chatId, {
        parseMode: "html",
        message: MESSAGES.STATUS_ACTIVE
    });
}
