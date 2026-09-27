export function glowPointerTarget(pointer, width, height) {
    if (!pointer) return {x: 0, y: 0};
    const dx = pointer.x - width / 2, dy = pointer.y - height / 2;
    const distance = Math.hypot(dx, dy);
    // Ease out the attraction between 110 and 220px from the resting anchor.
    // Measuring from rest avoids feedback as the spring follows the cursor.
    const edge = Math.max(0, Math.min(1, (220 - distance) / 110));
    const influence = edge * edge * (3 - 2 * edge);
    const pull = Math.min(48, distance * 0.4) * influence;
    return distance ? {x: dx / distance * pull, y: dy / distance * pull} : {x: 0, y: 0};
}

export function advanceGlowSpring(state, target, seconds) {
    // Analytic damped spring: consistent inertia at different display rates,
    // with a small overshoot rather than a hard stop when the pointer leaves.
    const dt = Math.max(0, seconds);
    const damping = 8.4, frequency = 11.2;
    const decay = Math.exp(-damping * dt);
    const cosine = Math.cos(frequency * dt), sine = Math.sin(frequency * dt);
    const next = {};
    for (const [axis, velocity] of [["x", "vx"], ["y", "vy"]]) {
        const displacement = state[axis] - target[axis];
        const wave = (state[velocity] + damping * displacement) / frequency;
        next[axis] = target[axis] + decay * (displacement * cosine + wave * sine);
        next[velocity] = decay * (state[velocity] * cosine
            - (damping * wave + frequency * displacement) * sine);
        if (Math.abs(next[axis] - target[axis]) < 0.01 && Math.abs(next[velocity]) < 0.05) {
            next[axis] = target[axis];
            next[velocity] = 0;
        }
    }
    return next;
}

export function nearbyWindowPair(a, b, maxGap = 280) {
    if (!a?.visible || !b?.visible || a.id === b.id) return null;
    if (![a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h].every(Number.isFinite)) return null;
    if (Math.min(a.w, a.h, b.w, b.h) < 240) return null;
    const from = {x: a.x + a.w / 2, y: a.y + a.h / 2};
    const to = {x: b.x + b.w / 2, y: b.y + b.h / 2};
    // Identically positioned views are usually tabs in one window.
    if (Math.hypot(from.x - to.x, from.y - to.y) < 40) return null;
    const gapX = Math.max(0, a.x - b.x - b.w, b.x - a.x - a.w);
    const gapY = Math.max(0, a.y - b.y - b.h, b.y - a.y - a.h);
    const gap = Math.hypot(gapX, gapY);
    if (gap > maxGap) return null;
    const offset = (value) => Number.isFinite(value) ? Math.max(-64, Math.min(64, value)) : 0;
    from.x += offset(a.offsetX); from.y += offset(a.offsetY);
    to.x += offset(b.offsetX); to.y += offset(b.offsetY);
    const ordered = a.id < b.id ? [from, to] : [to, from];
    return {from: ordered[0], to: ordered[1], strength: 1 - gap / (maxGap + 100)};
}

export function nearbyWindowConnections(windows) {
    const visible = [...new Map(windows.filter((view) => view?.visible).map((view) => [view.id, view])).values()]
        .sort((a, b) => a.id.localeCompare(b.id));
    const connections = [];
    for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
            const pair = nearbyWindowPair(visible[i], visible[j]);
            if (pair) {
                // Stable across windows, so each link sways in its own rhythm.
                const seed = `${visible[i].id}:${visible[j].id}`;
                const hash = [...seed].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
                connections.push({...pair, phase: (hash % 6283) / 1000,
                    strength: pair.strength / Math.sqrt(Math.max(1, visible.length - 1))});
            }
        }
    }
    return connections;
}

// Both windows draw the same slow curve in screen coordinates. No sharp flashes
// or bright cores: the effect should feel like Lista's ambient page glow.
export function windowGlowPoints(from, to, time, phase = 0) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const amplitude = Math.min(48, length * 0.075);
    return Array.from({length: 65}, (_, index) => {
        const t = index / 64;
        // Overlapping waves drift at different speeds instead of repeating one
        // rigid bend. Taper to zero at both ends to keep connections anchored.
        const envelope = index === 0 || index === 64 ? 0 : Math.sin(Math.PI * t);
        const wave = Math.sin(time * 0.72 - t * 5.2 + phase) * 0.65
            + Math.sin(time * 0.43 + t * 8.4 + phase * 1.7) * 0.28
            + Math.sin(time * 1.07 - t * 11.5 + phase * 0.6) * 0.12;
        const offset = envelope * amplitude * wave;
        return {x: from.x + dx * t - dy / length * offset, y: from.y + dy * t + dx / length * offset};
    });
}

export function drawWindowGlow(ctx, own, pair, time) {
    // Skip links outside this viewport, including room for the drifting halo.
    const padding = 140;
    if (Math.max(pair.from.x, pair.to.x) + padding < own.x
        || Math.min(pair.from.x, pair.to.x) - padding > own.x + own.w
        || Math.max(pair.from.y, pair.to.y) + padding < own.y
        || Math.min(pair.from.y, pair.to.y) - padding > own.y + own.h) return;
    const phase = pair.phase || 0;
    const points = windowGlowPoints(pair.from, pair.to, time, phase);
    const breath = Math.sin(time * 0.51 + phase);
    ctx.save();
    ctx.globalAlpha = pair.strength * (0.55 + breath * 0.045);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const stroke = (width, alpha, blur) => {
        ctx.beginPath();
        points.forEach((point, index) => {
            const x = point.x - own.x, y = point.y - own.y;
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.lineWidth = width * (1 + breath * 0.08);
        ctx.strokeStyle = `rgba(33,186,156,${alpha})`;
        // One blur pass is enough for a diffuse glow; shadow + filter doubles
        // the raster work for every link in every window.
        ctx.filter = `blur(${blur / 3}px)`;
        ctx.stroke();
    };
    stroke(40, 0.045, 30);
    stroke(16, 0.075, 21);
    stroke(4, 0.13, 12);
    ctx.filter = "none";
    for (const point of [pair.from, pair.to]) {
        const x = point.x - own.x, y = point.y - own.y;
        const radius = 76 + breath * 8;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, "rgba(33,186,156,0.13)");
        glow.addColorStop(0.4, "rgba(33,186,156,0.065)");
        glow.addColorStop(1, "rgba(33,186,156,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}
