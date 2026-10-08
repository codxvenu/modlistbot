import { Api } from "telegram";

/**
 * Safely answer an incoming Telegram callback query to dismiss client spinners
 * 
 * @param {import("telegram").TelegramClient} botClient 
 * @param {any} event 
 * @param {Object} [options]
 * @param {string} [options.message]
 * @param {boolean} [options.alert]
 * @param {string} [options.url]
 * @param {number} [options.cacheTime]
 */
export async function answerCallback(botClient, event, options = {}) {
    try {
        const queryId = event.query?.queryId || event.id;
        if (!queryId) return;

        await botClient.invoke(
            new Api.messages.SetBotCallbackAnswer({
                queryId: queryId,
                message: options.message,
                alert: Boolean(options.alert),
                url: options.url,
                cacheTime: options.cacheTime ?? 0
            })
        );
    } catch {
        try {
            await event.answer(options);
        } catch {
            // Silently ignore if already answered or expired
        }
    }
}
