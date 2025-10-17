"use client";
import {
    createContext,
    useContext,
    useState,
    useRef,
    useEffect,
    useCallback,
    useMemo,
} from "react";

const NotificationContext = createContext();

export const NotificationProvider = ({children}) => {
    const [toasts, setToasts] = useState([]);
    const lastToastRef = useRef({message: null, time: 0});

    // Show notification: add to queue
    const showNotification = useCallback((message, type, timeout = 3000) => {
        const now = Date.now();
        // Drop duplicate notifications within 1500ms
        if (
            lastToastRef.current.message === message &&
            now - lastToastRef.current.time < 1500
        ) {
            return;
        }
        lastToastRef.current = {message, time: now};

        setToasts((prev) => [
            ...prev,
            {id: now + Math.random(), message, type, timeout},
        ]);
    }, []);

    // Remove a toast by id
    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const contextValue = useMemo(
        () => ({
            // Backward-compat: expose first toast as `notification`
            notification: toasts.length > 0 ? toasts[0] : null,
            toasts,
            showNotification,
            removeToast,
        }),
        [toasts, showNotification, removeToast]
    );

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotificationContext = () => useContext(NotificationContext);
