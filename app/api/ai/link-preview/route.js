import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const runtime = "nodejs";

function publicAddress(address) {
  const lower = address.toLowerCase();
  if (lower.includes(":")) {
    return !(
      lower === "::1" || lower === "::" || lower.startsWith("fc") ||
      lower.startsWith("fd") || lower.startsWith("fe8") ||
      lower.startsWith("fe9") || lower.startsWith("fea") ||
      lower.startsWith("feb") || lower.startsWith("::ffff:")
    );
  }
  const parts = lower.split(".").map(Number);
  const [a, b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0) || (a === 192 && b === 0 && parts[2] === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && parts[2] === 100) ||
    (a === 203 && b === 0 && parts[2] === 113));
}

async function safeUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.port || url.username || url.password ||
      !url.hostname.includes(".") || isIP(url.hostname) ||
      url.hostname.toLowerCase().endsWith(".localhost")) {
    throw new Error("Unsupported URL");
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) {
    throw new Error("Unsupported host");
  }
  return url;
}

function decode(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#39);/g, (entity) =>
    ({ "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">", "&#39;": "'" })[entity]
  ).replace(/\s+/g, " ").trim();
}

function meta(html, key) {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of tags) {
    if (!new RegExp(`(?:property|name)=["']${key}["']`, "i").test(tag)) continue;
    const value = tag.match(/content=["']([^"']*)["']/i)?.[1];
    if (value) return decode(value);
  }
  return "";
}

export async function GET(req) {
  try {
    let url = await safeUrl(new URL(req.url).searchParams.get("url") || "");
    const signal = AbortSignal.timeout(5000);
    let response;
    for (let i = 0; i < 3; i++) {
      response = await fetch(url, {
        signal,
        redirect: "manual",
        headers: { Accept: "text/html", "User-Agent": "ListaLinkPreview/1.0" },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new Error("Invalid redirect");
      url = await safeUrl(new URL(location, url).href);
    }
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      throw new Error("No preview");
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (size < 128000) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel();
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    const title = meta(html, "og:title") || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "");
    const description = meta(html, "og:description") || meta(html, "description");
    return Response.json({
      title: title.slice(0, 160) || url.hostname,
      description: description.slice(0, 260),
      site: url.hostname,
    }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return Response.json({ error: "Preview unavailable" }, { status: 422 });
  }
}
