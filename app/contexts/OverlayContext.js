"use client";
import {gsap} from "gsap";

import {createContext, useContext, useEffect, useState} from "react";
import {useValidationContext} from "./ValidationContext";
import {useLoadingContext} from "./LoadingContext";
import SingleInput from "../components/parts/SingleInput";
import {useListContext} from "./ListContext";

const OverlayContext = createContext();

export const OverlayProvider = ({children}) => {
    const {listName} = useListContext();

    const {setLoading} = useLoadingContext();
    const {setErrors, setHasTyped} = useValidationContext();
    const [overlay, setOverlay] = useState(null);
    const [overlayContent, setOverlayContent] = useState({
        title: null,
        content: null,
        action: null,
        cancelAction: false,
    });

    const convertContentToComponent = (content) => {
        if (!content) return null;
        switch (content) {
            case "single-input":
                return <SingleInput />;

            default:
                return null;
        }
    };

    const closeOverlay = () => {
        // Start closing animation
        setLoading(false);
        gsap.to("#overlay-backdrop", {opacity: 0, duration: 0.1});
        gsap.to("#overlay-content", {
            scale: 0,
            opacity: 0,
            duration: 0.2,
            delay: 0.25,
            onComplete: () => {
                setHasTyped(false);
                setOverlay(false);
                setOverlayContent(null);
                setErrors(false);
            },
        });
    };

    const showVerbConfirmation = (list, token, verb, userId) => {
        // Open a modal or dialog to confirm the action
        const titlesToCheck = [
            "list",
            "shopping list",
            "lista",
            "list name",
            "list name here",
            "list name goes here",
            "lista de compras",
            "lista de compras aqui",
            "lista de compras vai aqui",
            "shopping list here",
            "shopping list goes here",
            "shopping list name",
            "shopping list name here",
            "shopping list name goes here",
        ];

        setOverlay((prev) => !prev);

        setOverlayContent({
            title: `Are you sure you want to ${verb.toLowerCase()} ${
                !titlesToCheck.includes(list.title.toLowerCase())
                    ? ("list " + listName && listName) || list.title
                    : "this list"
            }?`,
            action: `${verb}-a-list`,
            cta: `${verb} list`,
            cancelAction: true,
            data: [list, token, userId],
        });
    };

    return (
        <OverlayContext.Provider
            value={{
                overlay,
                setOverlay,
                overlayContent,
                setOverlayContent,
                closeOverlay,
                convertContentToComponent,
                showVerbConfirmation,
            }}
        >
            {children}
        </OverlayContext.Provider>
    );
};

export const useOverlayContext = () => useContext(OverlayContext);
