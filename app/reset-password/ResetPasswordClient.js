"use client";
import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useForm} from "react-hook-form";
import * as yup from "yup";
import {yupResolver} from "@hookform/resolvers/yup";
import {LockKeyhole, ShieldCheck} from "lucide-react";
import Notification from "../components/Notification";
import {useNotificationContext} from "../contexts/NotificationContext";
import {WP_API_BASE} from "../lib/helpers";
import AuthShell from "../components/auth/AuthShell";
import AuthField from "../components/auth/AuthField";
import PlayfulSubmit from "../components/auth/PlayfulSubmit";

const schema = yup.object().shape({
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
        .oneOf([yup.ref("password"), null], "Passwords must match")
        .required("Confirm password is required"),
});

export default function ResetPasswordClient({token, resetKey, login}) {
    const {showNotification, notification} = useNotificationContext();
    const [updated, setUpdated] = useState(false);
    const router = useRouter();
    const {register, handleSubmit, watch, formState: {errors, isValid, isSubmitting}} = useForm({resolver: yupResolver(schema), mode: "onChange"});
    const password = watch("password", "");
    const strength = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
    const hasResetLink = !!(token || (resetKey && login));
    const onSubmit = async (data) => {
        const hasToken = !!token;
        const hasKeyAndLogin = !!resetKey && !!login;
        if (!hasToken && !hasKeyAndLogin) {
            showNotification("Reset link is invalid or incomplete.", "error");
            return;
        }

        try {
            const res = await fetch(`${WP_API_BASE}/custom/v1/reset-password`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(
                    hasToken
                        ? {token, password: data.password}
                        : {key: resetKey, login, password: data.password}
                ),
            });
            const result = await res.json().catch(() => ({}));
            if (!res.ok || result?.success === false) {
                const msg = result?.message || "Could not reset password.";
                showNotification(msg, "error");
                return;
            }
            setUpdated(true);
            showNotification(
                "Password updated. Redirecting to login...",
                "success"
            );
            setTimeout(() => {
                router.push("/login");
            }, 2000);
        } catch (e) {
            showNotification("Network error. Please try again.", "error");
        }
    };


    return (
        <>
            <AuthShell mode="reset">
                {updated ? <div className="auth-recovery-message" role="status">
                    <ShieldCheck size={28} aria-hidden="true" />
                    <h2>You’re all set</h2>
                    <p>Your password has been updated. Taking you back to login…</p>
                    <Link href="/login" className="app-primary-action">Back to login</Link>
                </div> : !hasResetLink ? <div className="auth-recovery-message" role="alert">
                    <h2>Let’s get you a new link</h2>
                    <p>This reset link is incomplete. Request another link to continue.</p>
                    <Link href="/password-reset" className="app-primary-action">Request reset link</Link>
                </div> : <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <AuthField {...register("password")} id="password" label="New password" icon={LockKeyhole} password autoComplete="new-password" placeholder="Make it a good one" error={errors.password} hint="At least 6 characters, a number and a special character." />
                    {password && <div className="auth-strength" aria-label={`Password strength: ${["Weak", "Weak", "Fair", "Strong", "Very strong"][strength]}`}>
                        <div aria-hidden="true">{[1,2,3,4].map(level => <span key={level} className={strength >= level ? `strength-${strength}` : ""} />)}</div>
                        <span>{["Weak", "Weak", "Fair", "Strong", "Very strong"][strength]}</span>
                    </div>}
                    <AuthField {...register("confirm_password")} id="confirm_password" label="Confirm password" icon={LockKeyhole} password autoComplete="new-password" placeholder="Once more, just to be sure" error={errors.confirm_password} />
                    <PlayfulSubmit valid={isValid} busy={isSubmitting} pendingLabel="Updating password…">Update password</PlayfulSubmit>
                </form>}
            </AuthShell>
            {notification && <Notification />}
        </>
    );
}
