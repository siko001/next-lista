'use client';
import Link from "next/link";
import {gsap} from "gsap";
import {useEffect, useRef} from "react";

import {useUserContext} from "../contexts/UserContext";
import Navigation from "../components/Navigation";


const Login = () => {
	const {userData} = useUserContext();
	const messageRef = useRef(null);


	useEffect(() => {
		if(userData?.registered === "yes") {
			window.location.href = '/';
		}

		// 		Animate the message in after 3 seconds
		const message = messageRef.current;
		gsap.fromTo(
			message,
			{opacity: 0, y: 100, rotate: -20, scale: 0.8},
			{
				opacity: 1,
				y: 0,
				rotate: 0,
				scale: 1,
				duration: 0.8,
				ease: "elastic.out(1, 0.5)", // Smooth bounce
				delay: 1
			}
		);

		gsap.to(message, {
			delay: 2,
			duration: 0.5,
			color: "#ffcc00", // Flash effect
			repeat: 3,
			yoyo: true,
			onComplete: () => {
				gsap.to(message, {duration: 0.6, scale: 1, color: "#ff3333", ease: "back.out(2)"});
				gsap.to(message, {duration: 0.5, delay: 1.2, text: "Register Now! 🚀", ease: "power2.out"});
			}
		});


	}, []);

	return (
		<main>
			<Navigation route={'/'} link={"Home"}/>
			<Link href={"/register"} ref={messageRef} className={"fixed bottom-24 right-24 bg-blue-800 text-white p-4  rounded-sm "}> Don&#39;t Have an Account? </Link>
		</main>
	);
};

export default Login;
