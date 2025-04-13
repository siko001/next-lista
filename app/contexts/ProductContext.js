'use client';
import { createContext, useContext, useState } from 'react';
import { decryptToken, WP_API_BASE } from '../lib/helpers';

const ProductContext = createContext();

export const ProductProvider = ({ children }) => {
    const [products, setProducts] = useState([]);

    const getAllProducts = async (encryptedToken) => {
        const token = decryptToken(encryptedToken);
        if (!token) {
            return [];
        }
        const url = `${WP_API_BASE}/custom/v1/products`;
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            const data = await response.json();
            return data
        } catch (error) {
            console.error("Failed to fetch all products:", error);
            return [];
        }
    }



    return (
        <ProductContext.Provider value={{
            getAllProducts,
            products,
            setProducts
        }}>
            {children}
        </ProductContext.Provider>
    );
};

export const useProductContext = () => useContext(ProductContext);
