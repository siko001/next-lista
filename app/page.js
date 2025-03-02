'use client'; // Important to make this client-side only
import {useUserContext} from "./contexts/UserContext";
import {useOverlayContext} from "./contexts/OverlayContext";
import Navigation from "./components/Navigation";
import Button from "./components/Button";
import Overlay from "./components/modals/Overlay";
import Notification from "./components/Notification";

const Home = () => {
	const {userData, token, loading, error} = useUserContext();
	const {overlay} = useOverlayContext()

	if(loading) return <div>Loading...</div>;
	if(error) return <div>Error: {error}</div>;

	return (
		<main>
			<Navigation route={"/login"} link={"Login"}/>

			<div className={" flex flex-col gap-36 py-24"}>

				<div className={"mx-auto"}>
					<Button cta={"Create a new list"} content={"single-input"} action={"create-list"} cancelAction={"true"} color={'#21ba9c'} hover={"inwards"}/>
				</div>

				<div className={"text-center "}>
					<p className={"text-xl md:text-2xl"}><strong> Let&#39;s plan your shopping list!</strong></p>
					<p className={"mt-2 md:text-lg text-gray-400"}>Use the button to start a new list </p>
				</div>

			</div>
			{overlay && <Overlay/>}

			<Notification/>
		</main>
	);
};

export default Home;
