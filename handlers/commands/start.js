import { Button } from "telegram/tl/custom/button.js";
import { MESSAGES } from "../../constants/messages.js";
import { ACTIONS } from "../../constants/actions.js";

/**
 * Handle /start command
 */
export async function handleStartCommand(botClient, senderId) {
    await botClient.sendMessage(senderId, {
        message: MESSAGES.WELCOME,
        parseMode: "html",
        buttons: botClient.buildReplyMarkup([
            [
                Button.inline("🔍 Help", Buffer.from(ACTIONS.HELP)),
                Button.inline("⚡ Status", Buffer.from(ACTIONS.STATUS))
            ]
        ])
    });
}
