import { Button } from "telegram/tl/custom/button.js";
import { ACTIONS } from "../constants/actions.js";

/**
 * Build inline keyboard for choosing download method: Instant Download vs Telegram File
 * Only displays buttons that are actually available based on extracted links.
 * Supports movies, series batch files, and individual episodes.
 */
export function buildDownloadMethodKeyboard(searchId, qualityIndex, movieIndex, { hasCdn = true, hasTg = true, episodeIndex = null, isSeriesBatch = false } = {}) {
    const buttonRows = [];
    const optionsRow = [];

    const cdnPayload = episodeIndex !== null
        ? `${ACTIONS.DOWNLOAD_CDN}:${searchId}:${qualityIndex}:${episodeIndex}`
        : `${ACTIONS.DOWNLOAD_CDN}:${searchId}:${qualityIndex}`;

    const tgPayload = episodeIndex !== null
        ? `${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}:${episodeIndex}`
        : `${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}`;

    if (hasCdn) {
        optionsRow.push(
            Button.inline("⚡ Instant Download", Buffer.from(cdnPayload))
        );
    }
    if (hasTg) {
        optionsRow.push(
            Button.inline("📁 Telegram File", Buffer.from(tgPayload))
        );
    }

    if (optionsRow.length > 0) {
        buttonRows.push(optionsRow);
    }

    let backBtn;
    if (episodeIndex !== null) {
        backBtn = Button.inline("🔙 Back to Episodes", Buffer.from(`${ACTIONS.SELECT_SERIES_EPISODES}:${searchId}:${qualityIndex}`));
    } else if (isSeriesBatch) {
        backBtn = Button.inline("🔙 Back to Options", Buffer.from(`${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityIndex}`));
    } else {
        backBtn = Button.inline("🔙 Back to Qualities", Buffer.from(`${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`));
    }

    buttonRows.push([
        backBtn,
        Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))
    ]);

    return buttonRows;
}
