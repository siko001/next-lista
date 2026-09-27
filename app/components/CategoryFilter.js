"use client";

import {useEffect, useRef, useState} from "react";
import {Check, ChevronDown, SlidersHorizontal} from "lucide-react";
import {createSmoothScroller} from "../lib/smoothScroll";
import {decodeHtmlEntities} from "../lib/helpers";

export default function CategoryFilter({
    categories = [],
    selectedCategories = [],
    onCategoryToggle = () => {},
    translateText = (_, source) => source,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const filterRef = useRef(null);
    const optionsRef = useRef(null);
    useEffect(() => {
        if (!isOpen || !optionsRef.current) return;
        const wrapper = optionsRef.current;
        const region = wrapper.closest(".picker-scroll-region");
        const fitOptions = () => {
            const bottom = region?.getBoundingClientRect().bottom || window.innerHeight;
            const available = bottom - wrapper.getBoundingClientRect().top - 24;
            wrapper.style.maxHeight = `${Math.max(64, Math.min(325, window.innerHeight * .42, available))}px`;
        };
        fitOptions();
        const scroller = createSmoothScroller({wrapper, content: wrapper.firstElementChild, overscroll: false});
        const observer = new ResizeObserver(fitOptions);
        if (region) observer.observe(region);
        region?.addEventListener("scroll", fitOptions, {passive: true});
        return () => {
            observer.disconnect();
            region?.removeEventListener("scroll", fitOptions);
            scroller.destroy();
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (event) => {
            if (!filterRef.current?.contains(event.target)) setIsOpen(false);
        };
        const onEscape = (event) => {
            if (event.key === "Escape") setIsOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onEscape);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onEscape);
        };
    }, [isOpen]);

    const label = selectedCategories.length === 0
        ? "All categories"
        : selectedCategories.length === 1
        ? decodeHtmlEntities(selectedCategories[0])
        : null;

    return (
        <div className="picker-category-filter" ref={filterRef}>
            <div className="picker-category-bar">
                <button
                    type="button"
                    className={`picker-category-trigger ${isOpen ? "is-open" : ""}`}
                    onClick={() => setIsOpen((open) => !open)}
                    aria-expanded={isOpen}
                    aria-controls="picker-category-options"
                >
                    <SlidersHorizontal size={17} aria-hidden="true" />
                    {label === null
                        ? <span>{selectedCategories.length} {translateText("picker-category:categories selected", "categories selected")}</span>
                        : translateText(`picker-category:${label}`, label)}
                    <ChevronDown size={17} aria-hidden="true" />
                </button>
                {selectedCategories.length > 0 && (
                    <button
                        type="button"
                        className="picker-category-clear"
                        onClick={() => onCategoryToggle("all")}
                    >
                        {translateText("picker-category:clear", "Clear filters")}
                    </button>
                )}
            </div>
            {isOpen && (
                <div className="picker-category-popover" id="picker-category-options">
                    <div className="picker-category-popover-header">
                        {translateText("picker-category:browse", "Browse categories")}
                        <button type="button" onClick={() => setIsOpen(false)}>{translateText("picker-category:done", "Done")}</button>
                    </div>
                    <div className="picker-category-options" ref={optionsRef} data-lenis-prevent>
                        <div className="picker-category-options-grid">
                        <button
                            type="button"
                            className={`picker-category-option ${selectedCategories.length === 0 ? "is-selected" : ""}`}
                            onClick={() => onCategoryToggle("all")}
                            aria-pressed={selectedCategories.length === 0}
                        >
                            {translateText("picker-category:All categories", "All categories")}
                            {selectedCategories.length === 0 && <Check size={17} aria-hidden="true" />}
                        </button>
                        {categories.map((category) => {
                            const selected = selectedCategories.includes(category);
                            return (
                                <button
                                    type="button"
                                    key={category}
                                    className={`picker-category-option ${selected ? "is-selected" : ""}`}
                                    onClick={() => onCategoryToggle(category)}
                                    aria-pressed={selected}
                                >
                                    {translateText(`picker-category:${decodeHtmlEntities(category)}`, decodeHtmlEntities(category))}
                                    {selected && <Check size={17} aria-hidden="true" />}
                                </button>
                            );
                        })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
