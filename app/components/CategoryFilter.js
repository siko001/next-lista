import {useRef, useEffect, useState} from "react";

const CategoryFilter = ({
    categories = [],
    selectedCategories = [],
    onCategoryToggle = () => {},
}) => {
    const scrollContainerRef = useRef(null);

    // Horizontal scroll with mouse wheel
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleWheel = (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                container.scrollLeft += e.deltaY;
            }
        };

        container.addEventListener("wheel", handleWheel, {passive: false});
        return () => container.removeEventListener("wheel", handleWheel);
    }, []);

    // Add scroll buttons if content overflows
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollButtons = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const atStart = el.scrollLeft <= 0;
        const atEnd =
            Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth;
        setCanScrollLeft(!atStart);
        setCanScrollRight(!atEnd);
    };

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        updateScrollButtons();
        const onScroll = () => updateScrollButtons();
        el.addEventListener("scroll", onScroll, {passive: true});
        const onResize = () => updateScrollButtons();
        window.addEventListener("resize", onResize);
        return () => {
            el.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onResize);
        };
    }, []);

    // Re-evaluate when categories change (content width may change)
    useEffect(() => {
        // next tick to ensure DOM updated
        const id = requestAnimationFrame(updateScrollButtons);
        return () => cancelAnimationFrame(id);
    }, [categories]);

    // Button click scroll
    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({
                left: -200,
                behavior: "smooth",
            });
        }
    };

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({
                left: 200,
                behavior: "smooth",
            });
        }
    };

    // Press-and-hold continuous scroll for buttons
    const holdRafRef = useRef(null);
    const isHoldingRef = useRef(false);
    const startHoldScroll = (direction) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        isHoldingRef.current = true;
        const step = () => {
            if (!isHoldingRef.current) return;
            // compute edges each frame
            const atStart = el.scrollLeft <= 0;
            const atEnd =
                Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth;
            if ((direction < 0 && atStart) || (direction > 0 && atEnd)) {
                updateScrollButtons();
                isHoldingRef.current = false;
                holdRafRef.current && cancelAnimationFrame(holdRafRef.current);
                holdRafRef.current = null;
                return;
            }
            el.scrollLeft += direction * 8; // speed per frame
            updateScrollButtons();
            holdRafRef.current = requestAnimationFrame(step);
        };
        holdRafRef.current = requestAnimationFrame(step);
    };
    const stopHoldScroll = () => {
        isHoldingRef.current = false;
        if (holdRafRef.current) {
            cancelAnimationFrame(holdRafRef.current);
            holdRafRef.current = null;
        }
    };

    // Drag to scroll (mouse and touch)
    const isDownRef = useRef(false);
    const startXRef = useRef(0);
    const scrollLeftRef = useRef(0);

    const onPointerDown = (clientX) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        isDownRef.current = true;
        startXRef.current = clientX - el.offsetLeft;
        scrollLeftRef.current = el.scrollLeft;
    };

    const onPointerMove = (clientX, e) => {
        const el = scrollContainerRef.current;
        if (!el || !isDownRef.current) return;
        if (e && e.cancelable) e.preventDefault();
        const x = clientX - el.offsetLeft;
        const walk = (x - startXRef.current) * 1; // scroll-fast factor
        el.scrollLeft = scrollLeftRef.current - walk;
    };

    const onPointerUp = () => {
        isDownRef.current = false;
    };

    return (
        <div className="relative font-quicksand bg-white dark:bg-gray-900 shadow-xl rounded-sm ml-4">
            {/* Left scroll button */}
            <button
                onClick={scrollLeft}
                className={`absolute cursor-pointer hidden md:block -left-3 top-1/2 -translate-y-1/2 z-10 p-1 h-8 w-8  bg-blue-600 text-white dark:bg-blue-700 shadow-lg rounded-full hover:bg-blue-700 transition-colors ${
                    canScrollLeft
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                }`}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    startHoldScroll(-1);
                }}
                onMouseUp={stopHoldScroll}
                onMouseLeave={stopHoldScroll}
                onTouchStart={(e) => {
                    e.stopPropagation();
                    startHoldScroll(-1);
                }}
                onTouchEnd={stopHoldScroll}
                onTouchCancel={stopHoldScroll}
                aria-label="Scroll left"
            >
                <span className="relative -top-[3px]">←</span>
            </button>

            {/* Category list */}
            <div
                ref={scrollContainerRef}
                className="flex overflow-x-auto scrollbar-hide gap-2 py-2 px-2 mx-auto select-none cursor-grab active:cursor-grabbing"
                style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    WebkitOverflowScrolling: "touch",
                    touchAction: "pan-x",
                }}
                onMouseDown={(e) => onPointerDown(e.pageX)}
                onMouseLeave={onPointerUp}
                onMouseUp={onPointerUp}
                onMouseMove={(e) => onPointerMove(e.pageX, e)}
                onTouchStart={(e) => onPointerDown(e.touches[0].pageX)}
                onTouchEnd={onPointerUp}
                onTouchMove={(e) => onPointerMove(e.touches[0].pageX, e)}
            >
                <button
                    onClick={() => onCategoryToggle("all")}
                    className={`
                        whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium
                        transition-all duration-200 ease-in-out flex-shrink-0  
                        ${
                            selectedCategories.length === 0
                                ? "bg-primary text-black shadow-md dark:hover:opacity-80 "
                                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-primary dark:hover:bg-gray-700"
                        }
                    `}
                >
                    <span className="cursor-pointer"> All Categories</span>
                </button>
                {categories.map((category) => (
                    <button
                        key={category}
                        onClick={() => onCategoryToggle(category)}
                        className={`
                            whitespace-nowrap cursor-grab px-3 py-1.5 rounded-full text-sm font-medium
                            transition-all duration-200 ease-in-out flex-shrink-0
                            ${
                                selectedCategories.includes(category)
                                    ? "bg-primary text-black shadow-md dark:hover:opacity-80 "
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }
                        `}
                    >
                        <span className="cursor-pointer"> {category}</span>
                    </button>
                ))}
            </div>

            {/* Right scroll button */}
            <button
                onClick={scrollRight}
                className={`absolute cursor-pointer hidden md:block -right-3 top-1/2 -translate-y-1/2 z-10 p-1 h-8 w-8 bg-blue-600 text-white dark:bg-blue-700 shadow-lg rounded-full hover:bg-blue-700 transition-colors ${
                    canScrollRight
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                }`}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    startHoldScroll(1);
                }}
                onMouseUp={stopHoldScroll}
                onMouseLeave={stopHoldScroll}
                onTouchStart={(e) => {
                    e.stopPropagation();
                    startHoldScroll(1);
                }}
                onTouchEnd={stopHoldScroll}
                onTouchCancel={stopHoldScroll}
                aria-label="Scroll right"
            >
                <span className="relative -top-[3px]"> → </span>
            </button>
        </div>
    );
};

export default CategoryFilter;
