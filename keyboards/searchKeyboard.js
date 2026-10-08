import { Button } from "telegram/tl/custom/button.js";
import { cleanMovieTitle } from "../utils/formatters.js";
import { ACTIONS } from "../constants/actions.js";

export const PAGE_SIZE = 5;

/**
 * Build inline keyboard for a results page
 */
export function buildSearchKeyboard(searchId, results, page) {
    const totalPages = Math.ceil(results.length / PAGE_SIZE) || 1;
    const startIndex = page * PAGE_SIZE;
    const pageItems = results.slice(startIndex, startIndex + PAGE_SIZE);

    const buttonRows = [];

    // 1. Movie result buttons
    pageItems.forEach((movie, i) => {
        const absoluteIndex = startIndex + i;
        let titleLabel = cleanMovieTitle(movie.title);
        if (titleLabel.length > 34) {
            titleLabel = titleLabel.substring(0, 31) + "...";
        }
        buttonRows.push([
            Button.inline(
                `${absoluteIndex + 1}. ${titleLabel}`,
                Buffer.from(`${ACTIONS.SELECT_MOVIE}:${searchId}:${absoluteIndex}`)
            )
        ]);
    });

    // 2. Pagination navigation buttons row
    const navRow = [];
    if (page > 0) {
        navRow.push(
            Button.inline(
                "⬅️ Previous",
                Buffer.from(`${ACTIONS.PAGINATION}:${searchId}:${page - 1}`)
            )
        );
    }
    navRow.push(Button.inline(`📄 ${page + 1}/${totalPages}`, Buffer.from(ACTIONS.NOOP)));
    if (startIndex + PAGE_SIZE < results.length) {
        navRow.push(
            Button.inline(
                "Next ➡️",
                Buffer.from(`${ACTIONS.PAGINATION}:${searchId}:${page + 1}`)
            )
        );
    }
    buttonRows.push(navRow);

    // 3. Cancel button row
    buttonRows.push([
        Button.inline("❌ Cancel Search", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))
    ]);

    return buttonRows;
}
