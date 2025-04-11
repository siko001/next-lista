const MessengerIcon = ({ props, className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
        viewBox="0 0 24 24"
    >
        <g id="brand" fill="none" fillRule="evenodd" stroke="none" strokeWidth="1">
            <g id="messanger" fill="#000">
                <path
                    id="Shape"
                    d="m12.942 14.413-2.56-2.66L5.45 14.48l5.406-5.736 2.56 2.66 4.93-2.727zM11.899 2C6.432 2 2 6.144 2 11.257c0 2.908 1.434 5.503 3.678 7.2V22l3.378-1.874c.9.252 1.855.388 2.843.388 5.468 0 9.9-4.145 9.9-9.257 0-5.113-4.432-9.257-9.9-9.257"
                ></path>
            </g>
        </g>
    </svg>
);

export default MessengerIcon;
