"use client";
import Link from "next/link";
import {useState} from "react";
import {useForm} from "react-hook-form";
import * as yup from "yup";
import {yupResolver} from "@hookform/resolvers/yup";
import {setCookie, getCookie} from "cookies-next";
import CryptoJS from "crypto-js";
import {Mail, LockKeyhole} from "lucide-react";
import {SECRET_KEY, WP_API_BASE} from "../lib/helpers";
import {useUserContext} from "../contexts/UserContext";
import {claimGuestLists} from "../lib/claimGuestLists";
import Notification from "../components/Notification";
import {useNotificationContext} from "../contexts/NotificationContext";
import AuthShell from "../components/auth/AuthShell";
import AuthField from "../components/auth/AuthField";
import PlayfulSubmit from "../components/auth/PlayfulSubmit";

const schema = yup.object().shape({
    email: yup
        .string()
        .email("Invalid email format")
        .required("Email is required"),
    password: yup
        .string()
        .min(6, "Password must be at least 6 characters")
        .required("Password is required"),
});

export default function LoginClient() {
    const {showNotification, notification} = useNotificationContext();
    const [redirecting, setRedirecting] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [bringingLists, setBringingLists] = useState(false);
    const {userData, token: guestToken, loading: sessionLoading, isRegistered} = useUserContext();
    const {register, handleSubmit, formState: {errors, touchedFields, submitCount, isValid, isSubmitting}} = useForm({resolver: yupResolver(schema), mode: "onChange"});
    const encryptData = (data) => {
        return CryptoJS.AES.encrypt(
            JSON.stringify(data),
            SECRET_KEY
        ).toString();
    };

    const onSubmit = async (data) => {
        if (sessionLoading) return;
        setLoginError("");
        try {
            const response = await fetch(
                "https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json/jwt-auth/v1/token",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        username: data.email,
                        password: data.password,
                    }),
                }
            );

            const result = await response.json();

            if (result.token) {
                if (!isRegistered && getCookie("token") && (!guestToken || !userData?.id)) {
                    throw new Error("We couldn't verify your guest session. Refresh and try again so we can keep your lists.");
                }
                if (!isRegistered && guestToken && userData?.id) {
                    setBringingLists(true);
                    await claimGuestLists({apiBase: WP_API_BASE, guestToken, guestUserId: userData.id, accountToken: result.token});
                    setBringingLists(false);
                }
                // Encrypt and store the token in a cookie
                const encryptedToken = encryptData(result.token);
                setCookie("token", encryptedToken, {
                    // httpOnly: true, // Prevent client-side access
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict", // Prevent CSRF attacks
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                });
                setCookie("registered", "yes", {
                    // httpOnly: true, // Prevent client-side access
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict", // Prevent CSRF attacks
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                });

                const userName = result.user_display_name;
                setCookie(
                    "username",
                    {
                        userName,
                    },
                    {
                        // httpOnly: true, // Prevent client-side access
                        secure: process.env.NODE_ENV === "production",
                        sameSite: "strict", // Prevent CSRF attacks
                        maxAge: 60 * 60 * 24 * 7, // 1 week
                    }
                );

                const userId = result.user_id;
                setCookie("id", userId, {
                    // httpOnly: true, // Prevent client-side access
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict", // Prevent CSRF attacks
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                });

                setRedirecting(true);
                showNotification(
                    "Login successful! Redirecting to Lista",
                    "success"
                );
                setTimeout(() => {
                    window.location.href = "/";
                }, 2000);
            } else {
                showNotification(`Please check your email and password.`, "error");
            }
        } catch (error) {
            setLoginError(error.message || "We couldn't log you in. Please try again.");
        } finally {
            setBringingLists(false);
        }
    };


    return (
        <>
            <AuthShell>
                <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <AuthField {...register("email")} id="email" label="Email address" icon={Mail} type="email" autoComplete="username" placeholder="you@example.com" error={(touchedFields.email || submitCount > 0) ? errors.email : undefined} />
                    <AuthField {...register("password")} id="password" label="Password" icon={LockKeyhole} password autoComplete="current-password" placeholder="Your password" error={(touchedFields.password || submitCount > 0) ? errors.password : undefined} />
                    <Link href="/password-reset" className="auth-forgot">Forgot your password?</Link>
                    {loginError && <p className="auth-error" role="alert">{loginError}</p>}
                    <PlayfulSubmit valid={isValid} busy={sessionLoading || isSubmitting || redirecting} pendingLabel={sessionLoading ? "Getting ready…" : bringingLists ? "Bringing your lists…" : "Logging in…"}>Log in</PlayfulSubmit>
                </form>
            </AuthShell>
            {notification && <Notification />}
        </>
    );
}
