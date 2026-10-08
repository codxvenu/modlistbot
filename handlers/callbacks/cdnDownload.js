import { Button } from "telegram/tl/custom/button.js";
import { answerCallback } from "../../utils/callbackHelper.js";
import { extractLinks, resolveDirectCdnLink } from "../../scraper.js";
import { cleanMovieTitle, escapeHtml } from "../../utils/formatters.js";
import { MESSAGES } from "../../constants/messages.js";
import { ACTIONS } from "../../constants/actions.js";

/**
 * Handle Instant Download (CDN link) callback: dl_cdn:<searchId>:<qualityIndex>
 */
export async function handleCdnDownloadCallback(botClient, event, session, searchId, parts, chatId, messageId) {
    await answerCallback(botClient, event);
    const qualityIndex = parseInt(parts[2], 10);
    const quality = session.qualities[qualityIndex];
    const movie = session.selectedMovie;

    if (!quality || !movie) return;

    const cleanTitle = cleanMovieTitle(movie.title);
    const escapedCleanTitle = escapeHtml(cleanTitle);
    const escapedQualityLabel = escapeHtml(quality.label);
    const movieIndex = session.results.indexOf(movie);

    // Retrieve already-extracted link from session or extract fresh if expired
    let links = session.extractedLinks?.[qualityIndex];
    if (!links || !links.cdnLink) {
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.GENERATING_CDN(escapedCleanTitle, escapedQualityLabel)
        });

        try {
            console.log(`[CDN] Extracting fresh instant download link for: ${quality.link}`);
            links = await extractLinks(quality.link);
            if (!session.extractedLinks) session.extractedLinks = {};
            session.extractedLinks[qualityIndex] = links;
        } catch (err) {
            console.error("[CDN] Extraction error:", err);
            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: MESSAGES.DELIVERY_ERROR,
                buttons: botClient.buildReplyMarkup([
                    [
                        Button.inline("🔄 Try Again", Buffer.from(`${ACTIONS.DOWNLOAD_CDN}:${searchId}:${qualityIndex}`))
                    ],
                    [
                        Button.inline("🔙 Back to Qualities", Buffer.from(`${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`))
                    ],
                    [
                        Button.inline("❌ Cancel", Buffer.from(`${ACTIONS.CANCEL}:${searchId}`))
                    ]
                ])
            });
            return;
        }
    }

    let cdnLink = links?.cdnLink || links?.rawCdnLink;
    if (cdnLink && (cdnLink.includes("video-gen.xyz") || cdnLink.includes("video-seed.dev"))) {
        cdnLink = await resolveDirectCdnLink(cdnLink);
        if (links) links.cdnLink = cdnLink;
    }

    if (!cdnLink) {
        await botClient.editMessage(chatId, {
            message: messageId,
            parseMode: "html",
            text: MESSAGES.CDN_NOT_AVAILABLE,
            buttons: botClient.buildReplyMarkup([
                [
                    Button.inline("📁 Telegram File", Buffer.from(`${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}`))
                ],
                [
                    Button.inline("🔙 Back to Qualities", Buffer.from(`${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`))
                ]
            ])
        });
        return;
    }

    // Prepare buttons: Direct File Download URL button + optional Telegram File switch + Back
    const actionButtons = [
        [
            Button.url("⚡ Direct Instant Download", cdnLink)
        ]
    ];

    if (links?.token) {
        actionButtons.push([
            Button.inline("📁 Send to Telegram Instead", Buffer.from(`${ACTIONS.DOWNLOAD_TG}:${searchId}:${qualityIndex}`))
        ]);
    }

    actionButtons.push([
        Button.inline("🔙 Back to Qualities", Buffer.from(`${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`))
    ]);

    // Send ready message with 5-minute expiry warning
    await botClient.editMessage(chatId, {
        message: messageId,
        parseMode: "html",
        text: MESSAGES.CDN_LINK_READY(escapedCleanTitle, escapedQualityLabel),
        buttons: botClient.buildReplyMarkup(actionButtons)
    });

    // 5-minute expiration timer
    setTimeout(async () => {
        try {
            // Invalidate session cached link so "Get Link Again" generates fresh
            if (session.extractedLinks) {
                delete session.extractedLinks[qualityIndex];
            }

            await botClient.editMessage(chatId, {
                message: messageId,
                parseMode: "html",
                text: MESSAGES.CDN_LINK_EXPIRED(escapedCleanTitle, escapedQualityLabel),
                buttons: botClient.buildReplyMarkup([
                    [
                        Button.inline("🔄 Get Link Again", Buffer.from(`${ACTIONS.DOWNLOAD_CDN}:${searchId}:${qualityIndex}`))
                    ],
                    [
                        Button.inline("🔙 Back to Qualities", Buffer.from(`${ACTIONS.SELECT_MOVIE}:${searchId}:${movieIndex}`))
                    ]
                ])
            });
        } catch (expireErr) {
            console.warn("[CDN] Could not update expired message:", expireErr.message);
        }
    }, 5 * 60 * 1000);
}
