import {advanceGlowSpring, glowPointerTarget} from "./windowGlow.mjs";

const resting = () => ({x: 0, y: 0, vx: 0, vy: 0});

// Every window animates the whole scene from shared cursor events. An anchor
// never depends on its owning window being focused or running an animation loop.
export function createWindowGlowMotion() {
    const anchors = new Map();
    let pointer = null;
    const targetFor = (view) => glowPointerTarget(pointer?.point ? {
        x: pointer.point.x - view.x, y: pointer.point.y - view.y,
    } : null, view.w, view.h);
    const sample = (anchor, at) => advanceGlowSpring(anchor.state, anchor.target,
        Math.max(0, at - anchor.at) / 1000);
    const retarget = (anchor, at) => {
        anchor.state = sample(anchor, at);
        anchor.at = at;
        anchor.target = targetFor(anchor.view);
    };
    return {
        setWindows(views, at) {
            const ids = new Set();
            for (const view of views) {
                if (!view?.visible) continue;
                ids.add(view.id);
                const anchor = anchors.get(view.id);
                if (!anchor) {
                    anchors.set(view.id, {view, state: resting(), target: targetFor(view), at});
                } else {
                    const changed = ["x", "y", "w", "h"].some((key) => view[key] !== anchor.view[key]);
                    anchor.view = view;
                    if (changed) retarget(anchor, at);
                }
            }
            for (const id of anchors.keys()) if (!ids.has(id)) anchors.delete(id);
        },
        setPointer(event) {
            if (!event || typeof event.id !== "string" || !Number.isFinite(event.at)) return false;
            if (event.point !== null && (!Number.isFinite(event.point?.x) || !Number.isFinite(event.point?.y))) return false;
            if (pointer && (event.at < pointer.at || (event.at === pointer.at && event.id <= pointer.id))) return false;
            // A delayed leave/blur from a different window must not cancel the
            // cursor that has already entered the next one.
            if (!event.point && pointer?.id !== event.id) return false;
            pointer = event;
            for (const anchor of anchors.values()) retarget(anchor, event.at);
            return true;
        },
        getPointer: () => pointer,
        getWindows(at) {
            return [...anchors.values()].map((anchor) => {
                const state = sample(anchor, at);
                return {...anchor.view, offsetX: state.x, offsetY: state.y};
            });
        },
    };
}
