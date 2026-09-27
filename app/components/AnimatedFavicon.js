"use client";
import {useEffect} from "react";

export default function AnimatedFavicon() {
    useEffect(() => {
        const icon = document.getElementById("lista-favicon");
        if (!icon) return;
        // Also clean up any duplicate icon tags left by a development hot reload.
        document.querySelectorAll('#lista-favicon').forEach(node => { if (node !== icon) node.remove(); });
        const motion = matchMedia("(prefers-reduced-motion: reduce)");
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 64;
        const context = canvas.getContext("2d");
        if (!context) return;
        let dark;
        let timer;
        let frameTimer;
        const frames = new Map();
        const staticIcon = () => {
            icon.type = "image/svg+xml";
            icon.href = dark ? "/favicon-dark.svg" : "/favicon-light.svg";
        };
        const draw = (progress) => {
            const ctx = context;
            ctx.clearRect(0, 0, 64, 64);
            ctx.fillStyle = dark ? "#151f2e" : "#f5f8fc";
            ctx.strokeStyle = dark ? "#344255" : "#dce4ee";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(1, 1, 62, 62, 18); ctx.fill(); ctx.stroke();
            ctx.save();
            ctx.translate(32, 36); ctx.rotate(Math.sin(progress * Math.PI * 2) * .07); ctx.translate(-32, -36);
            ctx.lineWidth = 4; ctx.lineCap = "round";
            ctx.strokeStyle = dark ? "#58d9c2" : "#078574";
            ctx.stroke(new Path2D("M24 25v-5a8 8 0 0 1 16 0v5"));
            ctx.fillStyle = dark ? "#21ba9c" : "#159e84";
            ctx.fill(new Path2D("M18 24h28l3 26q0 5-5 5H20q-5 0-5-5Z"));
            ctx.strokeStyle = "white"; ctx.lineWidth = 4.5; ctx.lineJoin = "round";
            ctx.stroke(new Path2D("m24 39 6 6 11-12"));
            ctx.restore();
            ctx.save(); ctx.translate(49, 16);
            const sparkle = 1 + Math.sin(progress * Math.PI) * .12;
            ctx.scale(sparkle, sparkle);
            ctx.fillStyle = dark ? "#6795ff" : "#2456e6";
            ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "white";
            ctx.fill(new Path2D("m0-6 1.8 4.2L6 0 1.8 1.8 0 6-1.8 1.8-6 0-1.8-1.8Z"));
            ctx.restore();
            return canvas.toDataURL("image/png");
        };
        const animate = () => {
            if (motion.matches || document.hidden) return;
            if (!frames.has(dark)) frames.set(dark, Array.from({length: 12}, (_, i) => draw(i / 11)));
            let frame = 0;
            icon.type = "image/png";
            frameTimer = setInterval(() => {
                icon.href = frames.get(dark)[frame++];
                if (frame === 12) {
                    clearInterval(frameTimer);
                    staticIcon();
                    timer = setTimeout(animate, 14000);
                }
            }, 90);
        };
        const sync = () => {
            clearTimeout(timer); clearInterval(frameTimer);
            dark = document.documentElement.classList.contains("dark");
            staticIcon();
            if (!motion.matches && !document.hidden) timer = setTimeout(animate, 3000);
        };
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, {attributes: true, attributeFilter: ["class"]});
        document.addEventListener("visibilitychange", sync);
        motion.addEventListener("change", sync);
        sync();
        return () => {
            observer.disconnect(); clearTimeout(timer); clearInterval(frameTimer);
            document.removeEventListener("visibilitychange", sync);
            motion.removeEventListener("change", sync);
            staticIcon();
        };
    }, []);
    return null;
}
