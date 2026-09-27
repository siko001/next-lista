'use client';
import { createContext, useContext, useState } from 'react';
import {getAllProducts as fetchAllProducts} from '../lib/helpers';

const ProductContext = createContext();

export const ProductProvider = ({ children }) => {
    const [products, setProducts] = useState([]);

    const getAllProducts = async (encryptedToken) => {
        return fetchAllProducts(encryptedToken);
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
