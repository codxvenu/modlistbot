import fs from "fs";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Handle /status command
 */
export async function handleStatusCommand(botClient, senderId) {
    let cachedCount = 0;
    try {
        if (fs.existsSync("cache.json")) {
            const cache = JSON.parse(fs.readFileSync("cache.json", "utf8"));
            cachedCount = Object.keys(cache).length;
        }
    } catch {}

    await botClient.sendMessage(senderId, {
        message: MESSAGES.STATUS(cachedCount),
        parseMode: "html"
    });
}
