import { MESSAGES } from "../../constants/messages.js";

/**
 * Handle /help command
 */
export async function handleHelpCommand(botClient, senderId) {
    await botClient.sendMessage(senderId, {
        message: MESSAGES.HELP,
        parseMode: "html"
    });
}
