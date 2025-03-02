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

	return (
		<NotificationContext.Provider value={{
			notification,
			showNotification
		}}>
			{children}
		</NotificationContext.Provider>
	);
};

export const useNotificationContext = () => useContext(NotificationContext);
