"use client";
import {useEffect, useRef, useState} from "react";
import {useForm} from "react-hook-form";
import * as yup from "yup";
import {yupResolver} from "@hookform/resolvers/yup";
import {WP_API_BASE} from "../lib/helpers";
import {gsap} from "gsap";

import Navigation from "../components/Navigation";
import Notification from "../components/Notification";
import {useNotificationContext} from "../contexts/NotificationContext";

const schema = yup.object().shape({
    email: yup
        .string()
        .email("Invalid email format")
        .required("Email is required"),
});

export default function PasswordResetClient() {
    const {showNotification, notification} = useNotificationContext();
    const buttonRef = useRef(null);
    const [isFormValid, setIsFormValid] = useState(true);

    const {
        register,
        handleSubmit,
        formState: {errors, isValid},
    } = useForm({resolver: yupResolver(schema), mode: "onChange"});

    useEffect(() => {
        setIsFormValid(isValid);
        if (isValid && buttonRef.current) {
            gsap.to(buttonRef.current, {
                x: 0,
                y: 0,
                duration: 0.4,
                ease: "power2.out",
            });
        }
    }, [isValid]);

    const handleMouseMove = (e) => {
        if (!isFormValid && buttonRef.current) {
            const button = buttonRef.current;
            const rect = button.getBoundingClientRect();
            const {clientX: mouseX, clientY: mouseY} = e;
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = mouseX - cx;
            const dy = mouseY - cy;
            const dist = Math.hypot(dx, dy);
            const threshold = 200;
            if (dist < threshold) {
                const dirX = cx - mouseX;
                const dirY = cy - mouseY;
                const len = Math.hypot(dirX, dirY) || 1;
                const nx = dirX / len;
                const ny = dirY / len;
                const strength = 1 - dist / threshold;
                let moveX = nx * 300 * strength;
                let moveY = ny * 300 * strength;
                const {innerWidth: vw, innerHeight: vh} = window;
                const newLeft = rect.left + moveX;
                const newTop = rect.top + moveY;
                if (newLeft < 0) moveX = -rect.left;
                if (newLeft + rect.width > vw) moveX = vw - rect.right;
                if (newTop < 0) moveY = -rect.top;
                if (newTop + rect.height > vh) moveY = vh - rect.bottom;
                gsap.to(button, {
                    x: `+=${moveX}`,
                    y: `+=${moveY}`,
                    duration: 0.3,
                    ease: "power2.out",
                });
            }
        }
    };

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
            showNotification(
                "If an account exists for that email, you will receive a reset link shortly.",
                "success"
            );
        } catch (e) {
            showNotification("Network error. Please try again.", "error");
        }
    };

    return (
        <main id="password-reset-form" onMouseMove={handleMouseMove}>
            <Navigation route={"/login"} link={"Back to Login"} />
            <form
                className="flex flex-col items-center max-auto mt-16"
                onSubmit={handleSubmit(onSubmit)}
            >
                <div className="flex flex-col gap-4 min-w-[80%] md:min-w-[350px]">
                    <h2 className="text-2xl font-bold text-blue-600 mb-2">
                        Password Reset
                    </h2>

                    {/* Email Field */}
                    <div className="relative z-20 w-full mb-5 group">
                        <input
                            {...register("email")}
                            type="email"
                            name="email"
                            id="email"
                            className={`block py-3 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 appearance-none focus:outline-none focus:ring-0 border-black dark:text-white dark:border-white duration-200 transition-all ${
                                errors.email
                                    ? "focus:border-red-500 border-red-500"
                                    : "focus:border-blue-400"
                            } peer`}
                            placeholder=" "
                        />
                        <label
                            htmlFor="email"
                            className="peer-focus:font-medium absolute text-sm dark:text-white text-black duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
                        >
                            Email address
                        </label>
                        {errors.email && (
                            <p className="text-red-500 text-sm mt-2">
                                {errors.email.message}
                            </p>
                        )}
                    </div>

                    <button
                        ref={buttonRef}
                        type="submit"
                        className={`self-start ${
                            isFormValid ? "bg-blue-800" : "bg-red-600"
                        } text-white px-6 py-2 rounded-sm mt-4 relative z-10`}
                    >
                        Send Reset Link
                    </button>
                </div>
            </form>
            {notification && <Notification />}
        </main>
    );
}
