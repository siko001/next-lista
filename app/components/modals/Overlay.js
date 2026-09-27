import gsap from "gsap";
import {useEffect} from "react";
import {useOverlayContext} from "../../contexts/OverlayContext";

import CloseIcon from "../svgs/CloseIcon";
import Button from "../Button";

export default function Overlay({handleDeleteList, handleEmptyList}) {
    const {closeOverlay, overlayContent, convertContentToComponent} =
        useOverlayContext();
    const isDestructive = ["delete-a-list", "empty-a-list", "remove-a-list"].includes(overlayContent?.action?.toLowerCase());
    const isCreateList = overlayContent?.action === "create-a-list";

    useEffect(() => {
        // trigger gsap animation when overlay is opening
        gsap.fromTo(
            "#overlay-backdrop",
            {opacity: 0},
            {opacity: 1, duration: 0.5}
        );
        gsap.fromTo(
            "#overlay-content",
            {scale: 0.97, y: 12, opacity: 0},
            {scale: 1, y: 0, opacity: 1, duration: 0.3, delay: 0.08, ease: "power2.out"}
        );

        const closeOnEsc = (e) => {
            if (e.key === "Escape") return closeOverlay();
        };

        window.addEventListener("keydown", closeOnEsc);
        return () => window.removeEventListener("keydown", closeOnEsc);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            className="app-dialog-layer fixed z-50 inset-0 grid place-items-center overlay"
        >
            <div
                id={"overlay-backdrop"}
                className="app-dialog-backdrop absolute inset-0 opacity-0 w-full h-full z-10"
            ></div>

            <section
                id={"overlay-content"}
                role="dialog"
                aria-modal="true"
                aria-labelledby="app-dialog-title"
                className={`app-dialog z-20 relative ${isCreateList ? "app-dialog-create" : ""} ${isDestructive ? "app-dialog-confirm" : ""}`}
            >
                <button type="button" className="app-dialog-close" onClick={closeOverlay} aria-label="Close dialog">
                    <CloseIcon className="w-6 h-6" aria-hidden="true" />
                </button>

                {overlayContent?.title && (
                    <div className="app-dialog-heading">
                        {isCreateList && <p className="app-dialog-eyebrow">YOUR SHOPPING LIST</p>}
                        {isDestructive && <p className="app-dialog-eyebrow">CONFIRM ACTION</p>}
                        <h2 id="app-dialog-title">{overlayContent.title}</h2>
                        {isCreateList && <p className="app-dialog-description">Give your list a name to start adding products.</p>}
                    </div>
                )}

                {isDestructive && <>
                    <div className="app-dialog-list-preview">
                        <span>Shopping list</span>
                        <strong>{overlayContent.listTitle}</strong>
                    </div>
                    <p className="app-dialog-confirm-description">{overlayContent.description}</p>
                </>}

                {overlayContent?.content &&
                    convertContentToComponent(overlayContent.content)}

                <div className="app-dialog-actions">
                    {overlayContent?.cancelAction && (
                        <Button
                            cta={"Cancel"}
                            action={"close-overlay"}
                            overrideDefaultClasses="app-secondary-action"
                        />
                    )}

                    {overlayContent?.action && (
                        <Button
                            cta={overlayContent.cta}
                            action={overlayContent.action}
                            textColorOverride={"text-white"}
                            overrideDefaultClasses={isDestructive ? "app-danger-action" : "app-primary-action"}
                            handleEmptyList={handleEmptyList}
                            handleDeleteList={handleDeleteList}
                            data={overlayContent.data}
                        />
                    )}
                </div>
            </section>
        </div>
    );
}
