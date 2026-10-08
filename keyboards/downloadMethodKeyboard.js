import { Button } from "telegram/tl/custom/button.js";
import { ACTIONS } from "../constants/actions.js";

/**
 * Build inline keyboard for choosing download method: Instant Download vs Telegram File
 * Only displays buttons that are actually available based on extracted links.
 */
export function buildDownloadMethodKeyboard(searchId, qualityIndex, movieIndex, { hasCdn = true, hasTg = true } = {}) {
    const buttonRows = [];
    const optionsRow = [];

    if (hasCdn) {
        optionsRow.push(
            Button.inline("⚡ Instant Download", Buffer.from(`${ACTIONS.DOWNLOAD_CDN}:${searchId}:${qualityIndex}`))
        );
    }
    if (hasTg) {
        optionsRow.push(
            Button.inline("📁 Telegram File", Buffer.from(`${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}`))
        );
    }

    if (optionsRow.length > 0) {
        buttonRows.push(optionsRow);
    }

    buttonRows.push([
        Button.inline("🔙 Back to Qualities", Buffer.from(`${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`)),
        Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))
    ]);

    return buttonRows;
}
