import test from "node:test";
import assert from "node:assert/strict";
import {createWindowGlowMotion} from "../app/lib/windowGlowMotion.mjs";
import {nearbyWindowConnections} from "../app/lib/windowGlow.mjs";

const left = {id: "left", x: 0, y: 100, w: 700, h: 700, visible: true};
const right = {id: "right", x: 300, y: 140, w: 600, h: 600, visible: true};
const createScene = () => {
    const scene = createWindowGlowMotion();
    scene.setWindows([left, right], 0);
    return scene;
};

test("a cursor in the right window pulls the left endpoint visible inside it", () => {
    const scene = createScene();
    scene.setPointer({id: "right", point: {x: 400, y: 450}, at: 100});
    // No animation, focus update or spring offsets from the left window.
    const views = scene.getWindows(500);
    assert.ok(views.find((view) => view.id === "left").offsetX > 15);
    assert.ok(nearbyWindowConnections(views)[0].from.x > 365);
});

test("all windows render the same spring even when sampled at different rates", () => {
    const first = createScene(), second = createScene();
    const hover = {id: "right", point: {x: 400, y: 450}, at: 100};
    first.setPointer(hover); second.setPointer(hover);
    for (let at = 100; at < 450; at += 1000 / 144) first.getWindows(at);
    assert.deepEqual(first.getWindows(450), second.getWindows(450));
    const release = {id: "right", point: null, at: 500};
    first.setPointer(release); second.setPointer(release);
    assert.deepEqual(first.getWindows(800), second.getWindows(800));
    assert.ok(first.getWindows(800)[0].offsetX < 0, "release has a small bounce");
    assert.equal(first.getWindows(2500)[0].offsetX, 0);
});

test("a stale blur from another window cannot cancel the current hover", () => {
    const scene = createScene();
    const hover = {id: "right", point: {x: 400, y: 450}, at: 100};
    scene.setPointer(hover);
    assert.equal(scene.setPointer({id: "left", point: null, at: 150}), false);
    assert.equal(scene.setPointer({id: "left", point: {x: 50, y: 50}, at: 90}), false);
    assert.equal(scene.setPointer(hover), false, "heartbeats must not restart the spring");
    assert.deepEqual(scene.getPointer(), hover);
    assert.ok(scene.getWindows(500)[0].offsetX > 15);
});

test("moving outside the radius releases every endpoint without a window focus change", () => {
    const scene = createScene();
    scene.setPointer({id: "right", point: {x: 400, y: 450}, at: 100});
    scene.setPointer({id: "right", point: {x: 880, y: 730}, at: 600});
    for (const view of scene.getWindows(2600)) {
        assert.equal(view.offsetX, 0);
        assert.equal(view.offsetY, 0);
    }
});
