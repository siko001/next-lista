import { Geist, Geist_Mono } from "next/font/google";
import { UserProvider } from "./contexts/UserContext";
import { OverlayProvider } from "./contexts/OverlayContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ValidationProvider } from "./contexts/ValidationContext";
import { ListProvider } from "./contexts/ListContext";
import { LoadingProvider } from "./contexts/LoadingContext";
import { ProductProvider } from "./contexts/ProductContext";
import "./globals.css";
import { Quicksand, Saira } from 'next/font/google';

const quicksand = Quicksand({
	subsets: ['latin'],
	weight: ['300', '400', '500', '600', '700'],
	display: 'swap',
	variable: '--font-quicksand',
});

const saira = Saira({
	subsets: ['latin'],
	weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
	style: ['normal', 'italic'],
	display: 'swap',
	variable: '--font-saira',
});


const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata = {
	title: "Lista V2",
	description: "Revamp of Lista with new features and design",
	icons: {
		icon: "/favicon.png",
	},
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body className={`${geistSans.variable} ${geistMono.variable} ${saira} ${quicksand} antialiased`}>
				<LoadingProvider>
					<NotificationProvider>
						<ListProvider>
							<UserProvider>
								<ProductProvider>
									<ValidationProvider>
										<OverlayProvider>
											{children}
										</OverlayProvider>
									</ValidationProvider>
								</ProductProvider>
							</UserProvider>
						</ListProvider>
					</NotificationProvider>
				</LoadingProvider>
			</body>
		</html>
	);
}