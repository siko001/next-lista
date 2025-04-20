import Link from "next/link";
import { useUserContext } from "../contexts/UserContext";

export default function Navigation(props) {
	const { userData } = useUserContext();

	return (
		<div className={" py-4 md:py-6 px-4 md:px-8 xl:px-16 flex justify-between items-center gap-12"}>
			<Link id="site-logo" href={"/"} className={"font-bold font-saira uppercase text-3xl"}>Lista</Link>

			<div className="flex gap-4 items-center">
				{(userData && userData.registered === "yes") && <div className={"text-white flex gap-2"}>

					<span className="inline-block font-saira wave-emoji">👋</span> {userData?.name}</div>}

				<Link href={`${props.route}`} className={" text-primary overflow-hidden group relative  py-3 px-6 xl:px-10 font-bold rounded-full bg-blue-800"}>
					<p className="relative z-20 group-hover:text-black duration-700 text-white">
						{props.link}
					</p>
					<div className="absolute w-0 h-0 group-hover:w-full group-hover:h-full transition-all top-[50%] z-10 left-[50%] -translate-x-1/2 -translate-y-1/2 duration-200 bg-primary">
					</div>
				</Link>
			</div>

		</div>
	)
}
