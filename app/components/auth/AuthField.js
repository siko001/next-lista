"use client";

import {useState} from "react";
import {Eye, EyeOff} from "lucide-react";

export default function AuthField({id, label, icon: Icon, error, password = false, hint, ...inputProps}) {
    const [visible, setVisible] = useState(false);
    const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
    return (
        <div className="auth-field">
            <label htmlFor={id}>{label}</label>
            <div className={`auth-input-wrap ${error ? "has-error" : ""}`}>
                {Icon && <Icon size={18} aria-hidden="true" />}
                <input {...inputProps} id={id} type={password ? (visible ? "text" : "password") : inputProps.type}
                    aria-invalid={!!error} aria-describedby={describedBy} />
                {password && <button className="auth-password-toggle" type="button" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
                    aria-pressed={visible} onClick={() => setVisible(!visible)}>
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>}
            </div>
            {hint && <p className="auth-field-hint" id={`${id}-hint`}>{hint}</p>}
            {error && <p className="auth-field-error" id={`${id}-error`} role="alert">{error.message}</p>}
        </div>
    );
}
