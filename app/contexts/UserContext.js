"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { setCookie, getCookie, deleteCookie } from 'cookies-next'; // Cookie library
import CryptoJS from 'crypto-js'; // Encryption library
import { useListContext } from './ListContext';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
	const [userData, setUserData] = useState(null);
	const [token, setToken] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const { setUserLists } = useListContext();

	// Base URL for your WordPress site
	const WP_API_BASE = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';

	// Encryption key (store this securely, e.g., in environment variables)
	const SECRET_KEY = 'your-secret-key-123';

	// Function to encrypt data
	const encryptData = (data) => {
		return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
	};

	// Function to decrypt data
	const decryptData = (ciphertext) => {
		const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
		return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
	};

	// Function to create a new user
	const createUser = async () => {
		try {
			const res = await fetch(`${WP_API_BASE}/custom/v1/create-user`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});

			if (!res.ok) throw new Error('Failed to create user');

			return await res.json();
		} catch (err) {
			throw new Error(err.message || 'User creation error');
		}
	};

	// Function to generate a JWT token
	const generateToken = async (username) => {
		try {
			const res = await fetch(`${WP_API_BASE}/jwt-auth/v1/token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password: 'lista123' }),
			});

			if (!res.ok) throw new Error('Failed to generate token');

			return await res.json();
		} catch (err) {
			throw new Error(err.message || 'Token generation error');
		}
	};

	// Function to fetch user data
	const fetchUserData = async (token) => {
		try {
			const res = await fetch(`${WP_API_BASE}/custom/v1/user-data`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
			});

			if (!res.ok) throw new Error('Failed to fetch user data');
			return await res.json();
		} catch (err) {
			throw new Error(err.message || 'User data fetch error');
		}
	};

	// Function to log out the user
	const logout = () => {
		deleteCookie('token'); // Remove the cookie
		deleteCookie('registered'); // Remove the cookie
		deleteCookie('id');
		deleteCookie('username'); // Remove the cookie
		setUserData(null);
		setToken(null);
		setUserLists(null);
	};

	// Initialization function
	const initializeUser = async () => {
		try {
			let storedToken = null;
			// Check for existing token in cookies
			const encryptedToken = getCookie('token');
			if (encryptedToken) {
				storedToken = decryptData(encryptedToken);
			}
			if (!storedToken) {
				// No token? Create a new user and generate a token
				const newUser = await createUser();
				const tokenData = await generateToken(newUser.username);

				// Encrypt and store the token in a cookie
				const encryptedToken = encryptData(tokenData.token);

				// Set the token cookie
				setCookie('token', encryptedToken, {
					// httpOnly: true, // Prevent client-side access
					secure: process.env.NODE_ENV === 'production',
					sameSite: 'strict', // Prevent CSRF attacks
					maxAge: 60 * 60 * 24 * 7, // 1 week
				});

				// Set the registration cookie
				setCookie('registered', "no", {
					// httpOnly: true, // Prevent client-side access
					secure: process.env.NODE_ENV === 'production',
					sameSite: 'strict', // Prevent CSRF attacks
					maxAge: 60 * 60 * 24 * 7, // 1 week
				});

				setCookie('id', newUser.user_id, {
					// httpOnly: true, // Prevent client-side access
					secure: process.env.NODE_ENV === 'production',
					sameSite: 'strict', // Prevent CSRF attacks
					maxAge: 60 * 60 * 24 * 7, // 1 week
				})


				setUserData({ id: newUser.user_id, username: newUser.username, email: newUser.email, name: newUser.name });

				setToken(tokenData.token);
			} else {
				// Token exists? Fetch user data
				fetchUserData(storedToken).then((data) => {
					setUserData(data);

				});

				setToken(storedToken);
			}

		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		initializeUser();
	}, []);

	return (
		<UserContext.Provider value={{
			userData,
			setUserData,
			token,
			loading,
			error,
			logout
		}}>
			{children}
		</UserContext.Provider>
	);
};

export const useUserContext = () => useContext(UserContext);