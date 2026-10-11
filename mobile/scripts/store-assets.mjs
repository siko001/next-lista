import sharp from "sharp";
import {readFileSync, mkdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "artifacts/google-play");
mkdirSync(output, {recursive: true});
const source = readFileSync(resolve(root, "../public/favicon-light.svg"), "utf8");
const mark = source.replace(/^.*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<rect[^>]*\/>/, "");
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f8f8ff"/><g transform="translate(5 5) scale(.84375)">${mark}</g></svg>`;
await sharp(Buffer.from(icon)).png().toFile(resolve(output, "icon-512.png"));
const graphic = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#f8f8ff"/><stop offset="1" stop-color="#e9f9f3"/></linearGradient></defs>
<rect width="1024" height="500" fill="url(#bg)"/>
<circle cx="935" cy="36" r="200" fill="#21ba9c" opacity=".07"/>
<circle cx="985" cy="450" r="210" fill="#2453dc" opacity=".04"/>
<g transform="translate(72 69) scale(1.1)">${mark}</g>
<text x="160" y="122" fill="#163449" font-family="sans-serif" font-weight="800" font-size="48" letter-spacing="-2">LISTA</text>
<g fill="#163449" font-family="sans-serif" font-weight="700" font-size="47" letter-spacing="-1.7"><text x="72" y="223">Less remembering.</text><text x="72" y="281">More living.</text></g>
<text x="74" y="339" fill="#536a79" font-family="sans-serif" font-size="20">Your shopping lists, together.</text>
<rect x="664" y="76" width="282" height="346" rx="26" fill="#163449" opacity=".06"/>
<rect x="654" y="66" width="282" height="346" rx="26" fill="white" stroke="#d9e9e7"/>
<text x="682" y="116" fill="#163449" font-family="sans-serif" font-weight="700" font-size="22">Weekly groceries</text>
<text x="682" y="143" fill="#7c8e98" font-family="sans-serif" font-size="13">A little more organised.</text>
${["Tomatoes", "Pasta", "Fresh bread", "Milk"].map((label, i) => `<rect x="678" y="${169 + i * 53}" width="234" height="42" rx="11" fill="${i === 0 ? '#effaf6' : '#f5f7fb'}"/><rect x="694" y="${182 + i * 53}" width="16" height="16" rx="5" fill="${i === 0 ? '#21ba9c' : 'white'}" stroke="${i === 0 ? '#21ba9c' : '#cbd9de'}"/>${i === 0 ? '<path d="m697 190 3 3 6-7" fill="none" stroke="white" stroke-width="2"/>' : ''}<text x="724" y="${197 + i * 53}" fill="#334b59" font-family="sans-serif" font-size="16">${label}</text>`).join("")}
</svg>`;
await sharp(Buffer.from(graphic)).flatten({background: "#f8f8ff"}).removeAlpha().png().toFile(resolve(output, "feature-1024x500.png"));
console.log("Generated Google Play icon and feature graphic in mobile/artifacts/google-play.");
