import gsap from "gsap";
import { useEffect } from "react";
import { useOverlayContext } from "../../contexts/OverlayContext";

import CloseIcon from "../svgs/CloseIcon";
import Button from "../Button";
import { useListContext } from "../../contexts/ListContext";

export default function Overlay({ handleDeleteList, handleEmptyList }) {
	const { closeOverlay, overlayContent, convertContentToComponent } = useOverlayContext()

	useEffect(() => {
		// trigger gsap animation when overlay is opening
		gsap.fromTo("#overlay-backdrop", { opacity: 0 }, { opacity: 1, duration: 0.5 });
		gsap.fromTo("#overlay-content", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, delay: 0.25 });

		const closeOnEsc = (e) => {
			if (e.key === "Escape") return closeOverlay()
		}

		window.addEventListener("keydown", closeOnEsc);
		return () => window.removeEventListener("keydown", closeOnEsc);
	}, []);

	return (
		<div className={"w-full h-screen fixed z-50 inset-0 grid place-items-center overlay"}>
			<div id={"overlay-backdrop"} className="absolute inset-0 opacity-0 w-full h-full backdrop-blur z-10"></div>

			<div id={"overlay-content"} className={"z-20 bg-white p-12 md:p-18 rounded-lg shadow-lg text-black flex flex-col gap-4 relative"}>

				<CloseIcon className={'text-red-500 absolute right-4 top-4 w-8 h-8 cursor-pointer hover:text-black duration-200 transition-colors'} onClick={closeOverlay} />

				{
					overlayContent.title &&
					<h2 className="text-3xl md:text-4xl max-w-[15ch] overflow-scroll font-bold text-blue-700">
						{overlayContent.title}
					</h2>
				}

				{overlayContent.content && convertContentToComponent(overlayContent.content)}

				<div className={"flex gap-4 justify-between mt-6"}>
					{overlayContent.action && <Button cta={overlayContent.cta} action={overlayContent.action} textColorOverride={'text-white'} color={'#000'} hover={"borders"} handleEmptyList={handleEmptyList} handleDeleteList={handleDeleteList} data={overlayContent.data} />}

					{overlayContent.cancelAction && <Button cta={"Cancel"} action={"close-overlay"} color={'#fff'} textColorOverride={'text-white'} overrideDefaultClasses={"bg-red-500"} hover={"borders"} />}
				</div>

			</div>
		</div>
	);
}
