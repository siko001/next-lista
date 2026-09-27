"use client";
import {createContext, useContext, useEffect, useState} from "react";
import {setCookie, getCookie, deleteCookie} from "cookies-next";
import CryptoJS from "crypto-js";
import {useListContext} from "./ListContext";
import {WP_API_BASE, SECRET_KEY} from "../lib/helpers";
import {cachedValue, seedCache, invalidateSessionData, announceLogout, cacheKeys, CACHE_TTL} from "../lib/dataCache.mjs";
const UserContext = createContext();

export const UserProvider = ({children, initialRegistered = false, initialUserName}) => {
    const [userData, setUserData] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [registered, setRegistered] = useState(initialRegistered);
    const {clearUserLists} = useListContext();

    // Function to encrypt data
    const encryptData = (data) => {
        return CryptoJS.AES.encrypt(
            JSON.stringify(data),
            SECRET_KEY
        ).toString();
    };

    // Function to decrypt data
    const decryptData = (ciphertext) => {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    };

    // Function to create a new user
    const createUser = async () => {
        try {
            const res = await fetch(`${WP_API_BASE}/custom/v1/create-user`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
            });

            if (!res.ok) throw new Error("Failed to create user");

            return await res.json();
        } catch (err) {
            throw new Error(err.message || "User creation error");
        }
    };

    // Function to generate a JWT token
    const generateToken = async (username) => {
        try {
            const res = await fetch(`${WP_API_BASE}/jwt-auth/v1/token`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({username, password: "lista123"}),
            });

            if (!res.ok) throw new Error("Failed to generate token");

            return await res.json();
        } catch (err) {
            throw new Error(err.message || "Token generation error");
        }
    };

    // Function to fetch user data
    const fetchUserData = async (token) => {
        try {
            const res = await fetch(`${WP_API_BASE}/custom/v1/user-data`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
            });

            if (!res.ok) throw new Error("Failed to fetch user data");
            return await res.json();
        } catch (err) {
            throw new Error(err.message || "User data fetch error");
        }
    };

    // Function to log out the user
    const logout = () => {
        const oldId = getCookie("id");
        // Theme is a device preference; keep it consistent when signing out.
        // Clear authentication data
        deleteCookie("token");
        deleteCookie("registered");
        deleteCookie("id");
        deleteCookie("username");
        invalidateSessionData(oldId);
        announceLogout(oldId);
        setUserData(null);
        setRegistered(false);
        setToken(null);
        clearUserLists();
    };

    // Initialization function
    const initializeUser = async () => {
        try {
            let storedToken = null;
            // Check for existing token in cookies
            const encryptedToken = getCookie("token");
            if (encryptedToken) {
                storedToken = decryptData(encryptedToken);
            }
            if (!storedToken) {
                // No token? Create a new user and generate a token
                const newUser = await createUser();
                const tokenData = await generateToken(newUser.username);

                // Encrypt and store the token in a cookie
                const encryptedToken = encryptData(tokenData.token);

                // Set the token cookie
                setCookie("token", encryptedToken, {
                    // httpOnly: true, // Prevent client-side access
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict", // Prevent CSRF attacks
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                });

                // Set the registration cookie
                setCookie("registered", "no", {
                    // httpOnly: true, // Prevent client-side access
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict", // Prevent CSRF attacks
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                });

                setCookie("id", newUser.user_id, {
                    // httpOnly: true, // Prevent client-side access
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict", // Prevent CSRF attacks
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                });

                setUserData({
                    registered: "no",
                    id: newUser.user_id,
                    username: newUser.username,
                    email: newUser.email,
                    name: newUser.name,
                });

                setToken(tokenData.token);
            } else {
                // Paint the account label immediately, then validate the token
                // against WordPress on every load. Cached identity is only UI data.
                const userId = getCookie("id");
                const snapshot = userId && cachedValue(cacheKeys.profile(userId));
                if (snapshot && String(snapshot.id) === String(userId)) {
                    setUserData(snapshot);
                    setToken(storedToken);
                }
                const data = await fetchUserData(storedToken);
                setUserData(data);
                if (userId) seedCache(cacheKeys.profile(userId), {
                    id: data.id,
                    name: data.name,
                    registered: data.registered,
                }, CACHE_TTL.profile);
                // The login session is already known from the server cookie.
                // A delayed profile response must not turn its navigation into a guest view.
                if (data.registered === "yes") setRegistered(true);

                setToken(storedToken);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        initializeUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const syncLogout = (event) => {
            if (String(event.detail) !== String(userData?.id)) return;
            setUserData(null);
            setRegistered(false);
            setToken(null);
            clearUserLists();
        };
        window.addEventListener("lista:logout", syncLogout);
        return () => window.removeEventListener("lista:logout", syncLogout);
    }, [userData?.id, clearUserLists]);

    return (
        <UserContext.Provider
            value={{
                userData,
                isRegistered: registered || userData?.registered === "yes",
                accountName: userData?.name || initialUserName,
                setUserData,
                token,
                loading,
                error,
                logout,
            }}
        >
            {children}
        </UserContext.Provider>
    );
};

export const useUserContext = () => useContext(UserContext);
