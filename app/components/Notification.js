"use client";
import {useEffect, useRef} from "react";
import {useNotificationContext} from "../contexts/NotificationContext";
import {gsap} from "gsap";

function Toast({toast, onDone, index}) {
    const ref = useRef(null);
    const timeoutRef = useRef(null);
    const animRef = useRef(null);

    useEffect(() => {
        if (!toast) return;
        if (animRef.current) {
            animRef.current.kill();
            animRef.current = null;
        }
        if (ref.current) {
            gsap.set(ref.current, {y: 8, opacity: 0, scale: 0.985});
            animRef.current = gsap.to(ref.current, {
                y: 0,
                opacity: 1,
                scale: 1,
                duration: 0.18,
                ease: "power2.out",
            });
        }

        timeoutRef.current = setTimeout(() => {
            if (ref.current) {
                animRef.current = gsap.to(ref.current, {
                    y: 12,
                    opacity: 0,
                    scale: 0.985,
                    duration: 0.18,
                    ease: "power2.in",
                    onComplete: () => onDone(toast.id),
                });
            } else {
                onDone(toast.id);
            }
        }, toast.timeout);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            if (animRef.current) {
                animRef.current.kill();
                animRef.current = null;
            }
        };
    }, [toast, onDone]);

    const cls =
        toast.type === "error"
            ? "bg-red-500 text-white"
            : toast.type === "info"
            ? "bg-blue-500 text-white"
            : "bg-green-500 text-black";

    return (
        <div
            ref={ref}
            className={`${cls} font-quicksand font-[600] p-4 rounded-md text-sm sm:text-base shadow-md transform`}
            style={{marginTop: index === 0 ? 0 : 8}}
        >
            {toast.message}
        </div>
    );
}

export default function Notification() {
    const {toasts, removeToast} = useNotificationContext();
    return (
        toasts?.length > 0 && (
            <div className="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-2 mx-8 sm:mx-0">
                {toasts.map((t, i) => (
                    <Toast key={t.id} toast={t} index={i} onDone={removeToast} />
                ))}
            </div>
        )
    );
}
