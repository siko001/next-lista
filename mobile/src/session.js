import {Capacitor} from "@capacitor/core";
import {SecureStorage, KeychainAccess} from "@aparajita/capacitor-secure-storage";
import {createSessionStore} from "./session-store.mjs";

const key = "lista-session-v1";
const native = Capacitor.isNativePlatform();
const storageError = () => window.dispatchEvent(new CustomEvent("lista:mobile-error", {
    detail: "Could not save your session securely. Please try again before closing Lista.",
}));
const store = createSessionStore({
    // Browser preview uses tab-scoped storage; installed apps use Keychain/Keystore.
    read: () => native ? SecureStorage.get(key) : JSON.parse(sessionStorage.getItem(key) || "null"),
    write: (value) => native ? SecureStorage.set(key, value) : sessionStorage.setItem(key, JSON.stringify(value)),
    onError: storageError,
});
export async function initializeSession() {
    if (native) {
        await SecureStorage.setKeyPrefix("lista_");
        await SecureStorage.setSynchronize(false);
        await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
    }
    await store.initialize();
}
export const getCookie = (name) => store.get(name);
export const setCookie = (name, value, options) => store.set(name, value, options);
export const deleteCookie = (name) => store.delete(name);
export const flushSession = () => store.flush();
