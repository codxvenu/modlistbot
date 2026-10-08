import { answerCallback } from "../../utils/callbackHelper.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Handle cmd_help button callback
 */
export async function handleHelpCallback(botClient, event, chatId) {
    await answerCallback(botClient, event);
    await botClient.sendMessage(chatId, {
        message: MESSAGES.HELP,
        parseMode: "html"
    });
}
