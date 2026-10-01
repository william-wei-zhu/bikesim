import type { Metadata, Viewport } from "next";
import { Outfit, Public_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["500", "600", "700"] });
const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "600"] });

const TAGLINE = "Break the walls, ride the city.";

export const metadata: Metadata = {
  metadataBase: new URL("https://ridesimdc.com"),
  title: { default: `RideSim DC: ${TAGLINE}`, template: "%s · RideSim DC" },
  description: TAGLINE,
  openGraph: { title: "RideSim DC", description: TAGLINE, url: "https://ridesimdc.com", siteName: "RideSim DC", type: "website" },
  twitter: { card: "summary_large_image", title: "RideSim DC", description: TAGLINE },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#06182f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${publicSans.variable} ${jetbrains.variable} antialiased`}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
