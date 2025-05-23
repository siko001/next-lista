"use client"
import { createContext, useContext, useState, useRef, useEffect } from 'react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
	const [queue, setQueue] = useState([]);
	const [current, setCurrent] = useState(null);
	const timeoutRef = useRef(null);

	// Show notification: add to queue
	const showNotification = (message, type, timeout = 3000) => {
		setQueue(prev => {
			if (prev.some(n => n.message === message && n.type === type)) {
				return prev;
			}
			return [...prev, { message, type, timeout }];
		});
	};


	// Clear current notification and move to next in queue
	const clearNotification = () => {
		setCurrent(null);
		setQueue(prev => prev.slice(1));
	};

	// Display next notification when current is cleared
	useEffect(() => {
		if (!current && queue.length > 0) {
			setCurrent(queue[0]);
		}
	}, [queue, current]);

	// Handle auto-dismiss
	useEffect(() => {
		if (current) {
			timeoutRef.current = setTimeout(() => {
				clearNotification();
			}, current.timeout);
			return () => clearTimeout(timeoutRef.current);
		}
	}, [current]);

	return (
		<NotificationContext.Provider value={{
			notification: current,
			showNotification,
			clearNotification
		}}>
			{children}
		</NotificationContext.Provider>
	);
};

export const useNotificationContext = () => useContext(NotificationContext);
