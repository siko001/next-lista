"use client";

import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import {Mic, Square, Volume2, X} from "lucide-react";
import {decryptToken, decodeHtmlEntities, WP_API_BASE} from "../lib/helpers";
import {INGREDIENT_NAME_MAX_LENGTH} from "../lib/config";
import {runAssistantAddJob} from "../lib/assistantAddJobs";

const getListName = (list) => decodeHtmlEntities(
    typeof list.title === "string" ? list.title : list.title?.rendered || `List ${list.id}`
);
const normalize = (value) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const findSpokenList = (spoken, lists) => {
    const answer = normalize(spoken);
    const ordinal = {first: 0, one: 0, second: 1, two: 1, third: 2, three: 2};
    const ordinalMatch = answer.match(/\b(first|one|second|two|third|three)\b/);
    if (ordinalMatch && lists[ordinal[ordinalMatch[1]]]) return lists[ordinal[ordinalMatch[1]]];
    const matches = lists.filter((list) => {
        const name = normalize(getListName(list));
        return answer === name || answer.includes(name);
    });
    return matches.length === 1 ? matches[0] : null;
};

function VoiceItemField({value, onChange, index, count}) {
    const fieldRef = useRef(null);
    useLayoutEffect(() => {
        const field = fieldRef.current;
        if (!field) return;
        field.style.height = "auto";
        field.style.height = `${field.scrollHeight}px`;
    }, [value]);

    return (
        <textarea
            ref={fieldRef}
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={INGREDIENT_NAME_MAX_LENGTH}
            aria-label={`Product ${index + 1} of ${count}`}
            className="block min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-[var(--ai-chat-border)] px-3 py-2 text-base leading-snug ai-chat-input"
        />
    );
}

export default function VoiceListInput({
    context,
    listId,
    token,
    userId,
    userLists,
    getShoppingList,
    createShoppingList,
    showNotification,
    storageKey,
    open,
    onDraftChange,
    onTaskStarted,
}) {
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const disposedRef = useRef(false);
    const requestRef = useRef(null);
    const vadRef = useRef(null);
    const [recording, setRecording] = useState(false);
    const [recordingMode, setRecordingMode] = useState("items");
    const [pausePrompt, setPausePrompt] = useState(false);
    const [busy, setBusy] = useState(false);
    const [items, setItems] = useState([]);
    const [transcript, setTranscript] = useState("");
    const [needsReview, setNeedsReview] = useState(false);
    const [recordingChoice, setRecordingChoice] = useState(false);
    const [destination, setDestination] = useState("");
    const [error, setError] = useState("");
    const [restoredKey, setRestoredKey] = useState(null);

    const stopVad = useCallback(() => {
        const vad = vadRef.current;
        if (!vad) return;
        clearInterval(vad.interval);
        vad.commandController?.abort();
        if (vad.commandRecorder?.state === "recording") vad.commandRecorder.stop();
        vad.audio?.close().catch(() => {});
        vadRef.current = null;
    }, []);

    const stopRecording = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder?.state === "recording" || recorder?.state === "paused") recorder.stop();
    }, []);

    const continueRecording = useCallback(() => {
        const vad = vadRef.current;
        if (vad) {
            vad.promptActive = false;
            vad.lastSpeechAt = Date.now();
            vad.commandController?.abort();
            if (vad.commandRecorder?.state === "recording") vad.commandRecorder.stop();
        }
        if (recorderRef.current?.state === "paused") recorderRef.current.resume();
        setPausePrompt(false);
    }, []);

    useEffect(() => {
        disposedRef.current = false;
        return () => {
            disposedRef.current = true;
            requestRef.current?.abort();
            stopVad();
            if (["recording", "paused"].includes(recorderRef.current?.state)) recorderRef.current.stop();
            streamRef.current?.getTracks().forEach((track) => track.stop());
        };
    }, [stopVad]);

    useEffect(() => {
        if (open) return;
        stopRecording();
        window.speechSynthesis?.cancel();
    }, [open, stopRecording]);

    useEffect(() => {
        if (!storageKey) return;
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
            if (saved && Array.isArray(saved.items) && saved.items.length) {
                setItems(saved.items);
                setTranscript(typeof saved.transcript === "string" ? saved.transcript : "");
                setNeedsReview(Boolean(saved.needsReview));
                setDestination(typeof saved.destination === "string" ? saved.destination : "");
                onDraftChange(true);
            } else {
                onDraftChange(false);
            }
        } catch {
            onDraftChange(false);
        }
        setRestoredKey(storageKey);
    }, [storageKey, onDraftChange]);

    useEffect(() => {
        if (!storageKey || restoredKey !== storageKey) return;
        try {
            if (items.length) {
                localStorage.setItem(storageKey, JSON.stringify({items, transcript, needsReview, destination}));
            } else {
                localStorage.removeItem(storageKey);
            }
        } catch {}
        onDraftChange(items.length > 0);
    }, [storageKey, restoredKey, items, transcript, needsReview, destination, onDraftChange]);

    const authToken = context === "list" ? decryptToken(token) : token;
    const ownedLists = (userLists || []).filter(
        (list) => String(list?.acf?.owner_id) === String(userId)
    );
    const awaitingDestination = items.length > 0 && context !== "list" && ownedLists.length > 1 && !destination;

    const speak = (message, onEnd) => {
        if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
            onEnd?.();
            return;
        }
        window.speechSynthesis.cancel();
        const messageToSpeak = new SpeechSynthesisUtterance(message);
        messageToSpeak.lang = "en-GB";
        messageToSpeak.rate = 0.95;
        if (onEnd) {
            messageToSpeak.onend = onEnd;
            messageToSpeak.onerror = onEnd;
        }
        window.speechSynthesis.speak(messageToSpeak);
    };

    const playTone = (frequency) => {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        try {
            const audio = new AudioContext();
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.frequency.value = frequency;
            oscillator.type = "sine";
            gain.gain.setValueAtTime(0.001, audio.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.14);
            oscillator.connect(gain).connect(audio.destination);
            oscillator.start();
            oscillator.stop(audio.currentTime + 0.15);
            oscillator.onended = () => audio.close();
        } catch {}
    };

    const beginVoiceActivityCheck = (stream, recorder, mode) => {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        try {
            const audio = new AudioContext();
            const source = audio.createMediaStreamSource(stream);
            const analyser = audio.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            const samples = new Float32Array(analyser.fftSize);
            const vad = {
                audio, interval: null, commandRecorder: null, commandController: null,
                commandSpeechFrames: 0, commandLastSpeechAt: 0, commandStartedAt: 0,
                speechFrames: 0, lastSpeechAt: Date.now(),
                promptedAt: 0, promptActive: false, questionSpeaking: false,
            };
            vadRef.current = vad;

            const recordAnswer = () => {
                if (vadRef.current !== vad || recorder.state !== "paused") return;
                try {
                    const types = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
                    const mimeType = types.find((type) => MediaRecorder.isTypeSupported(type));
                    const answerRecorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
                    const answerChunks = [];
                    vad.commandRecorder = answerRecorder;
                    vad.commandSpeechFrames = 0;
                    vad.commandLastSpeechAt = 0;
                    vad.commandStartedAt = Date.now();
                    answerRecorder.ondataavailable = (event) => {
                        if (event.data?.size) answerChunks.push(event.data);
                    };
                    answerRecorder.onstop = async () => {
                        if (vadRef.current !== vad || !vad.promptActive || vad.commandSpeechFrames < 2) return;
                        const blob = new Blob(answerChunks, {type: answerRecorder.mimeType || "audio/webm"});
                        if (!blob.size) return;
                        const controller = new AbortController();
                        vad.commandController = controller;
                        setBusy(true);
                        try {
                            const form = new FormData();
                            form.append("audio", blob, "voice-answer");
                            form.append("mode", "command");
                            const response = await fetch("/api/ai/voice-items", {
                                method: "POST",
                                headers: {Authorization: `Bearer ${authToken}`},
                                body: form,
                                signal: controller.signal,
                            });
                            const data = await response.json();
                            if (!response.ok) throw new Error(data.error || "Could not understand the answer.");
                            if (vadRef.current !== vad || !vad.promptActive) return;
                            const phrase = normalize(data.transcript);
                            if (/^(?:continue|keep going|more|not yet)$/.test(phrase)) {
                                continueRecording();
                            } else if (/^(?:stop|stop recording|that s it|that is it|all done|i m done|done|finished)$/.test(phrase)) {
                                stopRecording();
                            } else {
                                setError("Please say ‘stop’ or ‘continue’, or use a button below.");
                            }
                        } catch (cause) {
                            if (cause.name !== "AbortError" && vadRef.current === vad) {
                                setError("Could not understand the answer. Use Stop or Continue below.");
                            }
                        } finally {
                            if (vadRef.current === vad) vad.commandController = null;
                            if (!disposedRef.current) setBusy(false);
                        }
                    };
                    answerRecorder.start();
                } catch {
                    setError("Voice answer is unavailable. Use Stop or Continue below.");
                }
            };

            vad.interval = setInterval(() => {
                if (vad.questionSpeaking || (recorder.state !== "recording" && vad.commandRecorder?.state !== "recording")) return;
                analyser.getFloatTimeDomainData(samples);
                let power = 0;
                for (const sample of samples) power += sample * sample;
                const level = Math.sqrt(power / samples.length);
                const now = Date.now();
                if (vad.commandRecorder?.state === "recording") {
                    if (level > 0.012) {
                        vad.commandSpeechFrames += 1;
                        vad.commandLastSpeechAt = now;
                    } else if (vad.commandSpeechFrames >= 2 && now - vad.commandLastSpeechAt >= 1200) {
                        vad.commandRecorder.stop();
                    } else if (now - vad.commandStartedAt >= 12000) {
                        vad.commandRecorder.stop();
                    }
                    return;
                }
                if (level > 0.012) {
                    vad.speechFrames += 1;
                    vad.lastSpeechAt = now;
                } else if (
                    mode === "items" && vad.speechFrames >= 2 && !vad.promptActive &&
                    now - vad.lastSpeechAt >= 4000 && now - vad.promptedAt >= 12000
                ) {
                    vad.promptActive = true;
                    vad.promptedAt = now;
                    vad.questionSpeaking = true;
                    setPausePrompt(true);
                    recorder.pause();
                    speak("Are you finished? Say stop, or continue adding items.", () => {
                        if (vadRef.current !== vad || recorder.state !== "paused") return;
                        vad.questionSpeaking = false;
                        vad.lastSpeechAt = Date.now();
                        recordAnswer();
                    });
                }
            }, 200);
        } catch {
            // Recording and the manual Stop control still work without audio analysis.
        }
    };

    const speakDestinationQuestion = () => {
        const names = ownedLists.map((list, index) => `${index + 1}, ${getListName(list)}`).join(". ");
        speak(`Which list should I add these to? ${names}. Say the list name or number.`);
    };

    const startRecording = async (mode = "items", intent = "replace") => {
        setError("");
        if (mode !== "choice") setRecordingChoice(false);
        window.speechSynthesis?.cancel();
        if (!authToken || !userId) {
            setError("Please sign in before adding items by voice.");
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            setError("Voice recording is unavailable in this browser. Try Chrome or Safari over HTTPS.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            }});
            streamRef.current = stream;
            const types = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
            const mimeType = types.find((type) => MediaRecorder.isTypeSupported(type));
            const recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
            chunksRef.current = [];
            recorder.ondataavailable = (event) => {
                if (event.data?.size) chunksRef.current.push(event.data);
            };
            recorder.onerror = () => {
                setError("Recording failed. Please try again.");
                setRecording(false);
                stream.getTracks().forEach((track) => track.stop());
            };
            recorder.onstop = async () => {
                const speechFrames = vadRef.current?.speechFrames;
                stopVad();
                setPausePrompt(false);
                if (disposedRef.current) return;
                setRecording(false);
                stream.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
                playTone(440);
                const blob = new Blob(chunksRef.current, {type: recorder.mimeType || "audio/webm"});
                if (!blob.size) {
                    setError("No audio was recorded. Please try again.");
                    return;
                }
                if (speechFrames !== undefined && speechFrames < 2) {
                    setError("I didn't hear any speech. Please try again.");
                    return;
                }
                setBusy(true);
                let nextRecordingIntent = null;
                try {
                    const form = new FormData();
                    form.append("audio", blob, "shopping-items");
                    form.append("mode", mode);
                    const controller = new AbortController();
                    requestRef.current = controller;
                    const response = await fetch("/api/ai/voice-items", {
                        method: "POST",
                        headers: {Authorization: `Bearer ${authToken}`},
                        body: form,
                        signal: controller.signal,
                    });
                    const data = await response.json();
                    if (disposedRef.current) return;
                    if (!response.ok) throw new Error(data.error || "Voice input failed.");
                    if (mode === "choice") {
                        const answer = normalize(data.transcript);
                        if (/^(?:add more|more|continue|keep going|add to them|additional)$/.test(answer)) {
                            nextRecordingIntent = "append";
                            setRecordingChoice(false);
                        } else if (/^(?:replace|replace items|start over|new items|remove previous)$/.test(answer)) {
                            nextRecordingIntent = "replace";
                            setRecordingChoice(false);
                        } else {
                            setError(`I heard “${data.transcript}”. Please say “add more” or “replace”.`);
                            speak("Please say add more, or replace.");
                        }
                    } else if (mode === "destination") {
                        const matched = findSpokenList(data.transcript, ownedLists);
                        if (matched) {
                            setDestination(String(matched.id));
                            speak(`Okay, ${getListName(matched)}. Check the items, then press Add items.`);
                        } else {
                            setError(`I heard “${data.transcript}”. Please say a list name or choose it below.`);
                            speak("I couldn't match that list. Please say its name again, or choose it below.");
                        }
                    } else {
                        setTranscript((previous) => intent === "append" && previous
                            ? `${previous} ${data.transcript}` : data.transcript);
                        setItems((previous) => intent === "append"
                            ? [...previous, ...data.items.filter((item) => !previous.some(
                                (existing) => normalize(existing) === normalize(item)
                            ))]
                            : data.items);
                        setNeedsReview((previous) => intent === "append"
                            ? previous || Boolean(data.needsReview) : Boolean(data.needsReview));
                        if (intent === "append") speak(`I heard ${data.items.length} more items. Check the complete list before adding.`);
                        else if (ownedLists.length > 1) speakDestinationQuestion();
                        else if (context === "list") speak(`I heard ${data.items.length} items. Check them, then add them to this list.`);
                        else if (ownedLists.length === 1) speak(`I heard ${data.items.length} items. Check them, then add them to ${getListName(ownedLists[0])}.`);
                        else speak(`I heard ${data.items.length} items. Check them, then I will create a shopping list.`);
                    }
                } catch (cause) {
                    if (!disposedRef.current) setError(cause.message || "Voice input failed. Please try again.");
                } finally {
                    requestRef.current = null;
                    if (!disposedRef.current) setBusy(false);
                    if (!disposedRef.current && nextRecordingIntent) startRecording("items", nextRecordingIntent);
                }
            };
            recorderRef.current = recorder;
            // Play the cue before capture begins so Whisper cannot transcribe the cue.
            playTone(880);
            await new Promise((resolve) => setTimeout(resolve, 190));
            if (disposedRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            recorder.start();
            beginVoiceActivityCheck(stream, recorder, mode);
            setRecordingMode(mode);
            setRecording(true);
        } catch {
            setError("Microphone access was denied or unavailable.");
            streamRef.current?.getTracks().forEach((track) => track.stop());
        }
    };

    const saveItems = async () => {
        const cleaned = [...new Map(items
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => [item.toLocaleLowerCase(), item])).values()];
        if (!cleaned.length) {
            setError("Add at least one product name.");
            return;
        }
        if (cleaned.some((item) => item.length > INGREDIENT_NAME_MAX_LENGTH)) {
            setError(`Product names must be ${INGREDIENT_NAME_MAX_LENGTH} characters or fewer.`);
            return;
        }
        setError("");
        setBusy(true);
        try {
            let targetId = context === "list" ? listId : null;
            let targetName = "this list";
            if (context !== "list") {
                // Refresh before deciding, so a list created in another tab is reused.
                const listsResponse = await fetch(
                    `${WP_API_BASE}/custom/v1/shopping-lists-by-owner/${userId}`,
                    {headers: {Authorization: `Bearer ${authToken}`}, cache: "no-store"}
                );
                if (!listsResponse.ok) throw new Error("Could not check your lists. Please try again.");
                const currentLists = await listsResponse.json();
                if (!Array.isArray(currentLists)) throw new Error("Could not check your lists. Please try again.");
                const currentOwned = currentLists.filter(
                    (list) => String(list?.acf?.owner_id) === String(userId)
                );
                if (currentOwned.length > 1 && !destination) {
                    setError("Choose which list to add these items to.");
                    return;
                }
                const selected = currentOwned.find((list) => String(list.id) === destination)
                    || (currentOwned.length === 1 ? currentOwned[0] : null);
                if (selected) {
                    targetId = selected.id;
                    targetName = getListName(selected);
                } else if (currentOwned.length === 0) {
                    const created = await createShoppingList({
                        name: "Shopping list",
                        userId,
                        token: authToken,
                    });
                    targetId = created?.id || created?.list?.id;
                    if (!targetId) throw new Error("Could not create a shopping list.");
                    targetName = "Shopping list";
                    await getShoppingList(userId, authToken);
                } else {
                    setError("That list is no longer available. Choose another list.");
                    return;
                }
            }
            if (!targetId) throw new Error("No shopping list is available.");
            window.dispatchEvent(new CustomEvent("lista:ai-adding-start"));
            const task = runAssistantAddJob({
                items: cleaned,
                listName: targetName,
                userId,
                listId: targetId,
            });
            // Once accepted, the queue owns the items, including retries.
            try { if (storageKey) localStorage.removeItem(storageKey); } catch {}
            setItems([]);
            setTranscript("");
            setNeedsReview(false);
            setRecordingChoice(false);
            onTaskStarted?.();
            const {done: added} = await task;
            showNotification(`Added ${added} item${added === 1 ? "" : "s"} to ${targetName}`, "success");
        } catch (cause) {
            setError(cause.jobId
                ? "Your progress is saved. Retry the remaining items from the progress card."
                : cause.message || "Could not add the items. Please try again.");
        } finally {
            window.dispatchEvent(new CustomEvent("lista:ai-adding-end"));
            setBusy(false);
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-3 text-sm">
            {recording && <p role="status" className="text-xs">{recordingMode === "destination" ? "Listening for a list name…" : recordingMode === "choice" ? "Say add more or replace…" : "Listening… Speak clearly and pause between items."}</p>}
            {pausePrompt && <div role="status" className="rounded-xl border border-[var(--ai-chat-border)] p-3 text-sm"><p>Finished, or adding more?</p><div className="mt-2 flex gap-2"><button type="button" onClick={stopRecording} className="rounded-lg bg-blue-600 px-3 py-2 text-white">Stop and review</button><button type="button" onClick={continueRecording} className="rounded-lg border border-[var(--ai-chat-border)] px-3 py-2">Continue</button></div></div>}
            {busy && <p role="status" className="text-xs">Processing your items…</p>}
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            {recordingChoice && (
                <div role="group" aria-label="How to use the next recording" className="space-y-2 rounded border border-[var(--ai-chat-border)] p-2">
                    <p className="font-bold">Keep the {items.length} items already heard?</p>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => startRecording("items", "append")} className="rounded bg-blue-600 px-2 py-1 text-white">Add more</button>
                        <button type="button" onClick={() => startRecording("items", "replace")} className="rounded border px-2 py-1">Replace items</button>
                        <button type="button" onClick={() => {setRecordingChoice(false); window.speechSynthesis?.cancel();}} className="rounded border px-2 py-1">Cancel</button>
                    </div>
                </div>
            )}
            {items.length > 0 && (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <details className="shrink-0 text-xs ai-chat-help-text">
                        <summary className="cursor-pointer">Show transcript</summary>
                        <p className="mt-1 whitespace-pre-wrap break-words">{transcript}</p>
                    </details>
                    {needsReview && <p className="text-xs text-amber-600">The item names need an extra check. Please separate or correct them below.</p>}
                    <p role="status" className="shrink-0 text-sm font-bold">{items.length} item{items.length === 1 ? "" : "s"} ready · Scroll to review all</p>
                    <div
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-3 pr-1"
                        data-lenis-prevent
                        style={{touchAction: "pan-y", WebkitOverflowScrolling: "touch"}}
                        onWheelCapture={(event) => event.stopPropagation()}
                        onTouchMoveCapture={(event) => event.stopPropagation()}
                    >
                        {items.map((item, index) => (
                            <div key={index} className="flex items-center gap-3 rounded-xl border border-[var(--ai-chat-border)] bg-[var(--ai-chat-message-bg)] p-2">
                                <span className="w-6 shrink-0 text-center text-sm font-bold">{index + 1}.</span>
                                <VoiceItemField
                                    value={item}
                                    onChange={(nextValue) => setItems((previous) => previous.map(
                                        (value, position) => position === index ? nextValue : value
                                    ))}
                                    index={index}
                                    count={items.length}
                                />
                                <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-blue-600 hover:text-white" aria-label={`Remove product ${index + 1}`} onClick={() => setItems((previous) => previous.filter((_, position) => position !== index))}>
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => setItems((previous) => [...previous, ""])} className="w-full rounded-xl border border-dashed border-[var(--ai-chat-border)] px-3 py-3 text-left text-sm">+ Add another item</button>
                    </div>
                    {context !== "list" && ownedLists.length > 1 && (
                        <div className="shrink-0 space-y-2">
                            <label className="block text-xs font-bold">
                                Which list?
                                <select value={destination} onChange={(event) => setDestination(event.target.value)} className="mt-1 w-full rounded border px-2 py-2 ai-chat-input">
                                    <option value="">Choose a list</option>
                                    {ownedLists.map((list) => <option key={list.id} value={list.id}>{getListName(list)}</option>)}
                                </select>
                            </label>
                            <div className="flex gap-2">
                                <button type="button" onClick={speakDestinationQuestion} className="flex items-center gap-1 rounded border px-2 py-1 text-xs"><Volume2 size={14} /> Hear question</button>
                            </div>
                        </div>
                    )}
                    {context !== "list" && ownedLists.length === 0 && <p className="text-xs">A new “Shopping list” will be created.</p>}
                </div>
            )}
            <div className="mt-auto shrink-0 space-y-2 border-t border-[var(--ai-chat-border)] bg-[var(--ai-chat)] pt-3">
                <div>
                    <strong className="text-base">{awaitingDestination ? "Which list?" : "Speak shopping items"}</strong>
                    <p className="text-sm ai-chat-help-text">{recordingChoice ? "Say add more or replace, or choose below." : awaitingDestination ? "Say the list name or number, or choose it above." : "Say items one after another, then stop to review."}</p>
                </div>
                {items.length > 0 && (
                    <div className="flex gap-2">
                        <button type="button" disabled={busy || (context !== "list" && ownedLists.length > 1 && !destination)} onClick={saveItems} className="flex-1 rounded-xl border border-blue-600 px-3 py-3 font-bold text-blue-500 disabled:opacity-50">Add items</button>
                        <button type="button" onClick={() => {setItems([]); setTranscript(""); setNeedsReview(false); setRecordingChoice(false); setError(""); window.speechSynthesis?.cancel();}} className="rounded-xl border border-[var(--ai-chat-border)] px-3 py-3">Cancel</button>
                    </div>
                )}
                <button
                    type="button"
                    onClick={recording ? () => recorderRef.current?.stop() : () => {
                        if (recordingChoice) {
                            startRecording("choice");
                        } else if (awaitingDestination) {
                            startRecording("destination");
                        } else if (items.length > 0) {
                            setRecordingChoice(true);
                            speak(`You have ${items.length} items. Should I add more items or replace them?`);
                        } else {
                            startRecording("items");
                        }
                    }}
                    disabled={busy}
                    aria-label={recording ? "Stop recording" : recordingChoice ? "Answer add more or replace by voice" : awaitingDestination ? "Answer which list by voice" : "Start voice input"}
                    aria-pressed={recording}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-4 text-base font-bold text-white disabled:opacity-50"
                >
                    {recording ? <Square size={20} /> : <Mic size={20} />}
                    {recording ? "Stop recording" : recordingChoice || awaitingDestination ? "Answer by voice" : "Speak items"}
                </button>
            </div>
        </div>
    );
}
