'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import { useNotificationContext } from './NotificationContext';
import gsap from 'gsap';


const ListContext = createContext();

export const ListProvider = ({ children }) => {
    const WP_API_BASE = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';
    const { showNotification } = useNotificationContext();

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


        const res = await sendApiRequest(url, method, listData.token, body);
        return res;
    };

    // Fetch shopping lists for the user
    const getShoppingList = async (userId, token) => {
        // Change to ASCENDING order to match typical UI expectations
        const url = `${WP_API_BASE}/wp/v2/shopping-list?orderby=menu_order&order=asc&per_page=100`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            const data = await response.json();
            const result = Array.isArray(data)
                ? data.filter(list => list.acf?.owner_id === userId)
                : [];
            console.log("Fetched Lists:", result);
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
            // play animation of list being deleted

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



    return (
        <ListContext.Provider value={{
            shoppingList,
            setShoppingList,
            sendApiRequest,
            createShoppingList,
            userLists,
            getShoppingList,
            setUserLists,
            deleteList
        }}>
            {children}
        </ListContext.Provider>
    );
};



export const useListContext = () => useContext(ListContext);
