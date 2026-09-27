"use client";
import {gsap} from "gsap";

import {createContext, useContext, useEffect, useState} from "react";
import {useValidationContext} from "./ValidationContext";
import {useLoadingContext} from "./LoadingContext";
import SingleInput from "../components/parts/SingleInput";
import {decodeHtmlEntities} from "../lib/helpers";

const OverlayContext = createContext();

export const OverlayProvider = ({children}) => {

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
        gsap.to("#overlay-backdrop", {opacity: 0, duration: 0.18});
        gsap.to("#overlay-content", {
            scale: 0.97,
            y: 8,
            opacity: 0,
            duration: 0.18,
            ease: "power2.in",
            onComplete: () => {
                setHasTyped(false);
                setOverlay(false);
                setOverlayContent(null);
                setErrors({message: null});
            },
        });
    };

    const showVerbConfirmation = (list, token, verb, userId) => {
        const action = verb.toLowerCase();
        const descriptions = {
            delete: "This will remove the list and all of its products from your shopping lists.",
            empty: "This will remove every product from this list. The list itself will stay.",
            remove: "This will remove the shared list from your lists.",
        };
        setOverlay(true);
        setOverlayContent({
            title: `${verb} this list?`,
            listTitle: decodeHtmlEntities(list.title || "Shopping list"),
            description: descriptions[action],
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
