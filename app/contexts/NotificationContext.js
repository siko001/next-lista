'use client';
import {createContext, useContext, useState} from 'react';

const NotificationContext = createContext();

export const NotificationProvider = ({children}) => {
	const [notification, setNotification] = useState({
		message: null,
		type: null,
		timeout: null
	});

	const showNotification = (message, type, timeout = 3000) => {
		setNotification({
			message,
			type,
			timeout
		});
	};

const clearNotification = () => {
		setNotification({
			message: null,
			type: null,
			timeout: null
		});
	};

	return (
		<NotificationContext.Provider value={{
			notification,
			showNotification,
			clearNotification
		}}>
			{children}
		</NotificationContext.Provider>
	);
};

export const useNotificationContext = () => useContext(NotificationContext);
