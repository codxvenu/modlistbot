// In-memory search sessions with auto-expiry (30 minutes)
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000;

function cleanupOldSessions() {
    const now = Date.now();
    for (const [id, sess] of sessions.entries()) {
        if (now - sess.createdAt > SESSION_TTL) {
            sessions.delete(id);
        }
    }
}

const cleanupTimer = setInterval(cleanupOldSessions, 5 * 60 * 1000);
if (cleanupTimer.unref) {
    cleanupTimer.unref();
}

/**
 * Create a new user search session
 */
export function createSession(userId, query, results) {
    const searchId = Math.random().toString(36).substring(2, 8);
    sessions.set(searchId, {
        userId: userId.toString(),
        query,
        results,
        page: 0,
        selectedMovie: null,
        qualities: [],
        createdAt: Date.now()
    });
    return searchId;
}

/**
 * Retrieve an existing search session
 */
export function getSession(searchId) {
    return sessions.get(searchId);
}

/**
 * Delete a search session
 */
export function deleteSession(searchId) {
    return sessions.delete(searchId);
}
