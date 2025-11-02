"use client";
import Link from "next/link";
import {gsap} from "gsap";
import {useEffect, useRef, useState} from "react";
import {useForm} from "react-hook-form";
import * as yup from "yup";
import {yupResolver} from "@hookform/resolvers/yup";
import {setCookie} from "cookies-next";
import CryptoJS from "crypto-js";
import {SECRET_KEY} from "../lib/helpers";
import SocialAuthButtons from "../components/SocialAuthButtons";

import Notification from "../components/Notification";
import {useNotificationContext} from "../contexts/NotificationContext";
import {useUserContext} from "../contexts/UserContext";
import Navigation from "../components/Navigation";
import HideIcon from "../components/svgs/HideIcon";
import ShowIcon from "../components/svgs/ShowIcon";

// Yup schema for validation
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

const LoginClient = () => {
    const {userData} = useUserContext();
    const messageRef = useRef(null);
    const buttonRef = useRef(null);
    const [isFormValid, setIsFormValid] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const {showNotification, notification} = useNotificationContext();
    const {
        register,
        handleSubmit,
        formState: {errors, isValid},
    } = useForm({resolver: yupResolver(schema), mode: "onChange"});

    useEffect(() => {
        const message = messageRef.current;
        gsap.fromTo(
            message,
            {opacity: 0, y: 100, rotate: -20, scale: 0.8},
            {
                opacity: 1,
                y: 0,
                rotate: 0,
                scale: 1,
                duration: 0.8,
                ease: "elastic.out(1, 0.5)",
                delay: 1,
            }
        );

        gsap.to(message, {
            delay: 2,
            duration: 0.5,
            color: "#ffcc00",
            repeat: 3,

            onComplete: () => {
                gsap.to(message, {
                    duration: 0.6,
                    scale: 1,
                    color: "#ff3333",
                    ease: "back.out(2)",
                });
                gsap.to(message, {
                    duration: 0.5,
                    delay: 1.2,
                    text: "Register Now! 🚀",
                    ease: "power2.out",
                });
            },
        });
    }, [userData]);

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

    const encryptData = (data) => {
        return CryptoJS.AES.encrypt(
            JSON.stringify(data),
            SECRET_KEY
        ).toString();
    };

    const onSubmit = async (data) => {
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

                showNotification(
                    "Login successful! Redirecting to Lista",
                    "success"
                );
                setTimeout(() => {
                    window.location.href = "/";
                }, 2000);
            } else {
                showNotification(`Error: Wrong crediantials`, "error");
            }
        } catch (error) {
            showNotification("Something went wrong.");
        }
    };

    // Mouse move handler to make the button move away from the cursor
    const handleMouseMove = (e) => {
        if (!isFormValid && buttonRef.current) {
            const button = buttonRef.current;
            const buttonRect = button.getBoundingClientRect();

            // Get mouse position
            const {clientX: mouseX, clientY: mouseY} = e;

            // Calculate the center of the button
            const buttonCenterX = buttonRect.left + buttonRect.width / 2;
            const buttonCenterY = buttonRect.top + buttonRect.height / 2;

            // Calculate the distance between mouse and button center
            const distanceX = mouseX - buttonCenterX;
            const distanceY = mouseY - buttonCenterY;
            const distance = Math.hypot(distanceX, distanceY);

            // Set a threshold distance where the button should start moving away
            const thresholdDistance = 200; // 200px threshold

            // Only move the button if the mouse is within the threshold distance
            if (distance < thresholdDistance) {
                // Calculate the direction vector from mouse to button
                // We invert this to make the button move away from the cursor
                const directionX = buttonCenterX - mouseX;
                const directionY = buttonCenterY - mouseY;

                // Normalize the direction vector
                const directionLength = Math.hypot(directionX, directionY);
                const normalizedDirectionX = directionX / directionLength;
                const normalizedDirectionY = directionY / directionLength;

                // Calculate the movement distance based on how close the cursor is
                // Closer cursor = stronger repulsion
                const repulsionStrength = 1 - distance / thresholdDistance;
                const moveDistance = 300 * repulsionStrength; // Increased move distance

                // Calculate the new position
                let moveX = normalizedDirectionX * moveDistance;
                let moveY = normalizedDirectionY * moveDistance;

                // Get viewport boundaries
                const {innerWidth: viewportWidth, innerHeight: viewportHeight} =
                    window;

                // Ensure the button stays within viewport bounds
                const newLeft = buttonRect.left + moveX;
                const newTop = buttonRect.top + moveY;

                // Adjust movement if the button would go out of bounds
                if (newLeft < 0) moveX = -buttonRect.left;
                if (newLeft + buttonRect.width > viewportWidth)
                    moveX = viewportWidth - buttonRect.right;
                if (newTop < 0) moveY = -buttonRect.top;
                if (newTop + buttonRect.height > viewportHeight)
                    moveY = viewportHeight - buttonRect.bottom;

                // Apply the movement with GSAP
                gsap.to(button, {
                    x: `+=${moveX}`,
                    y: `+=${moveY}`,
                    duration: 0.3, // Faster animation for better escape
                    ease: "power2.out",
                });
            }
        }
    };

    return (
        <main id="login-form" onMouseMove={handleMouseMove}>
            <Navigation route={"/"} link={"Home"} />
            <form
                className={"flex flex-col items-center max-auto mt-16"}
                onSubmit={handleSubmit(onSubmit)}
            >
                <div
                    className={
                        "flex flex-col gap-4 min-w-[80%] md:min-w-[350px]"
                    }
                >
                    <h2 className={"text-2xl font-bold text-blue-600 mb-2"}>
                        Login
                    </h2>

                    {/* Email Field */}
                    <div className="relative z-20 w-full mb-5 group">
                        <input
                            {...register("email")}
                            type="email"
                            name="email"
                            id="email"
                            className={`block py-3 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 appearance-none   focus:outline-none focus:ring-0  border-black dark:text-white dark:border-white duration-200 transition-all ${
                                errors.email
                                    ? "focus:border-red-500 border-red-500"
                                    : "focus:border-blue-400"
                            } peer`}
                            placeholder=" "
                        />
                        <label
                            htmlFor="email"
                            className="peer-focus:font-medium absolute text-sm  dark:text-white text-black duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
                        >
                            Email address
                        </label>{" "}
                        {errors.email && (
                            <p className="text-red-500 text-sm mt-2">
                                {errors.email.message}
                            </p>
                        )}
                    </div>

                    {/* Password Field */}
                    <div className="relative z-20 w-full mb-5 group">
                        <input
                            {...register("password")}
                            type={`${showPassword ? "text" : "password"}`}
                            name="password"
                            id="password"
                            className={`block py-3 px-0 w-full text-sm  bg-transparent border-0 border-b-2  appearance-none border-black dark:text-white dark:border-white duration-200 transition-all ${
                                errors.password
                                    ? " focus:border-red-500 border-red-500"
                                    : " focus:border-blue-400"
                            }  focus:outline-none focus:ring-0  peer`}
                            placeholder=" "
                        />
                        <label
                            htmlFor="password"
                            className="peer-focus:font-medium absolute text-sm text-black dark:text-white duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
                        >
                            Password
                        </label>{" "}
                        {errors.password && (
                            <p className="text-red-500 text-sm mt-2">
                                {errors.password.message}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute  cursor-pointer top-3 right-0 text-blue-600 dark:text-blue-500"
                        >
                            {" "}
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
                            )}{" "}
                        </button>
                    </div>

                    {/* <SocialAuthButtons /> */}

                    <a
                        href="/password-reset"
                        className="text-blue-600 self-start font-quicksand text-sm font-medium inline-block dark:text-blue-500 cursor-pointer hover:text-primary transition-colors duration-200"
                    >
                        Forgot Password
                    </a>

                    <button
                        ref={buttonRef}
                        type="submit"
                        className={`self-start ${
                            isFormValid ? "bg-blue-800" : "bg-red-600"
                        } text-white px-6 py-2 rounded-sm mt-4 relative z-10`}
                    >
                        Login
                    </button>
                </div>
            </form>

            <Link
                href={"/register"}
                ref={messageRef}
                className={
                    "fixed bottom-8 right-8 md:bottom-16 xl:bottom-24 xl:right-24 bg-blue-800 text-white p-4 rounded-sm"
                }
            >
                {" "}
                Don&#39;t Have an Account?{" "}
            </Link>
            {notification && <Notification />}
        </main>
    );
};

export default LoginClient;
