"use client";
import {createContext, useContext, useState, useRef, useEffect} from "react";

const NotificationContext = createContext();

export const NotificationProvider = ({children}) => {
    const [queue, setQueue] = useState([]);
    const [current, setCurrent] = useState(null);
    const timeoutRef = useRef(null);
    const isAnimatingRef = useRef(false);

    // Show notification: add to queue
    const showNotification = (message, type, timeout = 3000) => {
        setQueue((prev) => {
            // Prevent duplicate notifications that are too close together
            if (prev.some((n) => n.message === message && n.type === type)) {
                return prev;
            }
            // Add unique ID to each notification
            return [...prev, {message, type, timeout, id: Date.now()}];
        });
    };

    // Clear current notification and move to next in queue
    const clearNotification = () => {
        isAnimatingRef.current = false;
        setCurrent(null);
        setQueue((prev) => prev.slice(1));
    };

    // Display next notification when current is cleared
    useEffect(() => {
        if (!current && queue.length > 0 && !isAnimatingRef.current) {
            isAnimatingRef.current = true;
            setCurrent(queue[0]);
        }
    }, [queue, current]);

    // Handle auto-dismiss with proper cleanup
    useEffect(() => {
        if (current && !timeoutRef.current) {
            timeoutRef.current = setTimeout(() => {
                timeoutRef.current = null;
                clearNotification();
            }, current.timeout + 1000); // Add 1s buffer for animation
        }
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [current]);

    return (
        <NotificationContext.Provider
            value={{
                notification: current,
                showNotification,
                clearNotification,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotificationContext = () => useContext(NotificationContext);
