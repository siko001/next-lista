'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import { useNotificationContext } from './NotificationContext';
import gsap from 'gsap';


const ListContext = createContext();

export const ListProvider = ({ children }) => {
    const WP_API_BASE = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';
    const { showNotification } = useNotificationContext();
    const [hasDeletedLists, setHasDeletedLists] = useState(false);
    const [shoppingList, setShoppingList] = useState({
        name: "",
        userId: null,
        userToken: null,
    });

    const [userLists, setUserLists] = useState([]);

    // Create List
    const createShoppingList = async (listData) => {
        // Find the minimum menu_order value
        const minMenuOrder = userLists.reduce((min, list) => {
            return Math.min(min, list.menu_order || 0);
        }, 0);

        // Set new menu_order to be 1 less than the current minimum
        const newMenuOrder = minMenuOrder - 1;

        const url = `${WP_API_BASE}/wp/v2/shopping-list`;
        const method = "POST";

        const body = {
            title: listData.name,
            status: "publish",
            menu_order: newMenuOrder, // This ensures it appears first
            acf: {
                owner_id: listData.userId,
                owner_token: listData.token,
            }

        };

        const res = await sendApiRequest(url, method, listData.token, body);
        return res;
    };

    // Fetch shopping lists for the user
    const getShoppingList = async (userId, token) => {
        // Change to ASCENDING order to match typical UI expectations
        const url = `${WP_API_BASE}/custom/v1/shopping-lists-by-owner/${userId}`;
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            const data = await response.json();
            console.log("Fetched lists:", data);
            const result = Array.isArray(data)
                ? data.filter(list => list.acf?.owner_id == userId)
                : [];

            // sort by menu_order
            result.sort((a, b) => {
                return a.menu_order - b.menu_order;
            }
            );
            setUserLists(result);

            return result;
        } catch (error) {
            console.error("Failed to fetch lists:", error);
            return [];
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


    const deleteList = async (listId, token) => {
        const url = `${WP_API_BASE}/wp/v2/shopping-list/${listId}`;
        const method = "DELETE";

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });


            if (!response.ok) {
                throw new Error("Failed to delete list");
            }

            const data = await response.json();

            setHasDeletedLists(true);
            gsap.fromTo(`#list-${listId}`,
                {
                    opacity: 1,
                    border: "1px solid #ff0000",
                    duration: 0.5,
                },
                {
                    opacity: 0,
                    y: 100,
                    ease: "power2.out",
                    duration: 0.8,
                    onComplete: () => {
                        setUserLists(prevLists => prevLists.filter(list => list.id !== listId));
                        showNotification("List deleted successfully", "success");
                    }
                });


        } catch (error) {
            console.error("Delete List Failed:", error);
        }
    };


    const copyShoppingList = async (listId, token) => {
        if (!listId || !token) return null;

        try {
            // Get current minimum menu_order from existing lists
            const minMenuOrder = userLists.reduce((min, list) => {
                return Math.min(min, list.menu_order || 0);
            }, 0);

            const newMenuOrder = minMenuOrder - 1;

            const response = await fetch(`${WP_API_BASE}/custom/v1/copy-shopping-list`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    source_list_id: listId,
                    new_menu_order: newMenuOrder  // Pass the calculated order to backend
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Ensure the response includes our new menu_order
            return {
                ...data,
                menu_order: newMenuOrder
            };

        } catch (error) {
            console.error('Error copying shopping list:', error);
            return null;
        }
    };


    return (
        <ListContext.Provider value={{
            shoppingList,
            setShoppingList,
            sendApiRequest,
            hasDeletedLists,
            createShoppingList,
            userLists,
            getShoppingList,
            setUserLists,
            deleteList,
            copyShoppingList
        }}>
            {children}
        </ListContext.Provider>
    );
};



export const useListContext = () => useContext(ListContext);
