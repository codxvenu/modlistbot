import { Api } from "telegram";

/**
 * Official Bot Commands definition
 */
export const BOT_COMMANDS = [
    {
        command: "start",
        description: "Start the bot & view main menu"
    },
    {
        command: "search",
        description: "Search for movies or series"
    },
    {
        command: "help",
        description: "Show help and usage guide"
    },
    {
        command: "status",
        description: "Check bot health and service status"
    }
];

/**
 * Remove all existing bot commands across all scopes and register fresh commands.
 * Runs on every bot start / restart.
 * @param {import("telegram").TelegramClient} botClient 
 */
export async function resetAndSetupCommands(botClient) {
    console.log("[BotCommands] Removing all previous bot commands...");

    const scopes = [
        new Api.BotCommandScopeDefault(),
        new Api.BotCommandScopeUsers(),
        new Api.BotCommandScopeChats(),
        new Api.BotCommandScopeChatAdmins()
    ];

    // 1. Wipe all commands from all possible scopes and languages
    for (const scope of scopes) {
        try {
            await botClient.invoke(
                new Api.bots.ResetBotCommands({
                    scope: scope,
                    langCode: ""
                })
            );
        } catch (e) {
            // Scope might not have commands or permission, continue
        }
    }

    console.log("[BotCommands] Setting up fresh bot commands list...");

    // 2. Register fresh commands list
    try {
        await botClient.invoke(
            new Api.bots.SetBotCommands({
                scope: new Api.BotCommandScopeDefault(),
                langCode: "",
                commands: BOT_COMMANDS.map(c => new Api.BotCommand({
                    command: c.command,
                    description: c.description
                }))
            })
        );
        console.log(`[BotCommands] Successfully registered ${BOT_COMMANDS.length} bot commands: [${BOT_COMMANDS.map(c => '/' + c.command).join(', ')}]`);
    } catch (err) {
        console.error("[BotCommands] Failed to set bot commands:", err.message);
    }
}
