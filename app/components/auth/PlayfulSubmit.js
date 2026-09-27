"use client";

import {useEffect, useRef} from "react";
import {gsap} from "gsap";
import {ArrowRight, Check} from "lucide-react";

export default function PlayfulSubmit({valid, busy, children, pendingLabel}) {
    const buttonRef = useRef(null);
    const dodgeRef = useRef(null);
    const reset = () => {
        if (!buttonRef.current) return;
        gsap.to(buttonRef.current, {x: 0, y: 0, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : .3, overwrite: true, ease: "power2.out"});
    };

    useEffect(() => {
        const button = buttonRef.current;
        if (!button) return;
        reset();
        if (valid || busy) return () => gsap.killTweensOf(button);
        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const mouse = window.matchMedia("(hover: hover) and (pointer: fine)");
        const position = {x: 0, y: 0};
        const velocity = {x: 0, y: 0};
        const target = {x: 0, y: 0};
        let bounds = null;
        const setX = gsap.quickSetter(button, "x", "px");
        const setY = gsap.quickSetter(button, "y", "px");
        // A damped spring preserves velocity when the pointer changes direction.
        const glide = (_time, deltaTime) => {
            if (!bounds) return;
            const dt = Math.min(deltaTime / 1000, 1 / 30);
            for (const axis of ["x", "y"]) {
                velocity[axis] += ((target[axis] - position[axis]) * 100 - velocity[axis] * 20) * dt;
                position[axis] += velocity[axis] * dt;
                const clamped = gsap.utils.clamp(bounds[axis][0], bounds[axis][1], position[axis]);
                if (clamped !== position[axis]) velocity[axis] = 0;
                position[axis] = clamped;
            }
            setX(position.x);
            setY(position.y);
        };
        const returnHome = () => {
            target.x = target.y = 0;
            // Scrolling keeps the current position and velocity; the spring
            // gently brings the button home instead of snapping its transform.
            if (motion.matches) {
                bounds = null;
                gsap.set(button, {x: 0, y: 0});
            }
        };
        gsap.ticker.add(glide);
        const dodge = (event) => {
            if (event.pointerType !== "mouse" || motion.matches || !mouse.matches || document.activeElement === button) return;
            const rect = button.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = cx - event.clientX;
            const dy = cy - event.clientY;
            const distance = Math.hypot(dx, dy);
            if (distance > Math.max(160, rect.width / 2 + 75)) return;
            const currentX = Number(gsap.getProperty(button, "x")) || 0;
            const currentY = Number(gsap.getProperty(button, "y")) || 0;
            const originX = rect.left - currentX;
            const originY = rect.top - currentY;
            // It may glide across the form, but only settle in unobstructed space.
            if (originY < 12 || originY + rect.height > window.innerHeight - 12) return;
            const maxLeft = Math.max(12, window.innerWidth - rect.width - 12);
            const maxTop = Math.max(12, window.innerHeight - rect.height - 12);
            const clampX = gsap.utils.clamp(12, maxLeft);
            const clampY = gsap.utils.clamp(12, maxTop);
            const leap = 230;
            // Try the direction away from the pointer first. At an edge, choose
            // another escape route rather than leaving the button trapped there.
            const obstacles = [...button.closest(".auth-card").querySelectorAll(".auth-field, .auth-forgot, .auth-switch")].map(element => element.getBoundingClientRect());
            const isClear = ([x, y]) => obstacles.every(box =>
                x + rect.width + 12 <= box.left || x >= box.right + 12 ||
                y + rect.height + 12 <= box.top || y >= box.bottom + 12
            );
            const candidates = [
                [rect.left + (distance ? dx / distance : 1) * leap, rect.top + (distance ? dy / distance : -1) * leap],
                [rect.left - leap, rect.top], [rect.left + leap, rect.top],
                [rect.left, rect.top - leap], [rect.left, rect.top + leap],
                [12, rect.top], [maxLeft, rect.top],
                [12, 12], [maxLeft, 12], [12, maxTop], [maxLeft, maxTop],
                [originX, originY],
                ...obstacles.flatMap(box => [
                    [box.left - rect.width - 16, rect.top], [box.right + 16, rect.top],
                    [rect.left, box.top - rect.height - 16], [rect.left, box.bottom + 16],
                ]),
            ].map(([x, y]) => [clampX(x), clampY(y)]).filter(isClear);
            if (!candidates.length) return;
            const score = ([x, y]) => {
                const pointerDistance = Math.hypot(x + rect.width / 2 - event.clientX, y + rect.height / 2 - event.clientY);
                const travelDistance = Math.hypot(x - rect.left, y - rect.top);
                return Math.min(pointerDistance, 340) - Math.max(0, travelDistance - leap) * .6;
            };
            const destination = candidates.reduce((best, candidate) => score(candidate) > score(best) ? candidate : best);
            gsap.killTweensOf(button);
            position.x = currentX;
            position.y = currentY;
            bounds = {x: [12 - originX, maxLeft - originX], y: [12 - originY, maxTop - originY]};
            target.x = destination[0] - originX;
            target.y = destination[1] - originY;
        };
        const focusReset = () => returnHome();
        button.addEventListener("focus", focusReset);
        dodgeRef.current = dodge;
        window.addEventListener("pointermove", dodge);
        window.addEventListener("scroll", returnHome, {passive: true});
        window.addEventListener("resize", returnHome);
        motion.addEventListener("change", returnHome);
        return () => {
            button.removeEventListener("focus", focusReset);
            dodgeRef.current = null;
            window.removeEventListener("pointermove", dodge);
            window.removeEventListener("scroll", returnHome);
            window.removeEventListener("resize", returnHome);
            motion.removeEventListener("change", returnHome);
            gsap.ticker.remove(glide);
            gsap.killTweensOf(button);
        };
    }, [valid, busy]);

    return (
        <div className={`auth-submit-area ${valid ? "is-ready" : ""} ${busy ? "is-pending" : ""}`}>
            <div className="auth-button-arena">
                <button ref={buttonRef} className="app-primary-action auth-submit" type="submit" disabled={busy}
                    onPointerDown={(event) => {
                        if (!valid && !busy && event.pointerType === "mouse" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                            event.preventDefault();
                            dodgeRef.current?.(event);
                        }
                    }}>
                    {busy ? pendingLabel : children}{valid ? <Check size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
                </button>
            </div>
            <p className="auth-playful-hint">{busy ? "Just a moment…" : valid ? "All set. Let’s go!" : <><span className="auth-mouse-hint">Fill in your details to catch me.</span><span className="auth-touch-hint">Fill in your details and you’re ready to go.</span></>}</p>
        </div>
    );
}
