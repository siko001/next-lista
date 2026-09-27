// Fetch failures can arrive before pagehide during a refresh. Keep their jobs
// resumable, while authentication, validation and storage errors require review.
export function isTemporaryAssistantError(error) {
    if (typeof error?.retryable === "boolean") return error.retryable;
    if (Number.isInteger(error?.status)) {
        return [408, 425, 429].includes(error.status) || error.status >= 500;
    }
    return ["AbortError", "TimeoutError"].includes(error?.name) ||
        /^(Failed to fetch|Failed to load|Load failed|NetworkError when attempting to fetch resource\.?|Network request failed|The network connection was lost\.?|fetch failed)$/i.test(error?.message || "");
}

export function assistantHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}
