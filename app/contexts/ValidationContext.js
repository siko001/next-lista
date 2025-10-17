"use client";
import {createContext, useContext, useState} from "react";

const ValidationContext = createContext();

export const ValidationProvider = ({children}) => {
    const [errors, setErrors] = useState({
        type: null,
        message: null,
    });

    const [hasTyped, setHasTyped] = useState(false);

    return (
        <ValidationContext.Provider
            value={{
                errors,
                setErrors,
                hasTyped,
                setHasTyped,
            }}
        >
            {children}
        </ValidationContext.Provider>
    );
};

export const useValidationContext = () => useContext(ValidationContext);
