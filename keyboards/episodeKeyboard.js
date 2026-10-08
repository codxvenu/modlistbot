import { Button } from "telegram/tl/custom/button.js";
import { ACTIONS } from "../constants/actions.js";

/**
 * Build inline keyboard for episode selection
 * @param {string} searchId
 * @param {number} qualityId
 * @param {Array<{ episodeNumber: number, shortLabel: string, label: string }>} episodes
 */
export function buildEpisodeKeyboard(searchId, qualityId, episodes) {
    const buttonRows = [];
    const rowSize = 4;

    for (let i = 0; i < episodes.length; i += rowSize) {
        const row = episodes.slice(i, i + rowSize).map((ep, idx) => {
            const actualIndex = i + idx;
            return Button.inline(
                ep.shortLabel || `Ep ${ep.episodeNumber}`,
                Buffer.from(`${ACTIONS.SELECT_EPISODE}:${searchId}:${qualityId}:${actualIndex}`)
            );
        });
        buttonRows.push(row);
    }

    buttonRows.push([
        Button.inline("🔙 Back to Options", Buffer.from(`${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityId}`)),
        Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))
    ]);

    return buttonRows;
}
