'use client';
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNotificationContext } from './NotificationContext';
import { decryptToken, WP_API_BASE } from '../lib/helpers';
import gsap from 'gsap';
const ListContext = createContext();
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'


export const ListProvider = ({ children }) => {
    const lenis = useRef(null);
    useEffect(() => {
        lenis.current = new Lenis({
            duration: 2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smooth: true,
        });
        const raf = (time) => {
            lenis.current.raf(time);
            requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);
        return () => {
            lenis.current.destroy();
        };
    }, []);

    const { showNotification } = useNotificationContext();
    const [listRename, setListRename] = useState(false);
    const [hasDeletedLists, setHasDeletedLists] = useState(false);
    const [startingValue, setStartingValue] = useState(null);
    const listRenameRef = useRef(null);
    const innerListRef = useRef(null);
    const [listSettings, setListSettings] = useState(false);
    const [shoppingList, setShoppingList] = useState({
        name: "",
        userId: null,
        userToken: null,
    });
    const [startingInnerListName, setStartingInnerListName] = useState(null);
    const [userLists, setUserLists] = useState([]);
    const [listName, setListName] = useState();

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
            menu_order: newMenuOrder,
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
            // Filter lists where user is either owner or shared with
            const filteredLists = Array.isArray(data)
                ? data.filter(list => {
                    const isOwner = list?.acf?.owner_id == userId;
                    const isShared = list?.acf?.shared_with_users != false && list?.acf?.shared_with_users?.some(user => user.ID == userId);
                    return isOwner || isShared;
                })
                : [];

            // Sort by menu_order
            filteredLists.sort((a, b) => a.menu_order - b.menu_order);

            setUserLists(filteredLists);
            return filteredLists;
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



    // REMANE LIST STUFF
    const handleRenameInput = (e) => {
        let input = e.target.value
        if (input.length > 32) {
            input = input.slice(0, 32);
        }
        listRenameRef.current.value = input;
        setStartingValue(input.length);
    };

    const handleRenameClick = (id) => {
        if (listRename === id) {
            setListRename(false);
        } else {
            setStartingInnerListName(innerListRef.current?.innerText);
            setListRename(id);
            setTimeout(() => {
                listRenameRef.current.focus();
                // starting number
                setStartingValue(listRenameRef.current.value.length);
            }, 0);
        }
        setListSettings(false);
    }



    const handleRenameList = async (value, token, view) => {
        console.log(view)
        if (!value) return;
        const listId = listRename;
        const list = userLists.find((list) => list.id === listId);

        if (!list && view !== "in-list") return;

        // Prepare the update payload
        const updateData = {
            title: value,
        };

        if (view !== "in-list" && list.title === value) {
            setListRename(false);
            return;
        }

        if (view === "in-list" && startingInnerListName === value) {
            setListRename(false);
            return;
        }


        if (view === "in-list") {
            // Optimistic UI update
            setListName(value);
        }

        if (view === "in-list" && value) {
            console.log(value)
        }

        // Optimistic UI update
        if (view !== "in-list") {
            const updatedLists = userLists.map((list) =>
                list.id === listId
                    ? {
                        ...list,
                        title: value,
                    }
                    : list
            );
            setUserLists(updatedLists);

            // Reset UI states
            setListRename(false);
            setStartingValue(null);
        }


        // decrypt the token
        const decryptedToken = decryptToken(token);


        try {
            const response = await fetch(`${WP_API_BASE}/wp/v2/shopping-list/${listId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${decryptedToken}`
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) throw new Error('Failed to update');

            const data = await response.json();
            if (!data) {
                showNotification("Failed to update list", "error");
                setUserLists(userLists);
                return;
            }

            showNotification("List Renamed", "success", 1000);
            return
        } catch (error) {
            console.error("Error updating list:", error);
            showNotification("Failed to update list", "error");
            setUserLists(userLists);
        }
    }



    return (
        <ListContext.Provider value={{
            startingValue,
            setStartingValue,
            listRename,
            setListRename,
            shoppingList,
            setShoppingList,
            sendApiRequest,
            hasDeletedLists,
            createShoppingList,
            userLists,
            getShoppingList,
            setUserLists,
            deleteList,
            copyShoppingList,
            listSettings,
            setListSettings,
            listRenameRef,
            innerListRef,
            handleRenameInput,
            handleRenameClick,
            handleRenameList,
            listName,
            setListName,
        }}>
            {children}
        </ListContext.Provider>
    );
};



export const useListContext = () => useContext(ListContext);
