"use client";
import {createContext, useContext, useEffect, useState} from "react";
import {useSession, signOut} from "next-auth/react";
import {setCookie, getCookie, deleteCookie} from "cookies-next";
import CryptoJS from "crypto-js";
import {useListContext} from "./ListContext";
import {WP_API_BASE, SECRET_KEY} from "../lib/helpers";

const UserContext = createContext();

export const UserProvider = ({children}) => {
    const {data: session, status} = useSession();
    const [userData, setUserData] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const {setUserLists} = useListContext();

    // Function to encrypt data
    const encryptData = (data) => {
        return CryptoJS.AES.encrypt(
            JSON.stringify(data),
            SECRET_KEY
        ).toString();
    };

    // Function to decrypt data
    const decryptData = (ciphertext) => {
        if (!ciphertext) return null;
        try {
            const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (error) {
            return null;
        }
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
            });

            if (!res.ok) throw new Error("Failed to fetch user data");
            return await res.json();
        } catch (err) {
            throw new Error(err.message || "User data fetch error");
        }
    };

    // Function to log out the user
    const logout = async () => {
        try {
            // Best-effort clear of NextAuth httpOnly cookie
            try {
                await fetch("/api/auth/signout", {method: "POST"});
            } catch (e) {}
            // Ask NextAuth to clear its session (no redirect yet)
            await signOut({redirect: false});

            // Clear app cookies (path=/ to ensure deletion)
            const cookieOptions = {path: "/"};
            try {
                deleteCookie("token", cookieOptions);
            } catch (e) {}
            try {
                deleteCookie("registered", cookieOptions);
            } catch (e) {}
            try {
                deleteCookie("id", cookieOptions);
            } catch (e) {}
            try {
                deleteCookie("username", cookieOptions);
            } catch (e) {}
            try {
                deleteCookie("userData", cookieOptions);
            } catch (e) {}

            // Clear theme and storages
            if (typeof document !== "undefined") {
                const html = document.documentElement;
                const themeClasses = [
                    "dark",
                    "dark-mode",
                    "light",
                    "light-mode",
                ];
                themeClasses.forEach((cls) => html.classList.remove(cls));
                html.removeAttribute("data-theme");
                
                // Reset language to English
                if (typeof window !== "undefined") {
                    // Clear language preference from storage
                    localStorage.removeItem("preferredLanguage");
                    
                    // Reset Google Translate if available
                    try {
                        // Try to reset Google Translate dropdown
                        const selectField = document.querySelector(".goog-te-combo");
                        if (selectField) {
                            selectField.value = 'en';
                            selectField.dispatchEvent(new Event('change'));
                        }
                        
                        // Force a reload of the Google Translate widget
                        if (window.google && window.google.translate) {
                            const iframe = document.querySelector('.goog-te-menu-frame');
                            if (iframe) {
                                iframe.style.display = 'none'; // Hide the dropdown if it's open
                            }
                        }
                    } catch (e) {
                        // If Google Translate reset fails, force a page reload as fallback
                        window.location.reload();
                    }
                }
            }
            if (typeof window !== "undefined") {
                try {
                    localStorage.clear();
                } catch (_) {}
                try {
                    sessionStorage.clear();
                } catch (_) {}
            }

            // Clear state
            setUserData(null);
            setToken(null);
            setUserLists(null);
            setError(null);

            // Hard redirect to home to ensure a fresh unauthenticated tree
            if (typeof window !== "undefined") {
                window.location.href = "/";
            }
        } catch (error) {}
    };

    // Initialization function
    const initializeUser = async () => {
        setLoading(true);
        try {
            // Check if user is authenticated via NextAuth (Google login)
            if (status === "authenticated" && session?.user) {
                // If no WordPress JWT yet, try to link the account
                if (!session.wpJwt && process.env.NEXT_PUBLIC_WORDPRESS_URL) {
                    try {
                        const tempUserId = getCookie("id");

                        const response = await fetch(
                            `${process.env.NEXT_PUBLIC_WORDPRESS_URL}/wp-json/custom/v1/link-google-account`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    google_email: session.user.email,
                                    google_name: session.user.name,
                                    google_id: session.user.id,
                                    google_picture: session.user.image,
                                    temp_user_id: tempUserId,
                                }),
                            }
                        );

                        if (response.ok) {
                            const wpData = await response.json();

                            // Store WordPress JWT
                            const wpToken = wpData.token;
                            setToken(wpToken);

                            setCookie("token", encryptData(wpToken), {
                                secure: process.env.NODE_ENV === "production",
                                sameSite: "strict",
                                maxAge: 60 * 60 * 24 * 7,
                            });

                            setCookie("registered", "yes", {
                                secure: process.env.NODE_ENV === "production",
                                sameSite: "strict",
                                maxAge: 60 * 60 * 24 * 7,
                            });

                            setCookie("id", wpData.user.id, {
                                secure: process.env.NODE_ENV === "production",
                                sameSite: "strict",
                                maxAge: 60 * 60 * 24 * 7,
                            });

                            // Fetch full user data from WordPress
                            const wpUserData = await fetchUserData(wpToken);
                            const finalUserData = {
                                ...wpUserData,
                                ...session.user,
                                isLoggedIn: true,
                            };
                            setUserData(finalUserData);
                        } else {
                            await response.text();
                            // Fall back to just using NextAuth session
                            const userData = {
                                ...session.user,
                                isLoggedIn: true,
                            };
                            setUserData(userData);
                            setToken(
                                session.accessToken || "google-auth-token"
                            );
                        }
                    } catch (error) {
                        // Fall back to just using NextAuth session
                        const userData = {
                            ...session.user,
                            isLoggedIn: true,
                        };
                        setUserData(userData);
                        setToken(session.accessToken || "google-auth-token");
                    }
                } else {
                    // Already have WordPress JWT or no WordPress URL configured
                    const userData = {
                        ...session.user,
                        isLoggedIn: true,
                    };
                    setUserData(userData);

                    const userToken =
                        session.wpJwt ||
                        session.accessToken ||
                        "google-auth-token";
                    setToken(userToken);
                }

                // Store session data in cookies
                setCookie(
                    "userData",
                    encryptData({
                        ...session.user,
                        isLoggedIn: true,
                    }),
                    {
                        secure: process.env.NODE_ENV === "production",
                        sameSite: "strict",
                        maxAge: 60 * 60 * 24 * 7,
                    }
                );
            } else if (status === "unauthenticated") {
                // Check for existing token in cookies (traditional login)
                const encryptedToken = getCookie("token");
                let storedToken = null;

                if (encryptedToken) {
                    storedToken = decryptData(encryptedToken);
                }

                if (storedToken) {
                    // Token exists? Fetch user data
                    try {
                        const data = await fetchUserData(storedToken);
                        setUserData(data);
                        setToken(storedToken);
                    } catch (error) {
                        // Token might be invalid, create new temp user
                        await createTempUser();
                    }
                } else {
                    // No token? Create a new temp user
                    await createTempUser();
                }
            } else {
                // Status is still loading, wait for it to resolve
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Helper function to create temp user
    const createTempUser = async () => {
        try {
            const newUser = await createUser();
            const tokenData = await generateToken(newUser.username);

            // Encrypt and store the token in a cookie
            const encryptedToken = encryptData(tokenData.token);

            // Set the token cookie
            setCookie("token", encryptedToken, {
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 60 * 60 * 24 * 7, // 1 week
            });

            // Set the registration cookie
            setCookie("registered", "no", {
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 60 * 60 * 24 * 7, // 1 week
            });

            setCookie("id", newUser.user_id, {
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 60 * 60 * 24 * 7, // 1 week
            });

            setUserData({
                id: newUser.user_id,
                username: newUser.username,
                email: newUser.email,
                name: newUser.name,
            });

            setToken(tokenData.token);
        } catch (error) {
            console.error("Error creating temp user:", error);
            setError(error.message);
        }
    };

    useEffect(() => {
        // Only initialize when status is not loading
        if (status !== "loading") {
            initializeUser();
        } else {
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session]);

    // Helper function for authenticated API requests
    const authFetch = async (url, options = {}) => {
        const authToken = token || session?.wpJwt;

        const headers = {
            "Content-Type": "application/json",
            ...options.headers,
        };

        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }

        try {
            const response = await fetch(`${WP_API_BASE}${url}`, {
                ...options,
                headers,
            });

            if (response.status === 401) {
                // Token expired or invalid
                await logout();
                throw new Error("Session expired. Please log in again.");
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    };

    const contextValue = {
        userData,
        setUserData,
        token,
        loading,
        error,
        logout,
        authFetch,
        isAuthenticated: !!userData?.isLoggedIn || !!token,
    };

    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    );
};

export const useUserContext = () => useContext(UserContext);
