import Lenis from "lenis";

// Use the same wheel response for pages and contained product lists.
export function createSmoothScroller(options = {}) {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let direction = 0;
    const instance = new Lenis({
        smoothWheel: !motion.matches,
        lerp: .16,
        syncTouch: false,
        allowNestedScroll: true,
        ...options,
        virtualScroll: ({deltaY, event}) => {
            const prevented = event.target?.closest?.("[data-lenis-prevent]");
            if (!event.type.includes("wheel") || event.ctrlKey || event.lenisStopPropagation || !deltaY || (prevented && prevented !== options.wrapper)) return;
            // Measure the current content, including rows revealed by animations.
            // Unlike instance.resize(), this preserves the active scroll momentum.
            instance.dimensions.resize();
            const nextDirection = Math.sign(deltaY);
            if (direction && nextDirection !== direction) {
                instance.scrollTo(instance.actualScroll, {immediate: true});
            }
            direction = nextDirection;
        },
    });
    const updateMotion = () => {
        instance.scrollTo(instance.actualScroll, {immediate: true});
        instance.options.smoothWheel = !motion.matches;
    };
    motion.addEventListener("change", updateMotion);
    let frame;
    const raf = (time) => {
        instance.raf(time);
        frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return {
        instance,
        destroy() {
            cancelAnimationFrame(frame);
            motion.removeEventListener("change", updateMotion);
            instance.destroy();
        },
    };
}
