import {useOverlayContext} from "../../contexts/OverlayContext";

import CloseIcon from "../svgs/CloseIcon";
import Button from "../Button";

export default function Overlay() {
	const {closeOverlay, overlayContent, convertContentToComponent} = useOverlayContext();

	return (
		<div className={"w-full h-screen fixed z-50 inset-0 grid place-items-center"}>
			<div id={"overlay-backdrop"} className="absolute inset-0 opacity-0 w-full h-full backdrop-blur z-10"></div>

			<div id={"overlay-content"} className={"z-20 bg-white p-12 md:p-18 rounded-lg shadow-lg text-black flex flex-col gap-4 relative"}>

				<CloseIcon className={'text-red-500 absolute right-4 top-4 w-8 h-8 cursor-pointer hover:text-black duration-200 transition-colors'} onClick={closeOverlay}/>

				{overlayContent.title && <h2 className="text-3xl md:text-4xl font-bold text-blue-700">{overlayContent.title}</h2>}

				{overlayContent.content && convertContentToComponent(overlayContent.content)}

				<div className={"flex gap-4 justify-between mt-6"}>
					{overlayContent.action && <Button cta={overlayContent.cta} action={overlayContent.action} color={'#000'} hover={"borders"}/>}

					{overlayContent.cancelAction && <Button cta={"Cancel"} action={"close-overlay"} color={'#fff'} overrideDefaultClasses={"bg-red-500"} hover={"borders"}/>}
				</div>

			</div>
		</div>
	);
}
