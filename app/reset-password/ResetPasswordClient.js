"use client";
import {useEffect, useRef, useState} from "react";
import {useForm} from "react-hook-form";
import * as yup from "yup";
import {yupResolver} from "@hookform/resolvers/yup";
import {gsap} from "gsap";

import Navigation from "../components/Navigation";
import Notification from "../components/Notification";
import {useNotificationContext} from "../contexts/NotificationContext";
import HideIcon from "../components/svgs/HideIcon";
import ShowIcon from "../components/svgs/ShowIcon";
import {WP_API_BASE} from "../lib/helpers";

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
    const buttonRef = useRef(null);
    const passwordWrapperRef = useRef(null);
    const [isFormValid, setIsFormValid] = useState(true);
    const [passwordClicked, setPasswordClicked] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        formState: {errors, isValid},
    } = useForm({resolver: yupResolver(schema), mode: "onChange"});

    const password = watch("password", "");

    const getPasswordStrength = (password) => {
        if (password.length === 0) return 0;
        let strength = 0;
        if (password.length >= 8) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^A-Za-z0-9]/.test(password)) strength += 1;
        return strength;
    };

    const passwordStrength = getPasswordStrength(password);

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                passwordWrapperRef.current &&
                !passwordWrapperRef.current.contains(event.target)
            ) {
                setPasswordClicked(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const hasToken = !!token;
        const hasKeyAndLogin = !!resetKey && !!login;
        setIsFormValid(isValid && (hasToken || hasKeyAndLogin));
        if (isValid && buttonRef.current) {
            gsap.to(buttonRef.current, {
                x: 0,
                y: 0,
                duration: 0.4,
                ease: "power2.out",
            });
        }
    }, [isValid, token, resetKey, login]);

    useEffect(() => {
        if (
            !errors.password &&
            password.length >= 6 &&
            /[0-9]/.test(password) &&
            /[^A-Za-z0-9]/.test(password)
        ) {
            setPasswordClicked(false);
        }
    }, [password, errors.password]);

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
            showNotification(
                "Password updated. Redirecting to login...",
                "success"
            );
            setTimeout(() => {
                window.location.href = "/login";
            }, 2000);
        } catch (e) {
            showNotification("Network error. Please try again.", "error");
        }
    };

    const handleBlur = () => {
        setTimeout(() => {
            if (
                passwordWrapperRef.current &&
                !passwordWrapperRef.current.contains(document.activeElement)
            ) {
                setPasswordClicked(false);
            }
        }, 100);
    };

    return (
        <main id="reset-password-form" onMouseMove={handleMouseMove}>
            <Navigation route={"/login"} link={"Back to Login"} />
            <form
                className="flex flex-col items-center max-auto mt-16"
                onSubmit={handleSubmit(onSubmit)}
            >
                <div className="flex flex-col gap-4 min-w-[80%] md:min-w-[350px]">
                    <h2 className="text-2xl font-bold text-blue-600 mb-2">
                        Reset Password
                    </h2>

                    {!(token || (resetKey && login)) && (
                        <div className="text-red-500 text-sm -mt-2">
                            Missing or invalid reset parameters.
                        </div>
                    )}

                    {/* Password Field */}
                    <div
                        ref={passwordWrapperRef}
                        className="relative z-20 w-full mb-5 group"
                    >
                        <input
                            onFocus={() => {
                                if (
                                    !errors.password &&
                                    password.length >= 6 &&
                                    /[0-9]/.test(password) &&
                                    /[^A-Za-z0-9]/.test(password)
                                )
                                    return setPasswordClicked(false);
                                setPasswordClicked(true);
                            }}
                            onBlur={handleBlur}
                            {...register("password")}
                            type={showPassword ? "text" : "password"}
                            name="password"
                            id="password"
                            className={`block py-3 px-0 w-full text-sm bg-transparent border-0 border-b-2 appearance-none outline-none focus:outline-none ring-0 focus:ring-0 border-black text-black dark:text-white dark:border-white duration-200 transition-all ${
                                errors.password
                                    ? "focus:border-red-500 border-red-500"
                                    : "focus:border-blue-400"
                            } peer`}
                            placeholder=" "
                        />
                        <label
                            htmlFor="password"
                            className="peer-focus:font-medium absolute text-sm text-black dark:text-white duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
                        >
                            Choose a Password
                        </label>
                        {errors.password && (
                            <p className="text-red-500 text-sm mt-2">
                                {errors.password.message}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute cursor-pointer top-3 right-0 text-blue-600 dark:text-blue-500"
                        >
                            {showPassword ? (
                                <HideIcon
                                    className={
                                        "text-gray-500 dark:text-gray-200 w-5 h-5"
                                    }
                                />
                            ) : (
                                <ShowIcon
                                    className={
                                        "text-gray-500 dark:text-gray-200 h-5 w-5"
                                    }
                                />
                            )}
                        </button>
                    </div>

                    {/* Password Strength */}
                    <div
                        className={`${
                            passwordClicked ? "block" : "hidden"
                        } w-full relative z-20 -mt-6 mb-5`}
                    >
                        <div className="flex space-x-1">
                            {[1, 2, 3, 4].map((level) => (
                                <div
                                    key={level}
                                    className={`h-1 flex-1 rounded ${
                                        passwordStrength >= level
                                            ? level === 1
                                                ? "bg-red-500"
                                                : level === 2
                                                ? "bg-yellow-500"
                                                : level === 3
                                                ? "bg-blue-500"
                                                : "bg-green-500"
                                            : "bg-gray-300"
                                    }`}
                                ></div>
                            ))}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            {passwordStrength === 0
                                ? "Enter a password"
                                : passwordStrength === 1
                                ? "Weak"
                                : passwordStrength === 2
                                ? "Moderate"
                                : passwordStrength === 3
                                ? "Strong"
                                : "Very Strong"}
                        </p>
                    </div>

                    {/* Confirm Password */}
                    <div
                        className={`relative z-20 w-full mb-5 group ${
                            passwordClicked ? "hidden" : "block"
                        }`}
                    >
                        <input
                            {...register("confirm_password")}
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirm_password"
                            id="confirm_password"
                            className={`block py-3 px-0 w-full text-sm bg-transparent border-0 border-b-2 appearance-none outline-none focus:outline-none ring-0 focus:ring-0 border-black text-black dark:text-white dark:border-white duration-200 transition-all ${
                                errors.confirm_password
                                    ? "focus:border-red-500 border-red-500"
                                    : "focus:border-blue-400"
                            } peer`}
                            placeholder=" "
                        />
                        <label
                            htmlFor="confirm_password"
                            className="peer-focus:font-medium absolute text-sm text-black dark:text-white duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
                        >
                            Confirm your Password
                        </label>
                        {errors.confirm_password && (
                            <p className="text-red-500 text-sm mt-2">
                                {errors.confirm_password.message}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                            }
                            className="absolute cursor-pointer top-3 right-0 text-blue-600 dark:text-blue-500"
                        >
                            {showConfirmPassword ? (
                                <HideIcon
                                    className={
                                        "text-gray-500 dark:text-gray-200 w-5 h-5"
                                    }
                                />
                            ) : (
                                <ShowIcon
                                    className={
                                        "text-gray-500 dark:text-gray-200 h-5 w-5"
                                    }
                                />
                            )}
                        </button>
                    </div>

                    <button
                        ref={buttonRef}
                        type="submit"
                        className={`self-start ${
                            isFormValid ? "bg-blue-800" : "bg-red-600"
                        } text-white px-6 py-2 rounded-sm mt-4 relative z-10`}
                    >
                        Update Password
                    </button>
                </div>
            </form>
            {notification && <Notification />}
        </main>
    );
}
