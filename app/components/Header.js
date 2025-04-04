import Link from "next/link";
import Navigation from "./Navigation";

// Helpers
import { extractUserName } from "../lib/helpers";

export default function Header({ isRegistered, userName }) {
    return (
        <>        {/* normal header */}
            {!isRegistered && <Navigation route={"/login"} link={"Login"} />}


            {/* Register user Navigation */}
            {
                isRegistered && <div className={" py-4 md:py-6 px-4 md:px-8 xl:px-16 flex justify-between items-center gap-12"}>
                    <Link id="site-logo" href={"/"} className={"font-bold text-3xl"}>Lista</Link>
                    <div className="flex gap-y-2 gap-x-2 md:gap-4 items-center flex-wrap justify-end">

                        {/* Username if registered */}
                        {
                            (isRegistered) &&
                            <div className={" flex gap-2 items-center"}>
                                <span className="inline-block wave-emoji">👋</span>
                                <span className="text-xs md:text-sm lg:text-base"> {extractUserName(userName)}</span>
                            </div>
                        }


                        <Link className="text-primary  py-3 px-6 xl:px-10 text-xs overflow-hidden md:text-base group font-bold rounded-full bg-blue-800 relative" href={"/logout"} >

                            <p className="relative z-20 text-white  group-hover:text-black duration-700">
                                Logout
                            </p>

                            <div className="absolute w-0 h-0 rounded-full group-hover:w-full group-hover:h-full transition-all top-[50%] z-10 left-[50%] -translate-x-1/2 -translate-y-1/2 duration-200 bg-primary">
                            </div>

                        </Link>

                    </div>
                </div>
            }
        </>

    );
}