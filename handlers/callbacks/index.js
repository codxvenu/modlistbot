import { ACTIONS } from "../../constants/actions.js";
import { MESSAGES } from "../../constants/messages.js";
import { getSession } from "../../state/searchSessions.js";
import { answerCallback } from "../../utils/callbackHelper.js";

import { handleHelpCallback } from "./helpCallback.js";
import { handleStatusCallback } from "./statusCallback.js";
import { handlePaginationCallback } from "./pagination.js";
import { handleMovieSelectCallback } from "./movieSelect.js";
import { handleQualitySelectCallback } from "./qualitySelect.js";
import { handleCdnDownloadCallback } from "./cdnDownload.js";
import { handleTgDownloadCallback } from "./tgDownload.js";
import { handleBackCallback } from "./back.js";
import { handleCancelCallback } from "./cancel.js";

/**
 * Route incoming callback queries from inline buttons
 */
export async function routeCallback(botClient, event) {
    const rawData = event.data?.toString() || "";
    if (!rawData || rawData === ACTIONS.NOOP) {
        await answerCallback(botClient, event);
        return;
    }

    const chatId = event.chatId || event.senderId;
    const messageId = event.messageId;

    try {
        // 1. Static buttons
        if (rawData === ACTIONS.HELP) {
            return await handleHelpCallback(botClient, event, chatId);
        }

        if (rawData === ACTIONS.STATUS) {
            return await handleStatusCallback(botClient, event, chatId);
        }

        // 2. Session-based dynamic actions
        const parts = rawData.split(":");
        const action = parts[0];
        const searchId = parts[1];

        const session = getSession(searchId);
        if (!session && [
            ACTIONS.PAGINATION,
            ACTIONS.SELECT_MOVIE,
            ACTIONS.SELECT_QUALITY,
            ACTIONS.DOWNLOAD_CDN,
            ACTIONS.DOWNLOAD_TG,
            ACTIONS.BACK,
            ACTIONS.CANCEL
        ].includes(action)) {
            await answerCallback(botClient, event, { message: "Session expired" });
            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: MESSAGES.SESSION_EXPIRED
            });
            return;
        }

        switch (action) {
            case ACTIONS.PAGINATION:
                return await handlePaginationCallback(botClient, event, session, searchId, parts, chatId, messageId);

            case ACTIONS.SELECT_MOVIE:
                return await handleMovieSelectCallback(botClient, event, session, searchId, parts, chatId, messageId);

            case ACTIONS.SELECT_QUALITY:
                return await handleQualitySelectCallback(botClient, event, session, searchId, parts, chatId, messageId);

            case ACTIONS.DOWNLOAD_CDN:
                return await handleCdnDownloadCallback(botClient, event, session, searchId, parts, chatId, messageId);

            case ACTIONS.DOWNLOAD_TG:
                return await handleTgDownloadCallback(botClient, event, session, searchId, parts, chatId, messageId);

            case ACTIONS.BACK:
                return await handleBackCallback(botClient, event, session, searchId, chatId, messageId);

            case ACTIONS.CANCEL:
                return await handleCancelCallback(botClient, event, searchId, chatId, messageId);

            default:
                await answerCallback(botClient, event);
        }
    } catch (handlerErr) {
        console.error("Callback handler error:", handlerErr);
    }
}
