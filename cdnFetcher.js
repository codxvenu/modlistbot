import client from "./db.js";
import { Api } from "telegram";
import { NewMessage } from "telegram/events/index.js";
import fs from "fs";
import path from "path";

const CACHE_FILE = path.resolve("./cache.json");

/**
 * Load backup cache
 */
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        }
    } catch (e) {
        console.error("Error reading cache:", e.message);
    }
    return {};
}

/**
 * Save item to backup cache
 */
function saveCache(cache) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
    } catch (e) {
        console.error("Error writing cache:", e.message);
    }
}

/**
 * Generate consistent cache key
 */
export function getCacheKey(title, quality) {
    return `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}__${quality.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

/**
 * Check if file is already backed up in channel
 */
export function getCachedFile(cacheKey) {
    const cache = loadCache();
    return cache[cacheKey] || null;
}

/**
 * Connect user client if not already connected
 */
async function ensureConnected() {
    if (!client.connected) {
        await client.connect();
    }
}

/**
 * Format channel ID with -100 prefix for supergroups/channels
 */
function getBackupPeer() {
    const raw = process.env.backupChannel;
    if (!raw) return null;
    return raw.startsWith("-100") ? raw : `-100${raw}`;
}

/**
 * Forward cached file directly from backup channel to user using the bot client.
 * Strips the caption and delivers from the Bot so admin identity is never revealed.
 */
export async function forwardFromCache(cacheKey, userChatId, botClient = null) {
    const cached = getCachedFile(cacheKey);
    const backupPeer = getBackupPeer();

    if (!cached || !backupPeer) return false;

    if (!botClient) {
        console.error("[Forwarder] botClient is required to deliver files without exposing admin identity.");
        return false;
    }

    try {
        const channelEntity = await botClient.getEntity(backupPeer);
        const msgs = await botClient.getMessages(channelEntity, { ids: [cached.channelMessageId] });
        
        if (msgs && msgs[0] && msgs[0].media) {
            const userMsg = await botClient.sendFile(userChatId, {
                file: msgs[0].media,
                caption: "" // Strip caption completely
            });
            console.log(`[Forwarder] Delivered cached file ${cached.fileId || cached.channelMessageId} via Bot from channel (caption stripped, zero admin exposure).`);
            return userMsg;
        } else {
            console.warn(`[Forwarder] Cached message ${cached.channelMessageId} not found or has no media in backup channel.`);
            return false;
        }
    } catch (err) {
        console.error("[Forwarder] Error forwarding from cache via bot:", err.message);
        return false;
    }
}

/**
 * Request file from source bot (@tgcdn_bot / @seedcdn_bot), forward to channel,
 * then deliver from channel to user via botClient with stripped caption.
 * @param {Object} params
 * @param {string} params.token
 * @param {string|null} [params.botUsername]
 * @param {string|number|bigint} params.userChatId
 * @param {string} params.movieTitle
 * @param {string} params.qualityLabel
 * @param {any} params.botClient
 */
export async function fetchAndDeliverFile({ token, botUsername = null, userChatId, movieTitle, qualityLabel, botClient = null }) {
    await ensureConnected();

    const botPeer = botUsername || "@tgcdn_bot";
    const targetBot = await client.getEntity(botPeer);
    const cacheKey = getCacheKey(movieTitle, qualityLabel);
    const backupPeer = getBackupPeer();

    if (!backupPeer) {
        throw new Error("backupChannel is not configured in .env");
    }

    if (!botClient) {
        throw new Error("botClient is required to deliver files without exposing admin identity.");
    }

    // 1. Set up event handler promise with 45s timeout for bot response
    const replyPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            client.removeEventHandler(handler);
            reject(new Error(`Timeout waiting for response from ${botPeer}.`));
        }, 45000);

        const handler = async (event) => {
            const message = event.message;
            if (message && message.senderId && message.senderId.toString() === targetBot.id.toString()) {
                clearTimeout(timeout);
                client.removeEventHandler(handler);
                resolve(message);
            }
        };

        client.addEventHandler(handler, new NewMessage({ chats: [targetBot.id] }));
    });

    // 2. Personal account sends /start <token> to source bot in private chat
    await client.invoke(
        new Api.messages.SendMessage({
            peer: targetBot,
            message: `/start ${token}`,
            randomId: BigInt(Math.floor(Math.random() * 1000000000))
        })
    );

    // 3. Await reply message containing the file
    const reply = await replyPromise;

    // Extract exact file reference ID to prevent mismatched files
    const fileDoc = reply.media?.document;
    const fileId = fileDoc?.id?.toString() || reply.id.toString();
    console.log(`[CDN] Received file from ${botPeer} with File ID: ${fileId}`);

    // 4. Forward file from personal account to BACKUP CHANNEL first
    const channelEntity = await client.getEntity(backupPeer);
    const fwdList = await client.forwardMessages(channelEntity, {
        messages: [reply.id],
        withMyScore: true,
        dropAuthor: true,
        noforwards: true,
        dropMediaCaptions: true,
        fromPeer: targetBot
    });

    if (!fwdList || fwdList.length === 0) {
        throw new Error("Failed to forward file to the backup channel.");
    }

    const channelMessage = fwdList[0];
    const channelMessageId = channelMessage[0]?.id || channelMessage.id;
    console.log(`[CDN] File stored in backup channel. Message ID: ${channelMessageId}`);

    // 5. Save to cache with file reference
    const cache = loadCache();
    cache[cacheKey] = {
        channelMessageId: channelMessageId,
        fileId: fileId,
        title: movieTitle,
        quality: qualityLabel,
        date: new Date().toISOString()
    };
    saveCache(cache);

    // 6. Deliver file FROM THE BACKUP CHANNEL to the USER via botClient
    // This ensures:
    //  - The personal admin account is NEVER exposed to the recipient
    //  - The caption from the upstream source is stripped completely
    //  - The message appears directly from the Bot with clean UI
    try {
        const botChannelEntity = await botClient.getEntity(backupPeer);
        const msgs = await botClient.getMessages(botChannelEntity, { ids: [channelMessageId] });

        if (msgs && msgs[0] && msgs[0].media) {
            const userMsg = await botClient.sendFile(userChatId, {
                file: msgs[0].media,
                caption: "" // Caption stripped completely
            });
            console.log(`[Delivery] Successfully sent file ${fileId} to user ${userChatId} via Bot from channel (caption stripped, zero admin exposure).`);
            return userMsg;
        } else {
            throw new Error(`Message ${channelMessageId} in backup channel has no valid media.`);
        }
    } catch (botErr) {
        console.error("[Delivery] Failed to deliver file via Bot from channel:", botErr.message);
        throw botErr;
    }
}
