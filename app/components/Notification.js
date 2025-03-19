'use client';
import { useEffect, useRef } from 'react';
import { useNotificationContext } from '../contexts/NotificationContext';
import { gsap } from 'gsap';

export default function Notification() {
	const { notification, clearNotification } = useNotificationContext();
	const notificationRef = useRef(null);

	// Only animate when there is a new notification
	useEffect(() => {
		if (notification.message) {
			// Animate the notification up from below
			gsap.fromTo(
				notificationRef.current,
				{ y: 100, opacity: 0 },
				{ y: 0, opacity: 1, duration: 0.5 }
			);

			// Animate it down and remove after timeout
			setTimeout(() => {
				gsap.to(notificationRef.current, {
					y: 100,
					opacity: 0,
					duration: 0.5
				});
				setTimeout(() => {
					clearNotification();
				}, 500);
			}, notification.timeout);
		}
		// 	cleanup function
		return () => {
			gsap.killTweensOf(notificationRef.current);
		}
	}, [notification]);

	const notificationTypeError = notification.type === 'error' ? 'bg-red-500 text-white' : ' bg-green-500 text-black';

	// Only render notification if there is a message
	return (
		notification.message && (
			<div ref={notificationRef} className={`${notificationTypeError} fixed bottom-8 right-8  p-4 rounded-md shadow-md`} >

				{notification.message}
			</div >
		)
	);
}
