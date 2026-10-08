import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { configDotenv } from "dotenv";
import fs from "fs";
import { resetAndSetupCommands } from "./botCommands.js";

configDotenv();

const botToken = process.env.botToken || process.env.TgbotToken;
if (!botToken) {
    console.error("Error: botToken or TgbotToken is not defined in .env!");
    process.exit(1);
}

// 1. Resolve bot session from bot.json or initialize new
let botSessionStr = "";
try {
    if (fs.existsSync("bot.json")) {
        const botData = JSON.parse(fs.readFileSync("bot.json", "utf8"));
        botSessionStr = botData.bots?.[botToken] || "";
    }
} catch (e) {
    console.warn("Could not read bot.json:", e.message);
}

export const botClient = new TelegramClient(
    new StringSession(botSessionStr),
    Number(process.env.apiId),
    process.env.apiHash,
    { connectionRetries: 5 }
);

/**
 * Connect the bot to Telegram MTProto and persist session token
 */
export async function startBot() {
    console.log("Starting Telegram Bot...");
    await botClient.start({
        botAuthToken: botToken
    });

    // Save session if changed/new
    const savedSession = botClient.session.save();
    if (savedSession && savedSession !== botSessionStr) {
        try {
            let botData = { bots: {} };
            if (fs.existsSync("bot.json")) {
                botData = JSON.parse(fs.readFileSync("bot.json", "utf8"));
                if (!botData.bots) botData.bots = {};
            }
            botData.bots[botToken] = savedSession;
            fs.writeFileSync("bot.json", JSON.stringify(botData, null, 2), "utf8");
        } catch (e) {
            console.warn("Could not persist bot session to bot.json:", e.message);
        }
    }

    const botMe = await botClient.getMe();
    console.log(`🤖 Bot @${botMe.username} is now online and listening!`);

    // Reset old commands and setup fresh command list for every start / restart
    await resetAndSetupCommands(botClient);

    return botMe;
}
