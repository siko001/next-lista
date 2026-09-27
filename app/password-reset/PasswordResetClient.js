"use client";
import {useState} from "react";
import {useForm} from "react-hook-form";
import * as yup from "yup";
import {yupResolver} from "@hookform/resolvers/yup";
import {Mail, MailCheck} from "lucide-react";
import {WP_API_BASE} from "../lib/helpers";
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
});

export default function PasswordResetClient() {
    const {showNotification, notification} = useNotificationContext();
    const [sent, setSent] = useState(false);
    const {register, handleSubmit, formState: {errors, touchedFields, submitCount, isValid, isSubmitting}} = useForm({resolver: yupResolver(schema), mode: "onChange"});
    const onSubmit = async ({email}) => {
        try {
            const res = await fetch(
                `${WP_API_BASE}/custom/v1/send-reset-link`,
                {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({email}),
                }
            );
            const result = await res.json().catch(() => ({}));
            if (!res.ok || result?.success === false) {
                const msg =
                    result?.message || "Could not request password reset.";
                showNotification(msg, "error");
                return;
            }
            setSent(true);
            showNotification(
                "If an account exists for that email, you will receive a reset link shortly.",
                "success"
            );
        } catch (e) {
            showNotification("Network error. Please try again.", "error");
        }
    };


    return (
        <>
            <AuthShell mode="forgot">
                {sent ? <div className="auth-recovery-message" role="status">
                    <MailCheck size={28} aria-hidden="true" />
                    <h2>Check your inbox</h2>
                    <p>If an account exists for that email, a reset link will arrive shortly. Check your spam folder too.</p>
                    <button type="button" className="auth-recovery-retry" onClick={() => setSent(false)}>Try another email</button>
                </div> : <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <AuthField {...register("email")} id="email" label="Email address" type="email" autoComplete="email" icon={Mail} placeholder="you@example.com" error={(touchedFields.email || submitCount > 0) ? errors.email : undefined} />
                    <PlayfulSubmit valid={isValid} busy={isSubmitting} pendingLabel="Sending link…">Send reset link</PlayfulSubmit>
                </form>}
            </AuthShell>
            {notification && <Notification />}
        </>
    );
}
