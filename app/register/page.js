'use client';
import Link from "next/link";
import {gsap} from "gsap";
import {useEffect, useRef, useState} from "react";
import {useForm} from "react-hook-form";
import * as yup from "yup";
import {yupResolver} from "@hookform/resolvers/yup";

import {useUserContext} from "../contexts/UserContext";
import Navigation from "../components/Navigation";

const schema = yup.object().shape({
	username: yup.string().required("Username is required"),
	email: yup.string().email("Invalid email format").required("Email is required"),
	password: yup.string().min(6, "Password must be at least 6 characters").matches(/[0-9]/, "Password must contain at least one number").matches(/[^a-zA-Z0-9]/, "Password must contain at least one special character").required("Password is required"),
	confirm_password: yup.string().oneOf([yup.ref("password"), null], "Passwords must match").required("Confirm password is required"),
});

const Register = () => {
	const {userData} = useUserContext();
	const messageRef = useRef(null);
	const buttonRef = useRef(null);
	const formRef = useRef(null);
	const [isFormValid, setIsFormValid] = useState(true);
	const {
		register,
		handleSubmit,
		watch,
		formState: {errors, isValid},
	} = useForm({resolver: yupResolver(schema), mode: "onChange"});

	useEffect(() => {
		if(userData?.registered === "yes") {
			window.location.href = "/";
		}

		const message = messageRef.current;
		gsap.fromTo(
			message,
			{opacity: 0, y: 100, rotate: -20, scale: 0.8},
			{opacity: 1, y: 0, rotate: 0, scale: 1, duration: 0.8, ease: "elastic.out(1, 0.5)", delay: 1}
		);

		gsap.to(message, {
			delay: 2,
			duration: 0.5,
			color: "#ffcc00",
			repeat: 3,
			yoyo: true,
			onComplete: () => {
				gsap.to(message, {duration: 0.6, scale: 1, color: "#ff3333", ease: "back.out(2)"});
				gsap.to(message, {duration: 0.5, delay: 1.2, text: "Login Here! 🚀", ease: "power2.out"});
			}
		});
	}, []);

	useEffect(() => {
		// Update form validity state
		setIsFormValid(isValid);

		// Reset button position when form becomes valid
		if(isValid && buttonRef.current) {
			gsap.to(buttonRef.current, {
				x: 0,
				y: 0,
				duration: 0.4,
				ease: "power2.out"
			});
		}
	}, [isValid]);

	const onSubmit = (data) => {
		console.log("Form Submitted", data);
	};

	// Mouse move handler to make the button move away from the cursor
	const handleMouseMove = (e) => {
		if(!isFormValid && buttonRef.current) {
			const button = buttonRef.current;
			const buttonRect = button.getBoundingClientRect();

			// Get mouse position
			const mouseX = e.clientX;
			const mouseY = e.clientY;

			// Calculate the center of the button
			const buttonCenterX = buttonRect.left + buttonRect.width / 2;
			const buttonCenterY = buttonRect.top + buttonRect.height / 2;

			// Calculate the distance between mouse and button center
			const distanceX = mouseX - buttonCenterX;
			const distanceY = mouseY - buttonCenterY;
			const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

			// Set a threshold distance where the button should start moving away
			const thresholdDistance = 200; // 100px threshold as requested

			// Only move the button if the mouse is within the threshold distance
			// but not hovering directly over the button
			if(distance < thresholdDistance &&
				!(mouseX >= buttonRect.left &&
					mouseX <= buttonRect.right &&
					mouseY >= buttonRect.top &&
					mouseY <= buttonRect.bottom)) {

				// Calculate the direction vector from mouse to button
				// We invert this to make the button move away from the cursor
				const directionX = buttonCenterX - mouseX;
				const directionY = buttonCenterY - mouseY;

				// Normalize the direction vector
				const directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
				const normalizedDirectionX = directionX / directionLength;
				const normalizedDirectionY = directionY / directionLength;

				// Calculate the movement distance based on how close the cursor is
				// Closer cursor = stronger repulsion
				const repulsionStrength = 1 - (distance / thresholdDistance);
				const moveDistance = 200 * repulsionStrength;

				// Calculate the new position
				const moveX = normalizedDirectionX * moveDistance;
				const moveY = normalizedDirectionY * moveDistance;

				// Get viewport boundaries
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				// Ensure the button stays within viewport bounds
				const newLeft = buttonRect.left + moveX;
				const newTop = buttonRect.top + moveY;

				const isWithinHorizontalBounds = newLeft >= 0 && (newLeft + buttonRect.width) <= viewportWidth;
				const isWithinVerticalBounds = newTop >= 0 && (newTop + buttonRect.height) <= viewportHeight;

				// Apply the movement with GSAP
				gsap.to(button, {
					x: isWithinHorizontalBounds ? moveX : 0,
					y: isWithinVerticalBounds ? moveY : 0,
					duration: 0.3,
					ease: "power2.out"
				});
			}
		}
	};

	return (
		<main onMouseMove={handleMouseMove}>
			<Navigation route={'/'} link={"Home"}/>
			<form ref={formRef} className={"flex flex-col items-center max-auto mt-16"} onSubmit={handleSubmit(onSubmit)}>
				<div className={"flex flex-col gap-4 min-w-[80%] md:min-w-[350px]"}>
					<h2 className={"text-2xl text-blue-600 mb-2"}>Create Your Account</h2>

					{/* Username Field */}
					<div className="relative z-0 w-full mb-5 group">
						<input {...register("username")} type="text" name="username" id="username" className="block py-3 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 !border-white appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer" placeholder=" "/>
						<label htmlFor="username" className="peer-focus:font-medium absolute text-sm !text-white dark:text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">Choose a Username</label> {errors.username &&
						<p className="text-red-500 text-sm mt-2">{errors.username.message}</p>}
					</div>

					{/* Email Field */}
					<div className="relative z-0 w-full mb-5 group">
						<input {...register("email")} type="email" name="email" id="email" className="block py-3 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 !border-white appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer" placeholder=" "/>
						<label htmlFor="email" className="peer-focus:font-medium absolute text-sm !text-white dark:text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">Email address</label> {errors.email &&
						<p className="text-red-500 text-sm mt-2">{errors.email.message}</p>}
					</div>

					{/* Password Fields */}
					<div className="relative z-0 w-full mb-5 group">
						<input {...register("password")} type="password" name="password" id="password" className="block py-3 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 !border-white appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer" placeholder=" "/>
						<label htmlFor="password" className="peer-focus:font-medium absolute text-sm !text-white dark:text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">Choose a Password</label> {errors.password &&
						<p className="text-red-500 text-sm mt-2">{errors.password.message}</p>}
					</div>

					{/* Confirm Password Field */}
					<div className="relative z-0 w-full mb-5 group">
						<input {...register("confirm_password")} type="password" name="confirm_password" id="confirm_password" className="block py-3 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 !border-white appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer" placeholder=" "/>
						<label htmlFor="confirm_password" className="peer-focus:font-medium absolute text-sm !text-white dark:text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">Confirm your Password</label> {errors.confirm_password &&
						<p className="text-red-500 text-sm mt-2">{errors.confirm_password.message}</p>}
					</div>

					<button ref={buttonRef} type="submit" className={`self-start ${isFormValid ? 'bg-blue-800' : 'bg-red-600'} text-white px-6 py-2 rounded-sm mt-4 relative`}>
						Register
					</button>

				</div>
			</form>

			<Link href={"/login"} ref={messageRef} className={"fixed bottom-24 right-24 bg-blue-800 text-white p-4 rounded-sm"}>Have an Account?</Link>
		</main>
	);
};

export default Register;
