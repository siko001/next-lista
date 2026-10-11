/** @type {import('next').NextConfig} */
const nextConfig = {
    // A release check can run while the normal development server is open.
    distDir: process.env.LISTA_NEXT_BUILD_DIR || ".next",
    reactStrictMode: true,
    images: {
        domains: ["lh3.googleusercontent.com", "platform-lookaside.fbsbx.com"],
    },
};

export default nextConfig;
