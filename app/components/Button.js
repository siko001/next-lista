'use client'

import { useOverlayContext } from "../contexts/OverlayContext";
import { useNotificationContext } from "../contexts/NotificationContext";
import { useValidationContext } from "../contexts/ValidationContext";
import { useLoadingContext } from "../contexts/LoadingContext";
import { useListContext } from "../contexts/ListContext";
import { useUserContext } from "../contexts/UserContext";
import { useEffect } from "react";
import gsap from "gsap";

export default function Button(props) {
	const { setOverlay, setOverlayContent, closeOverlay } = useOverlayContext();
	const { shoppingList, createShoppingList, getShoppingList, setUserLists } = useListContext();
	const { userData, token } = useUserContext();
	const { errors, setErrors, hasTyped } = useValidationContext();
	const { showNotification } = useNotificationContext();
	const { setLoading } = useLoadingContext();


	useEffect(() => {
		if (props.action === "add-product-overlay") {
			gsap.set(".open-product-overlay", {
				y: 200,
				opacity: 1,
			})
			gsap.to(".open-product-overlay", {
				y: 0,
				duration: 0.5,
				ease: "power2.out",
			})
			return;
		}
	});



	const handleClick = async () => {
		if (errors.message) return;
		// console.log(props)

		// Open ALl Products Overlay
		if (props.action === "add-product-overlay") {
			props.setProductOverlay(true);
			return;
		}

		// Close All Products Overlay
		if (props.action === "close-product-overlay") {
			props.setProductOverlay(false);
			return;
		}


		if (props.action === "create-list") {
			setOverlay((prev) => !prev);
			setOverlayContent({
				title: "Create a new list",
				content: "single-input",
				action: "create-a-list",
				cta: "Create list",
				cancelAction: true
			});
			return;
		}




		if (props.action === "create-a-list") {
			try {
				if (!hasTyped) return setErrors({ message: "List Name required" });
				if (errors.message) return;
				setLoading(true);

				const data = {
					name: shoppingList.name,
					userId: userData.id,
					token: token
				};

				// Call the createShoppingList function
				const res = await createShoppingList(data);
				const allLists = await getShoppingList(userData.id, token);

				if (res) {
					// Add animation state to the new list
					const listsWithAnimation = allLists.map(list => ({
						...list,
						isNew: list.id === res.id // Mark the new list

					}));

					setUserLists(listsWithAnimation);

					// Remove the animation after 5 seconds
					setTimeout(() => {
						setUserLists(prev => prev.map(list => ({
							...list,
							isNew: false
						})));
					}, 3000);


					showNotification(`List ${res.title.raw} created`, "success", 2000);
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
		<button onClick={() => {
			if (props.action === "close-overlay") {
				closeOverlay()
			} else {
				handleClick();
			}
		}} className={`relative  cursor-pointer z-20 group ${props.overrideDefaultClasses ? props.overrideDefaultClasses : 'bg-blue-800 text-primary'}  px-6 py-3 md:px-8 md:py-4 rounded-md overflow-hidden`}>
			<p className={`z-20 relative delay-75 font-bold  ${props.hover && props.light ? "group-hover:text-white" : "group-hover:text-black"} transition-colors duration-200   ${props.textColorOverride && props.textColorOverride}`}>{props.cta}</p>

			{(props.hover && props.hover === "inwards") && (
				<>
					<span style={{ backgroundColor: props.color }} className={`absolute z-10 -top-1 -left-1 md:-top-2 md:-left-2 w-1/12 h-1/12 transition-all duration-300 ease-in group-hover:w-[102%] group-hover:h-[102%] md:group-hover:w-[105%] md:group-hover:h-[105%]`}></span>
					<span style={{ backgroundColor: props.color }} className={`absolute z-10 -bottom-1 -right-1 md:-bottom-2 md:-right-2 w-1/12 h-1/12 transition-all duration-300 ease-in group-hover:w-[102%] group-hover:h-[102%] md:group-hover:w-[105%] md:group-hover:h-[105%]`}></span>
				</>
			)}

			{(props.hover && props.hover === "borders") && (
				<>
					<span style={{ backgroundColor: props.color }} className={`absolute z-10 -top-0 -left-0 w-0 h-[3px] transition-all rounded-full duration-300 ease-in  group-hover:w-full`}></span>
					<span style={{ backgroundColor: props.color }} className={`absolute z-10 -bottom-0 -right-0 w-0 h-[3px] transition-all duration-300 ease-in group-hover:w- group-hover:w-full`}></span>
					<span style={{ backgroundColor: props.color }} className={`absolute z-10 -top-0 -right-0 h-0 w-[3px] transition-all duration-300 ease-in  group-hover:h-full`}></span>
					<span style={{ backgroundColor: props.color }} className={`absolute z-10 -bottom-0 -left-0 h-0 w-[3px] transition-all duration-300 ease-in  group-hover:h-full`}></span>
				</>
			)}

		</button>
	)
}
