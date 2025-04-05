import SettingsIcon from "../svgs/SettingsIcon"
import SearchIcon from "../svgs/SearchIcon"
import Progressbar from "./Progressbar"


export default function ShoppingListHeader({ list }) {
    return (
        <div className="w-full  flex flex-col gap-6  rounded-b-3xl md:min-w-[550px] py-4 px-6 max-[850px] md:w-1/2 bg-gray-900 h-[100px] mx-auto sticky top-0 z-10">
            {/* list name */}
            <div className="flex items-center justify-between gap-12 px-2">
                <h2 className="text-xl md:text-2xl font-bold">{list.title}</h2>
                <div className="flex gap-6 items-center">
                    <SearchIcon className="w-6 h-6 md:w-8 md:h-8 dark:text-gray-600 text-gray-800 hover:text-gray-400 duration-200 transition-colors cursor-pointer" />
                    <SettingsIcon className="w-6 h-6 md:w-8 md:h-8 dark:text-gray-600 text-gray-800 hover:text-gray-400 duration-200 transition-colors cursor-pointer" />
                </div>
            </div>
            <Progressbar progress={0} />
        </div>
    )
}