import test from "node:test";
import assert from "node:assert/strict";
import {nearbyWindowPair, nearbyWindowConnections, windowGlowPoints} from "../app/lib/windowGlow.mjs";
const a = {id: "a", x: 0, y: 100, w: 700, h: 700, visible: true};
const b = {id: "b", x: 730, y: 140, w: 600, h: 600, visible: true};
test("nearby and overlapping desktop windows use the same screen-space glow", () => {
    assert.deepEqual(nearbyWindowPair(a, b), nearbyWindowPair(b, a));
    assert.ok(nearbyWindowPair(a, {...b, x: 300}));
    const pair = nearbyWindowPair(a, b);
    const points = windowGlowPoints(pair.from, pair.to, 10);
    assert.deepEqual(points[0], pair.from);
    assert.deepEqual(points.at(-1), pair.to);
});
test("hidden tabs, identical windows, small views, and distant windows do not connect", () => {
    assert.equal(nearbyWindowPair(a, {...b, visible: false}), null);
    assert.equal(nearbyWindowPair(a, {...a, id: "b"}), null);
    assert.equal(nearbyWindowPair(a, {...b, w: 200}), null);
    assert.equal(nearbyWindowPair(a, {...b, x: 2000}), null);
    assert.equal(nearbyWindowPair(a, {...b, x: NaN}), null);
});

test("more visible nearby windows add a shared connection for every pair", () => {
    const c = {...a, id: "c", x: 400, y: 300};
    assert.equal(nearbyWindowConnections([a, b, c]).length, 3);
    assert.deepEqual(nearbyWindowConnections([a, b, c]), nearbyWindowConnections([c, a, b]));
    assert.equal(nearbyWindowConnections([a, b, {...c, visible: false}]).length, 1);
    assert.equal(nearbyWindowConnections([a]).length, 0);
});
