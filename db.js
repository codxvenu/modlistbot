import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { configDotenv } from "dotenv";

configDotenv();
const session = new StringSession(process.env.session);

const client = new TelegramClient(
    session,
    Number(process.env.apiId),
    process.env.apiHash,
    { connectionRetries: 5 }
);

await client.connect();

export default client;