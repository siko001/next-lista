'use client';

import {createContext, useContext, useEffect, useState} from 'react';

const UserContext = createContext();

export const UserProvider = ({children}) => {
	const [userData, setUserData] = useState(null);
	const [token, setToken] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Base URL for your WordPress site
	const WP_API_BASE = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';

	// Function to create a new user
	const createUser = async() => {
		try {
			const res = await fetch(`${WP_API_BASE}/custom/v1/create-user`, {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
			});

			if(!res.ok) throw new Error('Failed to create user');

			return await res.json();
		} catch(err) {
			throw new Error(err.message || 'User creation error');
		}
	};

	// Function to generate a JWT token
	const generateToken = async(username) => {
		try {
			const res = await fetch(`${WP_API_BASE}/jwt-auth/v1/token`, {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({username, password: 'lista123'}),
			});

			if(!res.ok) throw new Error('Failed to generate token');

			return await res.json();
		} catch(err) {
			throw new Error(err.message || 'Token generation error');
		}
	};

	const fetchUserData = async(token) => {
		try {
			const res = await fetch(`${WP_API_BASE}/custom/v1/user-data`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
			});

			if(!res.ok) throw new Error('Failed to fetch user data');

			return await res.json();
		} catch(err) {
			throw new Error(err.message || 'User data fetch error');
		}
	};


	// Initialization function
	const initializeUser = async() => {
		try {
			const storedToken = localStorage.getItem('jwt_token');

			if(!storedToken) {
				// No token? Create a new user and generate a token
				const newUser = await createUser();
				const tokenData = await generateToken(newUser.username);

				// Store token in localStorage
				localStorage.setItem('jwt_token', tokenData.token);

				setUserData({id: newUser.user_id, username: newUser.username});
				setToken(tokenData.token);
			} else {
				// Token exists? Fetch user data
				fetchUserData(storedToken).then((data) => {
					setUserData(data);
				});
				setToken(storedToken);

			}

		} catch(err) {
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
			token,
			loading,
			error
		}}>
			{children}
		</UserContext.Provider>
	);
};

export const useUserContext = () => useContext(UserContext);
