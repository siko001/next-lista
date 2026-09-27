"use client";
import {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    useEffect,
} from "react";
import {useNotificationContext} from "./NotificationContext";
import {decryptToken, WP_API_BASE} from "../lib/helpers";
import {cachedRead, cachedValue, seedCache, invalidateListData, cacheKeys, CACHE_TTL} from "../lib/dataCache.mjs";
import gsap from "gsap";
const ListContext = createContext();
import {createSmoothScroller} from "../lib/smoothScroll";
import "lenis/dist/lenis.css";

export const ListProvider = ({children}) => {
    const lenis = useRef(null);
    useEffect(() => {
        const scroller = createSmoothScroller();
        lenis.current = scroller.instance;
        return () => {
            scroller.destroy();
            lenis.current = null;
        };
    }, []);

    const {showNotification} = useNotificationContext();
    const [isInInnerList, setIsInnerList] = useState(false);
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
    const [listPreview, setListPreview] = useState(null);
    const [listsLoaded, setListsLoaded] = useState(false);
    const listsOwnerRef = useRef(null);

    // Keep the current user's list summaries warm after optimistic edits and
    // realtime events. Never put the JWT or a list from another account in a key.
    useEffect(() => {
        if (listsLoaded && listsOwnerRef.current && Array.isArray(userLists)) {
            seedCache(cacheKeys.lists(listsOwnerRef.current), userLists, CACHE_TTL.lists);
        }
    }, [userLists, listsLoaded]);

    const hydrateUserLists = (userId, serverLists) => {
        if (!userId || !Array.isArray(serverLists)) return;
        const sameActiveUser = listsLoaded && listsOwnerRef.current === String(userId)
            && cachedValue(cacheKeys.lists(userId)) !== undefined;
        listsOwnerRef.current = String(userId);
        const initial = sameActiveUser ? userLists : serverLists;
        setUserLists(initial);
        seedCache(cacheKeys.lists(userId), initial, CACHE_TTL.lists);
        setListsLoaded(true);
    };

    const clearUserLists = useCallback(() => {
        listsOwnerRef.current = null;
        setUserLists([]);
        setListsLoaded(false);
    }, []);

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
            },
        };

        const res = await sendApiRequest(url, method, listData.token, body);
        if (res?.id && !res?.code) invalidateListData(listData.userId);
        return res;
    };

    // Fetch shopping lists for the user
    const getShoppingList = async (userId, token, {force = false} = {}) => {
        const url = `${WP_API_BASE}/custom/v1/shopping-lists-by-owner/${userId}`;

        try {
            const load = async () => {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    cache: "no-store",
                });
                if (!response.ok) throw new Error("Failed to fetch lists");

                const data = await response.json();
                if (!Array.isArray(data)) throw new Error("Invalid list response");
                const filteredLists = data.filter((list) => {
                    const isOwner = list?.acf?.owner_id == userId;
                    const isShared = Array.isArray(list?.acf?.shared_with_users) &&
                        list.acf.shared_with_users.some((user) => user.ID == userId);
                    return isOwner || isShared;
                });
                filteredLists.sort((a, b) => a.menu_order - b.menu_order);
                return filteredLists;
            };
            const filteredLists = await cachedRead(cacheKeys.lists(userId), CACHE_TTL.lists, load, {force});
            listsOwnerRef.current = String(userId);
            setUserLists(filteredLists);
            setListsLoaded(true);
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
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error(`API request failed (${response.status})`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("API Request Failed:", error);
        }
    }, []);

    const deleteList = async (listId, token, state) => {
        if (!listId || !token) return null;
        const url = `${WP_API_BASE}/wp/v2/shopping-list/${listId}`;
        const method = "DELETE";

        let decryptedToken;
        if (state && state === "autoDelete") {
            decryptedToken = decryptToken(token);
        }

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${
                        decryptedToken &&
                        (decryptedToken !== null ||
                            decryptedToken !== undefined)
                            ? decryptedToken
                            : token
                    }`,
                },
            });
            if (!response.ok) {
                throw new Error("Failed to delete list");
            }

            await response.json();
            setHasDeletedLists(true);
            invalidateListData(listsOwnerRef.current);
            const removeFromView = () => {
                setUserLists((prevLists) => prevLists.filter((list) => String(list.id) !== String(listId)));
                showNotification("List deleted successfully", "success");
            };
            const element = document.getElementById(`list-${listId}`);
            if (element) {
                gsap.to(element, {opacity: 0, y: 100, duration: 0.45, ease: "power2.out", onComplete: removeFromView});
            } else {
                removeFromView();
            }
            return true;
        } catch (error) {
            console.error("Delete List Failed:", error);
            showNotification("Failed to delete list", "error");
            return null;
        }
    };

    const copyShoppingList = async (listId, token) => {
        if (!listId || !token) return null;

        try {
            // Use the exact same menu order as the original list
            const originalList = userLists.find((list) => list.id === listId);
            if (!originalList) return null;

            const response = await fetch(
                `${WP_API_BASE}/custom/v1/copy-shopping-list`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        source_list_id: listId,
                        new_menu_order: originalList.menu_order,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error("Failed to copy list");
            }

            // Fetch the fresh list data
            const freshListResponse = await fetch(
                `${WP_API_BASE}/wp/v2/shopping-list/${data.list.id}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!freshListResponse.ok) {
                throw new Error("Failed to fetch fresh list data");
            }

            const freshList = await freshListResponse.json();
            invalidateListData(listsOwnerRef.current);

            // Return the fresh list data with properly formatted title and same menu order
            return {
                success: true,
                list: {
                    ...freshList,
                    title: freshList.title.rendered || data.list.title,
                    menu_order: originalList.menu_order,
                    acf: {
                        ...freshList.acf,
                        product_count: data.list.acf.product_count || 0,
                        bagged_product_count: 0,
                    },
                },
            };
        } catch (error) {
            console.error("Error copying shopping list:", error);
            return null;
        }
    };

    // REMANE LIST STUFF
    const handleRenameInput = (e) => {
        let input = e.target.value;
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
    };

    const handleRenameList = async (value, token, view) => {
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
            const response = await fetch(
                `${WP_API_BASE}/wp/v2/shopping-list/${listId}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${decryptedToken}`,
                    },
                    body: JSON.stringify(updateData),
                }
            );

            if (!response.ok) throw new Error("Failed to update");

            const data = await response.json();
            if (!data) {
                showNotification("Failed to update list", "error");
                setUserLists(userLists);
                return;
            }

            showNotification("List Renamed", "success", 1000);
            invalidateListData(listsOwnerRef.current);
            return;
        } catch (error) {
            console.error("Error updating list:", error);
            showNotification("Failed to update list", "error");
            setUserLists(userLists);
        }
    };

    return (
        <ListContext.Provider
            value={{
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
                hydrateUserLists,
                clearUserLists,
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
                listPreview,
                setListPreview,
                listsLoaded,
                lenis,
                isInInnerList,
                setIsInnerList,
            }}
        >
            {children}
        </ListContext.Provider>
    );
};

export const useListContext = () => useContext(ListContext);
