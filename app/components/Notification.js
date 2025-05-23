'use client';
import { useEffect, useRef } from 'react';
import { useNotificationContext } from '../contexts/NotificationContext';
import { gsap } from 'gsap';

export default function Notification() {
	const { notification, clearNotification } = useNotificationContext();
	const notificationRef = useRef(null);
	const timeoutRef = useRef(null);

	useEffect(() => {
		if (notification && notification.message) {
			// Animate in
			gsap.fromTo(
				notificationRef.current,
				{ y: 100, opacity: 0 },
				{ y: 0, opacity: 1, duration: 0.5 }
			);

			// Animate out after timeout
			timeoutRef.current = setTimeout(() => {
				gsap.to(notificationRef.current, {
					y: 100,
					opacity: 0,
					duration: 0.5,
					onComplete: clearNotification
				});
			}, notification.timeout);
		}
		// Cleanup function
		return () => {
			clearTimeout(timeoutRef.current);
			gsap.killTweensOf(notificationRef.current);
		};
	}, [notification, clearNotification]);

	const notificationTypeError =
		notification?.type === 'error'
			? 'bg-red-500 text-white'
			: ' bg-green-500 text-black';

	return (
		notification && notification.message && (
			<div
				ref={notificationRef}
				className={`${notificationTypeError} fixed bottom-8 z-[9999] right-8 font-quicksand font-[600] p-4 rounded-md shadow-md`}
			>
				{notification.message}
			</div>
		)
	);
}
