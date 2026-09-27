import test from "node:test";
import assert from "node:assert/strict";
import {assistantHttpError, isTemporaryAssistantError} from "../app/lib/assistantJobErrors.mjs";

test("browser network and navigation failures are temporary", () => {
    for (const message of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "The network connection was lost."]) {
        assert.equal(isTemporaryAssistantError(new TypeError(message)), true, message);
    }
    for (const name of ["AbortError", "TimeoutError"]) {
        assert.equal(isTemporaryAssistantError(Object.assign(new Error("request interrupted"), {name})), true);
    }
});

test("HTTP status distinguishes temporary service failures from permanent rejections", () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
        assert.equal(isTemporaryAssistantError(assistantHttpError(status, "Request failed")), true, String(status));
    }
    for (const status of [400, 401, 403, 404, 422]) {
        assert.equal(isTemporaryAssistantError(assistantHttpError(status, "Request failed")), false, String(status));
    }
});

test("programming, storage, and explicit permanent errors are not automatically retried", () => {
    for (const error of [new TypeError("Cannot read properties of undefined"), new Error("Quota exceeded"), Object.assign(new Error("Failed to fetch"), {retryable: false})]) {
        assert.equal(isTemporaryAssistantError(error), false);
    }
});
