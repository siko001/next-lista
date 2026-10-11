import {defineConfig, transformWithEsbuild} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
import {readFileSync} from "node:fs";

const root = dirname(fileURLToPath(import.meta.url));
const repo = resolve(root, "..");
const config = JSON.parse(readFileSync(resolve(root, "app.config.json"), "utf8"));
const nativeConfig = JSON.parse(readFileSync(resolve(root, "capacitor.config.json"), "utf8"));
if (config.appId !== nativeConfig.appId) throw new Error("Keep appId consistent in both mobile configuration files.");
for (const name of ["webUrl", "wordpressUrl"]) {
    const url = new URL(config[name]);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error(`${name} must be a public HTTPS origin.`);
    }
}

export default defineConfig({
    root,
    publicDir: resolve(repo, "public"),
    plugins: [
        {
            name: "lista-mobile-adapters",
            enforce: "pre",
            resolveId(source, importer) {
                if (!importer || !source.startsWith(".")) return;
                const target = resolve(dirname(importer.split("?")[0]), source);
                if (target === resolve(repo, "app/lib/platform.mjs")) return resolve(root, "src/platform.js");
                if (["app/lib/pusherClient", "app/lib/pusherClient.js"].some((path) => target === resolve(repo, path))) {
                    return resolve(root, "src/realtime.js");
                }
            },
            async transform(code, id) {
                if (id.startsWith(resolve(repo, "app/")) && id.endsWith(".js")) {
                    return transformWithEsbuild(code, id, {loader: "jsx", jsx: "automatic"});
                }
            },
        },
        react(),
    ],
    resolve: {
        dedupe: ["react", "react-dom"],
        alias: {
            "next/link": resolve(root, "src/compat/Link.jsx"),
            "next/navigation": resolve(root, "src/compat/navigation.js"),
            "next/dynamic": resolve(root, "src/compat/dynamic.jsx"),
            "cookies-next": resolve(root, "src/session.js"),
        },
    },
    define: {
        __LISTA_CONFIG__: JSON.stringify(config),
        "process.env.NEXT_PUBLIC_FB_APP_ID": JSON.stringify(""),
    },
    css: {postcss: {plugins: [tailwindcss({base: repo})]}},
    optimizeDeps: {esbuildOptions: {loader: {".js": "jsx"}}},
    server: {
        port: 4173,
        fs: {allow: [repo]},
        proxy: {"/api": {target: config.webUrl, changeOrigin: true}},
    },
    build: {
        target: "es2022",
        rollupOptions: {onwarn(warning, warn) {
            if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
            warn(warning);
        }},
    },
});
