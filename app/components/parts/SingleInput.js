import { useRef, useState } from "react";
import { useValidationContext } from "../../contexts/ValidationContext";
import { useListContext } from "../../contexts/ListContext";
import ErrorIcon from "../svgs/ErrorIcon";

export default function SingleInput() {
	const { errors, setErrors, hasTyped, setHasTyped } = useValidationContext();
	const { setShoppingList } = useListContext();
	const [length, setLength] = useState(0);
	// Track if the user has started typing
	const inputRef = useRef(null);
	const parentRef = useRef(null);
	const timeoutRef = useRef(null);
	const maxLength = 32;

	const handleChange = (e) => {
		const value = e.target.value.slice(0, maxLength);
		e.target.value = value;
		setLength(value.length);

		// Mark that user has started typing
		if (!hasTyped && value.length > 0) {

			setHasTyped(true);
		}

		// Clear previous timeout
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		// Set a new timeout for validation message
		timeoutRef.current = setTimeout(() => {
			if (parentRef.current) {
				console.log("value", value);
				if (value.length === 0) {
					setErrors({ message: "List Name required" });
					parentRef.current.classList.add("border-red-500");
				} else
					if (value.length < 3) {
						setErrors({ message: "Name must be at least 3 characters" });
						parentRef.current.classList.add("border-red-500");
					} else {
						setErrors({ message: null });
						parentRef.current.classList.remove("border-red-500");
						setShoppingList((prev) => ({ ...prev, name: value }));
					}
			}
		}, 100);
	};

	return (
		<div className={"flex flex-col items-start gap-2"}>
			<div ref={parentRef} className="w-full items-start relative flex items-center justify-between bg-gray-200 h-[50px] rounded-md border border-blue-500 overflow-hidden">
				<input ref={inputRef} onChange={handleChange} className="focus:outline-none w-full flex py-3 px-2 items-center" type="text" placeholder="Give your list-a name" maxLength={maxLength} />
				<p className="w-min whitespace-nowrap bg-white h-full flex items-center px-2 text-xs ">
					<span className={`${hasTyped && (length < 3 && length >= 0) && "text-red-500"}`}>{length} </span> / {maxLength}
				</p>
			</div>
			{errors.message && <p className=" py-2 px-2 bg-red-400 rounded-sm text-white flex gap-1 items-center text-xs"><ErrorIcon className={"h-5 w-5"} />{errors.message}</p>}
		</div>
	);
}
