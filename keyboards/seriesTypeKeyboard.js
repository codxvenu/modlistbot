import { Button } from "telegram/tl/custom/button.js";
import { ACTIONS } from "../constants/actions.js";

/**
 * Build inline keyboard for choosing between Full Season Batch vs Individual Episodes
 * @param {string} searchId
 * @param {number} qualityId
 * @param {Object} options
 */
export function buildSeriesTypeKeyboard(searchId, qualityId, { hasBatch = true, hasEpisodes = true, season = null } = {}) {
    const buttonRows = [];

    if (hasBatch) {
        buttonRows.push([
            Button.inline("📦 Full Season (Zip / Batch)", Buffer.from(`${ACTIONS.SELECT_SERIES_BATCH}:${searchId}:${qualityId}`))
        ]);
    }
    if (hasEpisodes) {
        buttonRows.push([
            Button.inline("🎬 Individual Episodes", Buffer.from(`${ACTIONS.SELECT_SERIES_EPISODES}:${searchId}:${qualityId}`))
        ]);
    }

    const backAction = season !== null ? `${ACTIONS.SELECT_SEASON}:${searchId}:${season}` : `${ACTIONS.BACK}:${searchId}`;
    buttonRows.push([
        Button.inline("🔙 Back to Qualities", Buffer.from(backAction)),
        Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))
    ]);

    return buttonRows;
}
