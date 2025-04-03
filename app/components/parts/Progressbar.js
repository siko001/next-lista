export default function Progressbar({ progress }) {
    return (
        <div className="w-full h-2 md:h-2.5 dark:bg-gray-600 bg-gray-400 rounded-full">
            <div className="w-[0%] bg-green-600 h-full rounded-full"></div>
        </div>
    );
}