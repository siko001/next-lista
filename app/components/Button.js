"use client";
import {removeListRelationship} from "../lib/helpers";
import {useOverlayContext} from "../contexts/OverlayContext";
import {useNotificationContext} from "../contexts/NotificationContext";
import {useValidationContext} from "../contexts/ValidationContext";
import {useLoadingContext} from "../contexts/LoadingContext";
import {useListContext} from "../contexts/ListContext";
import {useUserContext} from "../contexts/UserContext";
import {useEffect} from "react";
import gsap from "gsap";

export default function Button(props) {
    const {setOverlay, setOverlayContent, closeOverlay} = useOverlayContext();
    const {shoppingList, createShoppingList, getShoppingList, setUserLists} =
        useListContext();
    const {userData, token} = useUserContext();
    const {errors, setErrors, hasTyped} = useValidationContext();
    const {showNotification} = useNotificationContext();
    const {setLoading} = useLoadingContext();

    useEffect(() => {
        if (props.action === "add-product-overlay") {
            gsap.set(".open-product-overlay", {
                y: 200,
                opacity: 1,
            });
            gsap.to(".open-product-overlay", {
                y: 0,
                duration: 0.5,
                ease: "power2.out",
            });
        }
    }, [props.action]);

    useEffect(() => {
        // submit on enter
        const handleKeyDown = (e) => {
            if (e.key === "Enter") {
                handleClick();
            }
        };
        if (props.action === "create-a-list") {
            window.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    });

    const handleClick = async () => {
        if (errors.message) return;

        const action = props.action.toLowerCase();

        // Open ALl Products Overlay
        if (action === "add-product-overlay") {
            props.setProductOverlay(true);
            return;
        }

        // Close All Products Overlay
        if (action === "close-product-overlay") {
            props.setProductOverlay(false);
            return;
        }

        // Delete a list
        if (action === "delete-a-list") {
            const listId = props.data[0].id;
            const token = props.data[1];
            props.handleDeleteList(listId, token);
            setOverlay((prev) => !prev);
            return;
        }

        if (action === "empty-a-list") {
            const listId = props.data[0].id;
            const token = props.data[1];
            props.handleEmptyList(listId, token);
            setOverlay((prev) => !prev);
            return;
        }

        if (action === "create-list") {
            setOverlay((prev) => !prev);
            setOverlayContent({
                title: "Create a new list",
                content: "single-input",
                action: "create-a-list",
                cta: "Create list",
                cancelAction: true,
            });
            return;
        }

        // Remove a list from shared list
        if (
            props.action === "remove-a-list" ||
            props.action === "Remove-a-list"
        ) {
            const listId = props.data[0].id;
            const token = props.data[1];
            const userId = props.data[2];
            setOverlay((prev) => !prev);

            if (props.action === "Remove-a-list") {
                // Store the removal data in sessionStorage
                const removeData = {
                    listId: props.data[0].id,
                    userId: props.data[2],
                    token: props.data[1],
                };
                sessionStorage.setItem(
                    "removeListData",
                    JSON.stringify(removeData)
                );
                window.location.href = "/";
                return;
            }

            removeListRelationship(listId, userId, token);
            gsap.fromTo(
                `#list-${listId}`,
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
                        setUserLists((prevLists) =>
                            prevLists.filter((list) => list.id !== listId)
                        );
                    },
                }
            );
            return;
        }

        if (props.action === "create-a-list") {
            try {
                if (!hasTyped)
                    return setErrors({message: "List Name required"});
                if (errors.message) return;
                setLoading(true);

                const data = {
                    name: shoppingList.name,
                    userId: userData.id,
                    token: token,
                };

                // Call the createShoppingList function
                const res = await createShoppingList(data);
                const allLists = await getShoppingList(userData.id, token);

                if (res) {
                    // Add animation state to the new list
                    const listsWithAnimation = allLists.map((list) => ({
                        ...list,
                        isNew: list.id === res.id, // Mark the new list
                    }));

                    setUserLists(listsWithAnimation);

                    // Remove the animation after 5 seconds
                    setTimeout(() => {
                        setUserLists((prev) =>
                            prev.map((list) => ({
                                ...list,
                                isNew: false,
                            }))
                        );
                    }, 3000);

                    showNotification(
                        `List ${res.title.raw} created`,
                        "success",
                        2000
                    );
                    closeOverlay();
                } else {
                    showNotification("Error creating list", "error", 2000);
                    closeOverlay();
                }
            } catch (err) {
                console.error("Error creating list:", err);
                showNotification("Error creating list", "error", 2000);
                closeOverlay();
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <button
            onClick={() => {
                if (props.action === "close-overlay") {
                    closeOverlay();
                } else {
                    handleClick();
                }
            }}
            className={`relative  cursor-pointer z-20 group ${
                props.overrideDefaultClasses
                    ? props.overrideDefaultClasses
                    : "bg-blue-800 text-primary"
            }  px-6 py-3 md:px-8 md:py-4 rounded-md overflow-hidden`}
        >
            <p
                className={`z-20 relative delay-75 font-bold  ${
                    props.hover && props.light
                        ? "group-hover:text-white"
                        : "group-hover:text-black"
                } transition-colors duration-200   ${
                    props.textColorOverride && props.textColorOverride
                }`}
            >
                {props.cta}
            </p>

            {props.hover && props.hover === "inwards" && (
                <>
                    <span
                        style={{backgroundColor: props.color}}
                        className={`absolute z-10 -top-1 -left-1 md:-top-2 md:-left-2 w-1/12 h-1/12 transition-all duration-300 ease-in group-hover:w-[102%] group-hover:h-[102%] md:group-hover:w-[105%] md:group-hover:h-[105%]`}
                    ></span>
                    <span
                        style={{backgroundColor: props.color}}
                        className={`absolute z-10 -bottom-1 -right-1 md:-bottom-2 md:-right-2 w-1/12 h-1/12 transition-all duration-300 ease-in group-hover:w-[102%] group-hover:h-[102%] md:group-hover:w-[105%] md:group-hover:h-[105%]`}
                    ></span>
                </>
            )}

            {props.hover && props.hover === "borders" && (
                <>
                    <span
                        style={{backgroundColor: props.color}}
                        className={`absolute z-10 -top-0 -left-0 w-0 h-[3px] transition-all rounded-full duration-300 ease-in  group-hover:w-full`}
                    ></span>
                    <span
                        style={{backgroundColor: props.color}}
                        className={`absolute z-10 -bottom-0 -right-0 w-0 h-[3px] transition-all duration-300 ease-in group-hover:w- group-hover:w-full`}
                    ></span>
                    <span
                        style={{backgroundColor: props.color}}
                        className={`absolute z-10 -top-0 -right-0 h-0 w-[3px] transition-all duration-300 ease-in  group-hover:h-full`}
                    ></span>
                    <span
                        style={{backgroundColor: props.color}}
                        className={`absolute z-10 -bottom-0 -left-0 h-0 w-[3px] transition-all duration-300 ease-in  group-hover:h-full`}
                    ></span>
                </>
            )}
        </button>
    );
}
