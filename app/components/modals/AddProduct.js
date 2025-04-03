'use client'
import Button from '../../components/Button';
import gsap from 'gsap';
import { useEffect } from 'react';

export default function AddProduct({ setProductOverlay }) {

    useEffect(() => {
        gsap.set(".close-product-overlay", {
            y: 200,
            opacity: 1,
        })
        gsap.to(".close-product-overlay", {
            y: 0,
            duration: 0.5,
            ease: "power2.out",
        })
    }, [])

    return (
        <div>
            <div className="fixed z-50 inset-0 w-full h-full bg-[#000000cc] blur-sm"></div>
            <div>

            </div>
            <div className="fixed bottom-12 left-[50%] translate-x-[-50%] opacity-0 z-50 close-product-overlay">
                <Button cta="Close Products List" color="#82181a" hover="inwards" action="close-product-overlay" overrideDefaultClasses={"bg-red-500 text-black"} light={true} setProductOverlay={setProductOverlay} />
            </div>

        </div>
    )
}