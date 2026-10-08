import { handleStartCommand } from "./start.js";
import { handleHelpCommand } from "./help.js";
import { handleStatusCommand } from "./status.js";
import { handleSearchCommand } from "./search.js";

/**
 * Route incoming text messages and commands
 */
export async function routeMessage(botClient, event) {
    const message = event.message;
    if (!message || !message.text) return;

    const text = message.text.trim();
    const senderId = message.senderId;

    if (text === "/start" || text.startsWith("/start ")) {
        return handleStartCommand(botClient, senderId);
    }

    if (text === "/help") {
        return handleHelpCommand(botClient, senderId);
    }

    if (text === "/status") {
        return handleStatusCommand(botClient, senderId);
    }

    if (text.startsWith("/search")) {
        return handleSearchCommand(botClient, senderId, text);
    }
}
