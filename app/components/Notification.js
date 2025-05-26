"use client";
import {useEffect, useRef} from "react";
import {useNotificationContext} from "../contexts/NotificationContext";
import {gsap} from "gsap";

export default function Notification() {
    const {notification, clearNotification} = useNotificationContext();
    const notificationRef = useRef(null);
    const timeoutRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        if (notification && notification.message) {
            // Kill any existing animations
            if (animationRef.current) {
                animationRef.current.kill();
            }

            // Clear any existing timeouts
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Animate in
            animationRef.current = gsap.fromTo(
                notificationRef.current,
                {
                    y: 100,
                    opacity: 0,
                    scale: 0.95,
                },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 0.5,
                    ease: "power2.out",
                }
            );

            // Animate out after timeout
            timeoutRef.current = setTimeout(() => {
                animationRef.current = gsap.to(notificationRef.current, {
                    y: 100,
                    opacity: 0,
                    scale: 0.95,
                    duration: 0.5,
                    ease: "power2.in",
                    onComplete: () => {
                        if (clearNotification) {
                            clearNotification();
                        }
                    },
                });
            }, notification.timeout - 500); // Subtract animation duration
        }

        // Cleanup function
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (animationRef.current) {
                animationRef.current.kill();
            }
        };
    }, [notification, clearNotification]);

    const notificationTypeError =
        notification?.type === "error"
            ? "bg-red-500 text-white"
            : notification?.type === "info"
            ? "bg-blue-500 text-white"
            : "bg-green-500 text-white";

    return (
        notification &&
        notification.message && (
            <div
                ref={notificationRef}
                className={`${notificationTypeError} fixed bottom-8 z-[9999] right-8 font-quicksand font-[600] p-4 rounded-md shadow-md transform`}
            >
                {notification.message}
            </div>
        )
    );
}
