import {randomBytes} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, writeFileSync, chmodSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const folder = resolve(root, ".signing");
const keyFile = resolve(folder, "lista-upload.jks");
const configFile = resolve(folder, "signing.json");
if (existsSync(keyFile) || existsSync(configFile)) {
    throw new Error("Signing material already exists. It was left unchanged; back it up before making any changes.");
}
let javaHome = process.env.JAVA_HOME;
if (!javaHome && process.platform === "darwin") {
    javaHome = execFileSync("/usr/libexec/java_home", ["-v", "21"], {encoding: "utf8"}).trim();
}
mkdirSync(folder, {recursive: true, mode: 0o700});
chmodSync(folder, 0o700);
const password = randomBytes(32).toString("base64url");
const alias = "lista-upload";
execFileSync(javaHome ? resolve(javaHome, "bin/keytool") : "keytool", [
    "-genkeypair", "-keystore", keyFile, "-storetype", "JKS",
    "-storepass:env", "LISTA_SETUP_PASSWORD", "-keypass:env", "LISTA_SETUP_PASSWORD",
    "-alias", alias, "-keyalg", "RSA", "-keysize", "3072", "-validity", "10000",
    "-dname", "CN=Lista Upload, O=Lista",
], {env: {...process.env, LISTA_SETUP_PASSWORD: password}, stdio: "pipe"});
chmodSync(keyFile, 0o600);
writeFileSync(configFile, JSON.stringify({
    LISTA_KEYSTORE_PATH: keyFile,
    LISTA_KEYSTORE_PASSWORD: password,
    LISTA_KEY_ALIAS: alias,
    LISTA_KEY_PASSWORD: password,
}, null, 2) + "\n", {mode: 0o600, flag: "wx"});
console.log("Created a local Lista upload key. Passwords were not printed. Back up mobile/.signing securely; never commit or upload that folder to Play Console.");
