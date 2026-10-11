// Rasterize the existing Lista vector mark for native launcher/splash assets.
import sharp from "sharp";
import {readFileSync, writeFileSync, readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "../public/favicon-light.svg"), "utf8");
const mark = source.replace(/^.*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<rect[^>]*\/>/, "");
const vector = (size, inset = 0, background = true) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${background ? '<rect width="64" height="64" fill="#f8f8ff"/>' : ''}<g transform="translate(${inset} ${inset}) scale(${(64 - inset * 2) / 64})">${mark}</g></svg>`);
const res = resolve(root, "android/app/src/main/res");
for (const [density, pixels] of Object.entries({mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192})) {
    for (const name of ["ic_launcher", "ic_launcher_round"]) await sharp(vector(pixels, 5)).png().toFile(resolve(res, `mipmap-${density}/${name}.png`));
    await sharp(vector(pixels * 108 / 48, 13, false)).png().toFile(resolve(res, `mipmap-${density}/ic_launcher_foreground.png`));
}
writeFileSync(resolve(res, "values/ic_launcher_background.xml"), '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#f8f8ff</color></resources>\n');
const splash = await sharp({create: {width: 2732, height: 2732, channels: 3, background: "#f8f8ff"}})
    .composite([{input: await sharp(vector(440, 5)).png().toBuffer(), gravity: "center"}]).png().toBuffer();
for (const entry of readdirSync(res)) {
    if (!entry.startsWith("drawable")) continue;
    const path = resolve(res, entry, "splash.png");
    try { readFileSync(path); writeFileSync(path, splash); } catch { /* Not every drawable folder contains a splash. */ }
}
const assets = resolve(root, "ios/App/App/Assets.xcassets");
await sharp(vector(1024, 5)).flatten({background: "#f8f8ff"}).png().toFile(resolve(assets, "AppIcon.appiconset/AppIcon-512@2x.png"));
for (const file of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) writeFileSync(resolve(assets, "Splash.imageset", file), splash);
console.log("Generated Lista launcher icons and launch screens from the existing favicon.");
