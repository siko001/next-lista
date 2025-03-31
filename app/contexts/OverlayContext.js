'use client';
import { gsap } from "gsap";

import { createContext, useContext, useEffect, useState } from 'react';
import { useValidationContext } from './ValidationContext';
import { useLoadingContext } from "./LoadingContext";
import SingleInput from '../components/parts/SingleInput';
import { set } from "react-hook-form";

const OverlayContext = createContext();

export const OverlayProvider = ({ children }) => {
	const { setLoading } = useLoadingContext();
	const { setErrors, setHasTyped } = useValidationContext();
	const [overlay, setOverlay] = useState(null);
	const [overlayContent, setOverlayContent] = useState({
		title: null,
		content: null,
		action: null,
		cancelAction: false
	});

	const convertContentToComponent = (content) => {
		if (!content) return null;
		switch (content) {
			case "single-input":
				return <SingleInput />

			default:
				return null;

		}
	};

	const closeOverlay = () => {
		// Start closing animation
		setLoading(false);
		gsap.to("#overlay-backdrop", { opacity: 0, duration: 0.1 });
		gsap.to("#overlay-content", {
			scale: 0, opacity: 0, duration: 0.2, delay: 0.25, onComplete: () => {
				setHasTyped(false);
				setOverlay(false);
				setOverlayContent(null);
				setErrors(false);
			}
		});
	};

	return (
		<OverlayContext.Provider value={{
			overlay,
			setOverlay,
			overlayContent,
			setOverlayContent,
			closeOverlay,
			convertContentToComponent
		}}>
			{children}
		</OverlayContext.Provider>
	);
};

export const useOverlayContext = () => useContext(OverlayContext);
