import gsap from "gsap";

// Finish the visual exit before React moves/removes the rows. Collapse their
// space too, so neighbouring products move smoothly into the gap.
export function animateProductExit(elements, direction = 1) {
    const rows = Array.from(elements || []).filter(Boolean);
    if (!rows.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        rows.forEach((row) => {
            gsap.killTweensOf(row);
            gsap.set(row, {
                animation: "none",
                height: row.getBoundingClientRect().height,
                overflow: "hidden",
                pointerEvents: "none",
            });
        });
        const stagger = rows.length > 1 ? {amount: 0.12} : 0;
        gsap.timeline({onComplete: resolve, onInterrupt: resolve})
            .to(rows, {
                opacity: 0, y: direction * 10, scale: 0.985,
                duration: 0.18, stagger, ease: "power2.in",
            })
            .to(rows, {
                height: 0, minHeight: 0, borderWidth: 0,
                marginBottom: -8,
                duration: 0.22, stagger, ease: "power2.inOut",
            }, 0.12);
    });
}
