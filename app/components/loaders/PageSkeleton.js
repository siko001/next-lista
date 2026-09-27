"use client";

import {useParams} from "next/navigation";
import {useListContext} from "../../contexts/ListContext";
import Header from "../Header";
import Button from "../Button";
import Overlay from "../modals/Overlay";
import {useOverlayContext} from "../../contexts/OverlayContext";

function Bar({className = "", width}) {
    return <span className={`ui-skeleton ${className}`} style={width ? {width} : undefined} />;
}

function LoadingStatus({children}) {
    return <span className="sr-only" role="status">{children}</span>;
}

function SkeletonNavigation() {
    return <Header />;
}

export function ListCardsSkeleton({count = 0}) {
    return (
        <div aria-busy="true">
            <LoadingStatus>Loading your shopping lists…</LoadingStatus>
            {count === 0 && (
                <div className="skeleton-empty-list" aria-hidden="true">
                    <Bar className="skeleton-empty-icon" />
                    <Bar className="skeleton-empty-title" />
                    <Bar className="skeleton-empty-hint" />
                </div>
            )}
            <div className="home-list-stack" aria-hidden="true">
                {Array.from({length: count}, (_, index) => (
                    <div className="home-list-card skeleton-list-card" key={index}>
                        <div className="skeleton-card-heading">
                            <Bar className="skeleton-list-title" width={`${42 + (index % 3) * 8}%`} />
                            <Bar className="skeleton-list-count" />
                            <Bar className="skeleton-menu" />
                        </div>
                        <Bar className="skeleton-progress" />
                    </div>
                ))}
            </div>
        </div>
    );
}

function ProductRowsSkeleton({count}) {
    return Array.from({length: count}, (_, index) => (
        <div className="list-product-row skeleton-product-row" key={index}>
            <Bar className="skeleton-checkbox" />
            <Bar className="skeleton-product-name" width={`${34 + (index % 3) * 10}%`} />
            <Bar className="skeleton-product-status" />
        </div>
    ));
}

export default function PageSkeleton({detail = false}) {
    const {overlay, overlayContent} = useOverlayContext();
    const params = useParams();
    const {userLists, listPreview, listsLoaded} = useListContext();
    const listId = params?.id;
    const preview = String(listPreview?.id) === String(listId)
        ? listPreview
        : userLists?.find((list) => String(list.id) === String(listId));
    const total = Number(preview?.acf?.product_count);
    const bagged = Math.min(total, Number(preview?.acf?.bagged_product_count || 0));
    const knownCounts = !!preview && Number.isFinite(total) && total >= 0;
    const toBuy = total - bagged;

    return (
        <main className={detail ? `list-detail-page ${knownCounts && total === 0 ? "is-empty" : ""}` : "home-page"} aria-busy="true">
            <SkeletonNavigation />
            {detail ? (
                <>
                    <LoadingStatus>Loading your shopping list…</LoadingStatus>
                    <div className="list-detail-shell" aria-hidden="true">
                        <div className="list-detail-header skeleton-detail-header">
                            <div className="skeleton-card-heading">
                                <Bar className="skeleton-detail-title" />
                                <Bar className="skeleton-menu" />
                                <Bar className="skeleton-menu" />
                            </div>
                            <div className="list-header-progress">
                                <Bar className="skeleton-progress" />
                                {knownCounts ? <span className="list-header-count">{bagged} / {total}</span> : <Bar width="42px" />}
                            </div>
                        </div>
                        <div className="list-detail-content skeleton-detail-content">
                            {knownCounts ? (
                                total === 0 ? (
                                    <div className="skeleton-empty-list">
                                        <Bar className="skeleton-empty-icon" />
                                        <Bar className="skeleton-empty-title" />
                                        <Bar className="skeleton-empty-hint" />
                                    </div>
                                ) : (
                                    <>
                                        {toBuy > 0 && <>
                                            <div className="skeleton-section-heading">Checklist <span>{toBuy} products</span></div>
                                            <ProductRowsSkeleton count={Math.min(toBuy, 8)} />
                                        </>}
                                        {bagged > 0 && <>
                                            <div className="skeleton-section-heading">Bagged <span>{bagged} products</span></div>
                                            <ProductRowsSkeleton count={Math.min(bagged, 8)} />
                                        </>}
                                    </>
                                )
                            ) : (
                                <div className="skeleton-unknown-list">
                                    <Bar width="45%" />
                                    <Bar width="65%" />
                                    <Bar width="30%" />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="home-content">
                    <div className="home-lists">
                        <div className="home-lists-heading">
                            <div>
                                <p className="home-eyebrow">YOUR SPACE</p>
                                <h1>Shopping lists</h1>
                                <p>Keep every shop organised in one place.</p>
                            </div>
                            <Button action="create-list" cta="Create List" overrideDefaultClasses="app-primary-action" />
                        </div>
                        {listsLoaded && !userLists?.length ? (
                            <div className="home-empty-state">
                                <h2>No shopping lists yet</h2>
                                <p>Create a list to get started.</p>
                            </div>
                        ) : (
                            <ListCardsSkeleton count={userLists?.length || 0} />
                        )}
                    </div>
                </div>
            )}
            {overlay && overlayContent?.action === "create-a-list" && <Overlay />}
        </main>
    );
}
