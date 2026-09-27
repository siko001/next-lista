"use client";

import {useEffect, useRef} from "react";
import {nearbyWindowConnections, drawWindowGlow} from "../lib/windowGlow.mjs";
import {createWindowGlowMotion} from "../lib/windowGlowMotion.mjs";

export default function WindowGlow() {
    const canvasRef = useRef(null);
    useEffect(() => {
        if (typeof BroadcastChannel === "undefined") return;
        const desktop = window.matchMedia("(hover: hover) and (pointer: fine)");
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        let stop = () => {};
        const start = () => {
            stop();
            if (!desktop.matches || reducedMotion.matches || document.visibilityState !== "visible") return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            const channel = new BroadcastChannel("lista-window-glow-v1");
            const peers = new Map();
            let frame = null;
            let painted = false;
            let own;
            let pendingPointer = null;
            const motion = createWindowGlowMotion();
            const now = () => performance.timeOrigin + performance.now();
            const measure = () => {
                // Browsers expose the outer window position, not viewport origin.
                // Account for normal desktop borders and the top browser toolbar.
                const border = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
                return {id, visible: true, x: window.screenX + border,
                    y: window.screenY + Math.max(0, window.outerHeight - window.innerHeight - border),
                    w: window.innerWidth, h: window.innerHeight};
            };
            const announce = (hello = false) => {
                own = measure();
                channel.postMessage({kind: hello ? "hello" : "position", window: own, pointer: motion.getPointer()});
            };
            const removePeer = (peerId) => {
                peers.delete(peerId);
                if (motion.getPointer()?.id === peerId) motion.setPointer({id: peerId, point: null, at: now()});
            };
            const nearby = (at) => {
                for (const [peerId, peer] of peers) if (Date.now() - peer.seen > 5000) removePeer(peerId);
                motion.setWindows([own, ...[...peers.values()].map((peer) => peer.window)], at);
                return nearbyWindowConnections(motion.getWindows(at));
            };
            const draw = (timestamp) => {
                frame = null;
                const at = performance.timeOrigin + timestamp;
                if (pendingPointer) {
                    motion.setPointer(pendingPointer);
                    channel.postMessage({kind: "pointer", pointer: pendingPointer});
                    pendingPointer = null;
                }
                const position = measure();
                const moved = ["x", "y", "w", "h"].some((key) => position[key] !== own[key]);
                own = position;
                // Moving windows need frame-by-frame positions; the slower
                // heartbeat is only for discovery and keeping idle peers alive.
                if (moved) channel.postMessage({kind: "position", window: own});
                const connections = nearby(at);
                if (!connections.length) {
                    if (painted) ctx.clearRect(0, 0, canvas.width, canvas.height);
                    painted = false;
                    // Keep tracking known distant windows as they move closer,
                    // without spending time painting an empty canvas.
                    if (peers.size) frame = requestAnimationFrame(draw);
                    return;
                }
                // Soft blurred artwork needs no Retina backing resolution.
                // One canvas pixel per CSS pixel cuts Retina raster work by 4x.
                const width = Math.round(own.w), height = Math.round(own.h);
                if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
                ctx.clearRect(0, 0, own.w, own.h);
                // Paint at the display's refresh rate with a shared, smooth clock.
                const time = at / 1000;
                for (const pair of connections) drawWindowGlow(ctx, own, pair, time);
                painted = true;
                frame = requestAnimationFrame(draw);
            };
            const wake = () => { if (frame === null && peers.size) frame = requestAnimationFrame(draw); };
            const movePointer = (event) => {
                if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
                const view = measure();
                pendingPointer = {id, point: {x: view.x + event.clientX, y: view.y + event.clientY}, at: now()};
                wake();
            };
            const releasePointer = () => {
                pendingPointer = null;
                const event = {id, point: null, at: now()};
                if (motion.setPointer(event)) {
                    channel.postMessage({kind: "pointer", pointer: event});
                }
                wake();
            };
            window.addEventListener("pointermove", movePointer, {passive: true, capture: true});
            // Accept mouse events too, including those delivered to an unfocused
            // exposed window. Both event streams are coalesced into one frame.
            window.addEventListener("mousemove", movePointer, {passive: true, capture: true});
            document.documentElement.addEventListener("pointerleave", releasePointer);
            document.documentElement.addEventListener("mouseleave", releasePointer);
            window.addEventListener("blur", releasePointer);
            channel.onmessage = ({data}) => {
                if (data?.kind === "leave") { removePeer(data.id); return; }
                if (data?.kind === "pointer") { motion.setPointer(data.pointer); wake(); return; }
                if (!["hello", "position"].includes(data?.kind) || !data.window?.id || data.window.id === id) return;
                peers.set(data.window.id, {window: data.window, seen: Date.now()});
                motion.setPointer(data.pointer);
                if (data.kind === "hello") announce();
                wake();
            };
            announce(true);
            const heartbeat = setInterval(() => { announce(); wake(); }, 200);
            stop = () => {
                clearInterval(heartbeat);
                if (frame !== null) cancelAnimationFrame(frame);
                window.removeEventListener("pointermove", movePointer, true);
                window.removeEventListener("mousemove", movePointer, true);
                document.documentElement.removeEventListener("pointerleave", releasePointer);
                document.documentElement.removeEventListener("mouseleave", releasePointer);
                window.removeEventListener("blur", releasePointer);
                channel.postMessage({kind: "leave", id});
                channel.close();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                stop = () => {};
            };
        };
        const pause = () => stop();
        desktop.addEventListener("change", start);
        reducedMotion.addEventListener("change", start);
        document.addEventListener("visibilitychange", start);
        window.addEventListener("pagehide", pause);
        window.addEventListener("pageshow", start);
        start();
        return () => {
            stop();
            desktop.removeEventListener("change", start);
            reducedMotion.removeEventListener("change", start);
            document.removeEventListener("visibilitychange", start);
            window.removeEventListener("pagehide", pause);
            window.removeEventListener("pageshow", start);
        };
    }, []);
    return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9990] h-full w-full" />;
}
