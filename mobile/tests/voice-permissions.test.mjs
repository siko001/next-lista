import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {microphoneErrorMessage} from "../../app/lib/voiceRecording.mjs";

test("the Android manifest declares every permission Capacitor checks for audio capture", () => {
    const chromeClient = readFileSync(new URL("../node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/BridgeWebChromeClient.java", import.meta.url), "utf8");
    const audioBlock = chromeClient.match(/if \(Arrays\.asList\(request\.getResources\(\)\)\.contains\("android\.webkit\.resource\.AUDIO_CAPTURE"\)\) \{([^}]+)\}/)?.[1];
    assert.ok(audioBlock, "Recheck Capacitor's audio permission implementation after SDK updates");
    const manifest = readFileSync(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
    const permissions = [...audioBlock.matchAll(/permissionList\.add\(Manifest\.permission\.([A-Z_]+)\)/g)].map(match => match[1]);
    assert.ok(permissions.length > 0);
    for (const permission of permissions) assert.ok(manifest.includes(`android:name="android.permission.${permission}"`), `Missing ${permission}: Capacitor denies audio if any requested permission is missing`);
});

test("recording errors distinguish blocked permissions, missing and busy microphones", () => {
    assert.match(microphoneErrorMessage({name: "NotAllowedError"}), /device settings/);
    assert.match(microphoneErrorMessage({name: "NotReadableError"}), /Close other apps/);
    assert.match(microphoneErrorMessage({name: "NotFoundError"}), /No microphone/);
    assert.match(microphoneErrorMessage(new Error("internal details")), /could not start/);
});
