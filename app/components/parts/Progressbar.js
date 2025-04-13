export default function Progressbar({ progress }) {
    // Ensure progress is a valid number between 0 and 100
    const validProgress = !isNaN(progress) && progress >= 0 && progress <= 100 ? progress : 0;

    return (
        <div className="w-full h-2 md:h-2.5 dark:bg-gray-600 bg-gray-400 rounded-full">
            <div
                className="bg-green-600 h-full rounded-full transition-all duration-500 ease-in"
                style={{ width: `${validProgress}%` }} // Dynamically set the width
            ></div>
        </div>
    );
}