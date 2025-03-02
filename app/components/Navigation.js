import Link from "next/link";

export default function Navigation(props) {
	return (
		<div className={" py-4 md:py-6 px-4 md:px-8 xl:px-16 flex justify-between items-center gap-12"}>
			<div className={"font-bold text-3xl"}>Lista</div>

			<Link href={`${props.route}`} className={"text-white  py-3 px-6 xl:px-10 font-bold rounded-full bg-blue-800"}> {props.link} </Link>

		</div>
	)
}
