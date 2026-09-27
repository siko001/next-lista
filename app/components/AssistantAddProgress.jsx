"use client";

import {useSyncExternalStore} from "react";
import {X} from "lucide-react";
import {
    dismissAssistantAddJob,
    getAssistantAddJobs,
    subscribeAssistantAddJobs,
} from "../lib/assistantAddJobs";

const EMPTY_JOBS = [];

export default function AssistantAddProgress() {
    const jobs = useSyncExternalStore(
        subscribeAssistantAddJobs,
        getAssistantAddJobs,
        () => EMPTY_JOBS
    );
    const visibleJobs = jobs.filter((job) => job.visible);
    if (!visibleJobs.length) return null;

    return (
        <div className="pointer-events-none fixed left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[9998] flex w-[min(21rem,calc(100vw-1.5rem))] flex-col gap-2 sm:left-5" aria-live="polite">
            {visibleJobs.map((job) => {
                const percent = Math.round(job.done / job.total * 100);
                return (
                    <div key={job.id} role="status" className="pointer-events-auto rounded-xl border border-[var(--ai-chat-border)] bg-[var(--ai-chat)] p-3 text-[var(--ai-chat-text)] shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold">
                                    {job.status === "complete" ? "Items added" : job.status === "error" ? "Adding stopped" : "Adding items…"}
                                </p>
                                <p className="truncate text-xs opacity-75">{job.done} of {job.total} · {job.listName}</p>
                            </div>
                            {job.status === "error" && (
                                <button type="button" aria-label="Dismiss progress" onClick={() => dismissAssistantAddJob(job.id)} className="rounded p-1 hover:bg-blue-600 hover:text-white"><X size={16}/></button>
                            )}
                        </div>
                        <div role="progressbar" aria-label={`Adding items to ${job.listName}`} aria-valuemin={0} aria-valuemax={job.total} aria-valuenow={job.done} className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--ai-chat-border)]">
                            <div className={`h-full rounded-full transition-[width] duration-300 ${job.status === "error" ? "bg-red-500" : job.status === "complete" ? "bg-emerald-500" : "bg-blue-600"}`} style={{width: `${percent}%`}} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
