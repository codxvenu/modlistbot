import { Button } from "telegram/tl/custom/button.js";
import { ACTIONS } from "../constants/actions.js";

/**
 * Build inline keyboard for movie qualities
 */
export function buildQualityKeyboard(searchId, qualities) {
    const buttonRows = [];

    qualities.forEach((q, i) => {
        buttonRows.push([
            Button.inline(
                `📹 ${q.label}`,
                Buffer.from(`${ACTIONS.SELECT_QUALITY}:${searchId}:${i}`)
            )
        ]);
    });

    buttonRows.push([
        Button.inline("🔙 Back to Results", Buffer.from(`${ACTIONS.BACK}:${searchId}`)),
        Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))
    ]);

    return buttonRows;
}
