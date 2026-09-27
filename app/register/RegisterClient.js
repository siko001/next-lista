"use client";
import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import * as yup from "yup";
import {yupResolver} from "@hookform/resolvers/yup";
import {setCookie} from "cookies-next";
import {Mail, LockKeyhole, UserRound} from "lucide-react";
import Notification from "../components/Notification";
import {useUserContext} from "../contexts/UserContext";
import {useNotificationContext} from "../contexts/NotificationContext";
import AuthShell from "../components/auth/AuthShell";
import AuthField from "../components/auth/AuthField";
import PlayfulSubmit from "../components/auth/PlayfulSubmit";

const schema = yup.object().shape({
    username: yup.string().required("Username is required"),
    email: yup
        .string()
        .email("Invalid email format")
        .required("Email is required"),
    password: yup
        .string()
        .min(6, "Password must be at least 6 characters")
        .matches(/[0-9]/, "Password must contain at least one number")
        .matches(
            /[^a-zA-Z0-9]/,
            "Password must contain at least one special character"
        )
        .required("Password is required"),
    confirm_password: yup
        .string()
        .required("Confirm password is required")
        .test("passwords-match", "Passwords must match", function (value) {
            return !value || value === this.parent.password;
        }),
});

export default function RegisterClient() {
    const {userData, token, setUserData} = useUserContext();
    const {notification, showNotification} = useNotificationContext();
    const [redirecting, setRedirecting] = useState(false);
    const [emailStatus, setEmailStatus] = useState("idle");
    const {register, handleSubmit, watch, trigger, setError, clearErrors, formState: {errors, touchedFields, submitCount, isValid, isSubmitting}} = useForm({resolver: yupResolver(schema), mode: "onChange"});
    const email = watch("email", "");
    const password = watch("password", "");
    const strength = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;

    useEffect(() => {
        if (touchedFields.confirm_password) void trigger("confirm_password");
    }, [password, touchedFields.confirm_password, trigger]);

    // Keep availability checks in sync with the latest value and with form validation.
    useEffect(() => {
        setEmailStatus("idle");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
        const controller = new AbortController();
        const timeout = setTimeout(async () => {
            setEmailStatus("checking");
            try {
                const response = await fetch(`https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json/custom-api/v1/check-email?email=${encodeURIComponent(email)}`, {signal: controller.signal});
                if (!response.ok) throw new Error("Could not check email");
                const result = await response.json();
                if (controller.signal.aborted) return;
                setEmailStatus(result.exists ? "taken" : "available");
                if (result.exists) setError("email", {type: "availability", message: "This email is already registered"});
                else {
                    clearErrors("email");
                    await trigger("email");
                }
            } catch {
                if (!controller.signal.aborted) setEmailStatus("idle");
            }
        }, 500);
        return () => { clearTimeout(timeout); controller.abort(); };
    }, [email, setError, clearErrors, trigger]);

    const onSubmit = async (data) => {
        if (!token) {
            showNotification("Error: No authentication token found.");
            return;
        }

        try {
            const response = await fetch(
                "https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json/wp/v2/users/me",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        name: data.username,
                        email: data.email,
                        password: data.password,
                    }),
                }
            );

            const result = await response.json();

            if (result.code === "rest_user_invalid_email") {
                showNotification(`email is already registered`, "error");
                return;
            }

            if (response.ok && result) {
                setRedirecting(true);
                showNotification(
                    "User has been registered successfully. Redirecting to home page"
                );

                setUserData({
                    ...userData,
                    registered: "yes",
                    name: data.username,
                    username: data.username,
                });

                setCookie("registered", "yes", {
                    // httpOnly: true, // Prevent client-side access
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict", // Prevent CSRF attacks
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                });

                // Username
                const userName =
                    result.name || result.username || data.username;
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

                setCookie("id", result.id, {
                    // httpOnly: true, // Prevent client-side access
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict", // Prevent CSRF attacks
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                });

                setTimeout(() => {
                    window.location.href = "/";
                }, 3000);
            } else {
                showNotification(`Error: ${result.message}`);
            }
        } catch (error) {
            showNotification("Something went wrong. Please try again.");
        }
    };


    return (
        <>
            <AuthShell register>
                <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <AuthField {...register("username")} id="username" label="Username" icon={UserRound} type="text" autoComplete="nickname" placeholder="What should we call you?" error={(touchedFields.username || submitCount > 0) ? errors.username : undefined} />
                    <AuthField {...register("email")} id="email" label="Email address" icon={Mail} type="email" autoComplete="username" placeholder="you@example.com" error={(touchedFields.email || submitCount > 0) ? errors.email : undefined}
                        hint={emailStatus === "checking" ? "Checking availability…" : emailStatus === "available" ? "This email is available." : undefined} />
                    <AuthField {...register("password")} id="password" label="Password" icon={LockKeyhole} password autoComplete="new-password" placeholder="Make it a good one" error={(touchedFields.password || submitCount > 0) ? errors.password : undefined}
                        hint="At least 6 characters, a number and a special character." />
                    {password && <div className="auth-strength" aria-label={`Password strength: ${["Weak", "Weak", "Fair", "Strong", "Very strong"][strength]}`}>
                        <div aria-hidden="true">{[1,2,3,4].map(level => <span key={level} className={strength >= level ? `strength-${strength}` : ""} />)}</div>
                        <span>{["Weak", "Weak", "Fair", "Strong", "Very strong"][strength]}</span>
                    </div>}
                    <AuthField {...register("confirm_password")} id="confirm_password" label="Confirm password" icon={LockKeyhole} password autoComplete="new-password" placeholder="Once more, just to be sure" error={(touchedFields.confirm_password || submitCount > 0) ? errors.confirm_password : undefined} />
                    <PlayfulSubmit valid={isValid && emailStatus !== "taken" && emailStatus !== "checking"} busy={isSubmitting || redirecting} pendingLabel="Creating your account…">Create account</PlayfulSubmit>
                </form>
            </AuthShell>
            {notification && <Notification />}
        </>
    );
}
