import {spawn, execFileSync} from "node:child_process";
import {existsSync, mkdirSync, copyFileSync, readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
import {homedir} from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const task = process.argv[2] || "assembleDebug";
if (!["assembleDebug", "bundleRelease", "assembleRelease"].includes(task)) throw new Error("Unsupported Android build task");
const signingKeys = ["LISTA_KEYSTORE_PATH", "LISTA_KEYSTORE_PASSWORD", "LISTA_KEY_ALIAS", "LISTA_KEY_PASSWORD"];
let signing = {};
const signingFile = resolve(root, ".signing/signing.json");
if (task !== "assembleDebug" && !signingKeys.some(key => process.env[key]) && existsSync(signingFile)) {
    const saved = JSON.parse(readFileSync(signingFile, "utf8"));
    signing = Object.fromEntries(signingKeys.map(key => [key, saved[key]]));
    if (typeof signing.LISTA_KEYSTORE_PATH === "string") signing.LISTA_KEYSTORE_PATH = resolve(root, signing.LISTA_KEYSTORE_PATH);
}
const buildEnv = {...process.env, ...signing};
if (task !== "assembleDebug" && !signingKeys.every((key) => typeof buildEnv[key] === "string" && buildEnv[key])) {
    throw new Error("Release signing is not configured. Use the debug APK for device testing, or supply the four LISTA_KEYSTORE/KEY signing variables documented in README.md.");
}
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || resolve(homedir(), "Library/Android/sdk");
if (!existsSync(sdk)) throw new Error("Android SDK not found. Set ANDROID_HOME to your Android Studio SDK directory.");
const bundledJava = "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
let javaHome = process.env.JAVA_HOME;
if (!javaHome && process.platform === "darwin") {
    try { javaHome = execFileSync("/usr/libexec/java_home", ["-v", "21"], {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim(); }
    catch { if (existsSync(bundledJava)) javaHome = bundledJava; }
}
mkdirSync(resolve(root, ".cache"), {recursive: true});
const debugKeystore = resolve(root, ".cache/debug.keystore");
if (task === "assembleDebug" && !existsSync(debugKeystore)) {
    execFileSync(javaHome ? resolve(javaHome, "bin/keytool") : "keytool", [
        "-genkeypair", "-keystore", debugKeystore, "-storepass", "android", "-keypass", "android",
        "-alias", "androiddebugkey", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
        "-dname", "CN=Android Debug,O=Android,C=US",
    ], {stdio: "inherit"});
}
const build = spawn(process.platform === "win32" ? "gradlew.bat" : "./gradlew", [task, "--no-daemon", "--console=plain"], {
    cwd: resolve(root, "android"),
    env: {...buildEnv, ANDROID_HOME: sdk,
        GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || resolve(root, ".cache/gradle"),
        ...(javaHome ? {JAVA_HOME: javaHome} : {}),
    },
    stdio: "inherit",
});
build.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
build.on("exit", (code) => {
    if (code !== 0) { process.exitCode = code || 1; return; }
    if (task === "assembleDebug") {
        mkdirSync(resolve(root, "artifacts"), {recursive: true});
        const destination = resolve(root, "artifacts/Lista-debug.apk");
        copyFileSync(resolve(root, "android/app/build/outputs/apk/debug/app-debug.apk"), destination);
        console.log(`\nInstallable test APK: ${destination}`);
    }
    if (task === "bundleRelease") {
        mkdirSync(resolve(root, "artifacts"), {recursive: true});
        const destination = resolve(root, "artifacts/Lista-release.aab");
        copyFileSync(resolve(root, "android/app/build/outputs/bundle/release/app-release.aab"), destination);
        console.log(`\nSigned Play bundle: ${destination}`);
    }
});
