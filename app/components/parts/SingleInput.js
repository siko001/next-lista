import {useState} from "react";
import {useValidationContext} from "../../contexts/ValidationContext";
import {useListContext} from "../../contexts/ListContext";
import ErrorIcon from "../svgs/ErrorIcon";

export default function SingleInput() {
    const {errors, setErrors, setHasTyped} = useValidationContext();
    const {setShoppingList} = useListContext();
    const [value, setValue] = useState("");
    const [blurred, setBlurred] = useState(false);
    const maxLength = 32;

    const validationMessage = (name) => !name.trim()
        ? "List name required"
        : name.trim().length < 3 ? "Name must be at least 3 characters" : null;

    const handleChange = (e) => {
        const value = e.target.value.slice(0, maxLength);
        setValue(value);
        setHasTyped(value.length > 0);
        setShoppingList((prev) => ({...prev, name: value}));
        // After the first blur or submit, keep feedback current as the user fixes it.
        if (blurred || errors?.message) setErrors({message: validationMessage(value)});
    };

    return (
        <div className="list-name-control">
            <label htmlFor="list-name-input">List name</label>
            <div className={`list-name-field ${errors?.message ? "border-red-500" : ""}`}>
                <input
                    id="list-name-input"
                    value={value}
                    onChange={handleChange}
                    onBlur={() => {
                        setBlurred(true);
                        setErrors({message: validationMessage(value)});
                    }}
                    className="list-name-input"
                    type="text"
                    autoComplete="off"
                    placeholder="e.g. Weekly groceries"
                    maxLength={maxLength}
                    aria-invalid={!!errors?.message}
                    aria-describedby={errors?.message ? "list-name-error" : undefined}
                />
                <p className="list-name-count">
                    <span className={errors?.message ? "text-red-500" : ""}>{value.length}</span>{" "}
                    / {maxLength}
                </p>
            </div>
            {errors?.message && (
                <p className="list-name-error" id="list-name-error" role="alert">
                    <ErrorIcon className={"h-5 w-5"} />
                    {errors.message}
                </p>
            )}
        </div>
    );
}
