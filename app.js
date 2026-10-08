import { botClient, startBot } from "./config/botClient.js";
import { registerHandlers } from "./handlers/registerHandlers.js";

// 1. Connect and authenticate bot with Telegram MTProto
await startBot();

// 2. Register all command and callback event listeners
registerHandlers(botClient);
