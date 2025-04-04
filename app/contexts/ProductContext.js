'use client';
import { createContext, useContext, useState } from 'react';
import { decryptToken } from '../lib/helpers';

const ProductContext = createContext();

export const ProductProvider = ({ children }) => {

    // Base URL for your WordPress site
    const WP_API_BASE = 'https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';
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
            // console.log("data from getAllProducts:", data);
            // setProducts(data);
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
