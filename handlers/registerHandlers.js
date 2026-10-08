import { NewMessage } from "telegram/events/index.js";
import { CallbackQuery } from "telegram/events/CallbackQuery.js";
import { routeMessage } from "./commands/index.js";
import { routeCallback } from "./callbacks/index.js";

/**
 * Register all message and callback event handlers with the TelegramClient instance
 * @param {import("telegram").TelegramClient} botClient 
 */
export function registerHandlers(botClient) {
    // 1. Text message & command events
    botClient.addEventHandler(
        async (event) => {
            await routeMessage(botClient, event);
        },
        new NewMessage({ incoming: true })
    );

    // 2. Callback query button events
    botClient.addEventHandler(
        async (event) => {
            await routeCallback(botClient, event);
        },
        new CallbackQuery()
    );
}
