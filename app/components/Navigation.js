import Link from "next/link";
import { useUserContext } from "../contexts/UserContext";

export default function Navigation(props) {
	const { userData } = useUserContext();

	return (
		<div className={" py-4 md:py-6 px-4 md:px-8 xl:px-16 flex justify-between items-center gap-12"}>
			<div className={"font-bold text-3xl"}>Lista</div>

			<div className="flex gap-4 items-center">
				{(userData && userData.registered === "yes") && <div className={"text-white flex gap-2"}>
					<span className="inline-block wave-emoji">👋</span> {userData?.name}</div>}
				<Link href={`${props.route}`} className={"text-white  py-3 px-6 xl:px-10 font-bold rounded-full bg-blue-800"}>
					{props.link}
				</Link>
			</div>

		</div>
	)
}
