'use client'; // Important to make this client-side only
import { useEffect } from "react";
import { useUserContext } from "./contexts/UserContext";
import { useOverlayContext } from "./contexts/OverlayContext";
import { useListContext } from "./contexts/ListContext";
import Navigation from "./components/Navigation";
import Button from "./components/Button";
import Overlay from "./components/modals/Overlay";
import Notification from "./components/Notification";

const Home = () => {
    const { userData, token, loading, error } = useUserContext();
    const { userLists, setUserLists, getShoppingList } = useListContext();
    const { overlay } = useOverlayContext();

    useEffect(() => {
        if (userData?.id && token) {
            getShoppingList(userData.id, token); // Fetch the shopping lists when userData and token are available
        }
    }, [userData, token, getShoppingList]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <main>
            <Navigation route={"/login"} link={"Login"} />

            <div className={" flex flex-col gap-36 py-24"}>
                <div className={"mx-auto"}>
                    <Button
                        cta={"Create a new list"}
                        content={"single-input"}
                        action={"create-list"}
                        cancelAction={"true"}
                        color={"#21ba9c"}
                        hover={"inwards"}
                    />
                    {userLists && userLists.length > 0 ? (
                        userLists.map((list, index) => (
                            <div key={index} className={"flex justify-between items-center mt-8"}>
                                <p>{list.title.rendered}</p>
                                
                            </div>
                        ))
                    ) : (
                        <p>No shopping lists found.</p>
                    )}
                </div>

                <div className={"text-center "}>
                    <p className={"text-xl md:text-2xl"}>
                        <strong> Let&#39;s plan your shopping list!</strong>
                    </p>
                    <p className={"mt-2 md:text-lg text-gray-400"}>Use the button to start a new list </p>
                </div>
            </div>
            {overlay && <Overlay />}

            <Notification />
        </main>
    );
};

export default Home;
