import { Button } from "telegram/tl/custom/button.js";
import { ACTIONS } from "../constants/actions.js";

/**
 * Build inline keyboard for selecting a series season
 * @param {string} searchId
 * @param {number[]} seasons
 */
export function buildSeasonKeyboard(searchId, seasons) {
    const buttonRows = [];
    const rowSize = 3;

    for (let i = 0; i < seasons.length; i += rowSize) {
        const row = seasons.slice(i, i + rowSize).map(s => 
            Button.inline(`Season ${s}`, Buffer.from(`${ACTIONS.SELECT_SEASON}:${searchId}:${s}`))
        );
        buttonRows.push(row);
    }

    buttonRows.push([
        Button.inline("🔙 Back to Results", Buffer.from(`${ACTIONS.BACK}:${searchId}`)),
        Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))
    ]);

    return buttonRows;
}
