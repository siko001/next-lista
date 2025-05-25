export default function MinusIcon({className, strokeWidth = 1.5, props}) {
    return (
        <svg
            viewBox="0 0 1024 1024"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            className={className}
            strokeWidth={strokeWidth}
            {...props}
        >
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g
                id="SVGRepo_tracerCarrier"
                strokeLinecap="round"
                strokeLinejoin="round"
            ></g>
            <g id="SVGRepo_iconCarrier">
                <path
                    fill="currentColor"
                    d="M352 480h320a32 32 0 1 1 0 64H352a32 32 0 0 1 0-64z"
                ></path>
                <path
                    fill="currentColor"
                    d="M512 896a384 384 0 1 0 0-768 384 384 0 0 0 0 768zm0 64a448 448 0 1 1 0-896 448 448 0 0 1 0 896z"
                ></path>
            </g>
        </svg>
    );
}
