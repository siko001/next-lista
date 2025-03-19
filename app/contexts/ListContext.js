'use client';
import { createContext, useContext, useState, useCallback } from 'react';



const ListContext = createContext();

export const ListProvider = ({ children }) => {
    const WP_API_BASE = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';

    const [shoppingList, setShoppingList] = useState({
        name: "",
        userId: null,
        userToken: null,
    });

    const [userLists, setUserLists] = useState([]);

    // Create List
    const createShoppingList = async (listData) => {
        const url = `${WP_API_BASE}/wp/v2/shopping-list`;
        const method = "POST";

        const body = {
            title: listData.name,
            status: "publish",
            acf: {
                owner_id: listData.userId,
                owner_token: listData.token,
            }
        };

        // Send the request to create the shopping list and set ACF fields
        const res = await sendApiRequest(url, method, listData.token, body);

        return res; // Return the response so it can be handled by the calling function
    };

    // Fetch shopping lists for the user
    const getShoppingList = async (userId, token) => {
        const url = `${WP_API_BASE}/wp/v2/shopping-list`; // Filter by user ID

        const method = "GET";

        const res = await sendApiRequest(url, method, token);

        // Assuming the response contains the lists in an array format
        if (Array.isArray(res)) {
            // filter the lists by user ID
            const result = res.filter((list) => list.acf.owner_id === userId);
            setUserLists(result); // Update state with the lists
        } else {
            console.error("Failed to fetch lists:", res);
        }
    };

    // Base function to send API requests (export this to other contexts)
    const sendApiRequest = useCallback(async (url, method, token, body) => {
        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error("API Request Failed:", error);
        }
    }, []);

    return (
        <ListContext.Provider value={{
            shoppingList,
            setShoppingList,
            sendApiRequest,
            createShoppingList,
            userLists,
            getShoppingList,
            setUserLists
        }}>
            {children}
        </ListContext.Provider>
    );
};



export const useListContext = () => useContext(ListContext);
