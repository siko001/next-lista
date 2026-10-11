import {readFileSync, mkdirSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(resolve(root, "app.config.json"), "utf8"));
const fingerprint = process.env.LISTA_ANDROID_SHA256;
const team = process.env.LISTA_APPLE_TEAM_ID;
if (!fingerprint && !team) throw new Error("Provide LISTA_ANDROID_SHA256 and/or LISTA_APPLE_TEAM_ID. See README.md. Nothing is uploaded by this command.");
const output = resolve(root, "association-files/.well-known");
mkdirSync(output, {recursive: true});
if (fingerprint) {
    if (!/^(?:[0-9a-f]{2}:){31}[0-9a-f]{2}$/i.test(fingerprint)) throw new Error("Invalid SHA-256 certificate fingerprint");
    writeFileSync(resolve(output, "assetlinks.json"), JSON.stringify([{
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {namespace: "android_app", package_name: config.appId, sha256_cert_fingerprints: [fingerprint.toUpperCase()]},
    }], null, 2));
}
if (team) {
    if (!/^[A-Z0-9]{10}$/.test(team)) throw new Error("Invalid Apple team ID");
    writeFileSync(resolve(output, "apple-app-site-association"), JSON.stringify({applinks: {
        apps: [], details: [{appID: `${team}.${config.appId}`, paths: ["/shared-list/*", "/list/*", "/reset-password*"]}],
    }}, null, 2));
}
console.log(`Prepared verification files in ${output}. Publish them on ${config.webUrl} when enabling app links.`);
