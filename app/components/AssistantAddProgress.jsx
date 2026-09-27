"use client";

import {useEffect, useRef, useState, useSyncExternalStore} from "react";
import {X} from "lucide-react";
import {
    dismissAssistantAddJob,
    retryAssistantAddJob,
    setAssistantAddSession,
    syncAssistantAddJobs,
    getAssistantAddJobs,
    subscribeAssistantAddJobs,
} from "../lib/assistantAddJobs";

import {useUserContext} from "../contexts/UserContext";

const EMPTY_JOBS = [];

export default function AssistantAddProgress() {
    const {userData, token, loading, error} = useUserContext();
    const [storageError, setStorageError] = useState("");
    useEffect(() => {
        const activate = () => {
            try {
                setAssistantAddSession(!loading && !error && userData?.id && token
                    ? {userId: userData.id, token} : null);
                setStorageError("");
            } catch {
                setStorageError("Enable browser storage to keep adding jobs after a refresh.");
            }
        };
        // Navigation aborts must leave a running checkpoint for the next page,
        // rather than turning the interrupted request into a permanent error.
        const pause = () => setAssistantAddSession(null);
        activate();
        window.addEventListener("pagehide", pause);
        window.addEventListener("pageshow", activate);
        return () => {
            window.removeEventListener("pagehide", pause);
            window.removeEventListener("pageshow", activate);
            pause();
        };
    }, [userData?.id, token, loading, error]);
    useEffect(() => {
        const sync = (event) => {
            if (event.type === "storage" && event.key && !event.key.startsWith("lista:assistant-add:v1:")) return;
            try { syncAssistantAddJobs({retryNow: event.type === "online"}); } catch { /* Storage may be disabled. */ }
        };
        window.addEventListener("storage", sync);
        window.addEventListener("online", sync);
        return () => {
            window.removeEventListener("storage", sync);
            window.removeEventListener("online", sync);
        };
    }, []);
    const jobs = useSyncExternalStore(
        subscribeAssistantAddJobs,
        getAssistantAddJobs,
        () => EMPTY_JOBS
    );
    const completionTimers = useRef(new Map());
    useEffect(() => {
        const timers = completionTimers.current;
        const completedIds = new Set(jobs.filter((job) => job.status === "complete").map((job) => job.id));
        for (const [id, timer] of timers) {
            if (!completedIds.has(id)) { clearTimeout(timer); timers.delete(id); }
        }
        for (const id of completedIds) {
            if (timers.has(id)) continue;
            timers.set(id, setTimeout(() => {
                timers.delete(id);
                try { dismissAssistantAddJob(id); } catch { /* Keep the manual dismiss button if storage is unavailable. */ }
            }, 3500));
        }
    }, [jobs]);
    useEffect(() => {
        const timers = completionTimers.current;
        return () => { for (const timer of timers.values()) clearTimeout(timer); timers.clear(); };
    }, []);
    const visibleJobs = jobs.filter((job) => String(job.userId) === String(userData?.id));
    if (!visibleJobs.length && !storageError) return null;

    return (
        <div className="pointer-events-none fixed left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[9998] flex w-[min(21rem,calc(100vw-1.5rem))] flex-col gap-2 sm:left-5" aria-live="polite">
            {storageError && <p role="alert" className="rounded-xl bg-[var(--ai-chat)] p-3 text-sm text-red-600 shadow-xl">{storageError}</p>}
            {visibleJobs.map((job) => {
                const percent = Math.round(job.done / job.total * 100);
                return (
                    <div key={job.id} role="status" className="pointer-events-auto rounded-xl border border-[var(--ai-chat-border)] bg-[var(--ai-chat)] p-3 text-[var(--ai-chat-text)] shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold">
                                    {job.status === "complete" ? "Items added" : job.status === "error" ? "Adding paused" : job.status === "retrying" ? "Reconnecting…" : "Adding items…"}
                                </p>
                                <p className="truncate text-xs opacity-75">{job.done} of {job.total} · {job.listName}</p>
                            </div>
                            {["error", "complete"].includes(job.status) && (
                                <button type="button" aria-label={job.status === "error" ? "Discard remaining items" : "Dismiss progress"} onClick={() => {
                                    try { dismissAssistantAddJob(job.id); } catch { setStorageError("Could not clear saved progress. Please try again."); }
                                }} className="rounded p-1 hover:bg-blue-600 hover:text-white"><X size={16}/></button>
                            )}
                        </div>
                        {job.skipped > 0 && <p className="mt-1 text-xs opacity-75">{job.skipped} already on this list</p>}
                        {job.status === "retrying" && <p className="mt-2 text-xs opacity-75">Progress saved. Continuing automatically when the connection is available.</p>}
                        {job.status === "error" && (
                            <div className="mt-2 text-xs">
                                <p>{job.error}</p>
                                <button type="button" onClick={() => {
                                    try { retryAssistantAddJob(job.id); }
                                    catch { setStorageError("Could not save progress. Check your browser storage and try again."); }
                                }} className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white">Retry remaining items</button>
                            </div>
                        )}
                        <div role="progressbar" aria-label={`Adding items to ${job.listName}`} aria-valuemin={0} aria-valuemax={job.total} aria-valuenow={job.done} className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--ai-chat-border)]">
                            <div className={`h-full rounded-full transition-[width] duration-300 ${job.status === "error" ? "bg-red-500" : job.status === "complete" ? "bg-emerald-500" : "bg-blue-600"}`} style={{width: `${percent}%`}} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
