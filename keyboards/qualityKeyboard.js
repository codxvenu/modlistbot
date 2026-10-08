import { Button } from "telegram/tl/custom/button.js";
import { ACTIONS } from "../constants/actions.js";

/**
 * Build inline keyboard for movie qualities
 * @param {string} searchId
 * @param {Array} qualities
 * @param {Object} [options]
 * @param {boolean} [options.showBackToSeasons]
 */
export function buildQualityKeyboard(searchId, qualities, { showBackToSeasons = false } = {}) {
    const buttonRows = [];

    qualities.forEach((q, i) => {
        const qualityId = q.id !== undefined ? q.id : i;
        buttonRows.push([
            Button.inline(
                `📹 ${q.label}`,
                Buffer.from(`${ACTIONS.SELECT_QUALITY}:${searchId}:${qualityId}`)
            )
        ]);
    });

    const backButton = showBackToSeasons
        ? Button.inline("🔙 Back to Seasons", Buffer.from(`${ACTIONS.BACK_TO_SEASONS}:${searchId}`))
        : Button.inline("🔙 Back to Results", Buffer.from(`${ACTIONS.BACK}:${searchId}`));

    buttonRows.push([
        backButton,
        Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))
    ]);

    return buttonRows;
}
