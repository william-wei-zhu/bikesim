import type { Metadata, Viewport } from "next";
import { Outfit, Public_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["500", "600", "700"] });
const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "600"] });

const TAGLINE = "Feel it before you ride it.";

export const metadata: Metadata = {
  metadataBase: new URL("https://bikesim.org"),
  title: { default: `BikeSim: ${TAGLINE}`, template: "%s · BikeSim" },
  description: "See how stressful every block of a city bike trip will be, then ride it virtually before you go.",
  openGraph: { title: "BikeSim", description: TAGLINE, url: "https://bikesim.org", siteName: "BikeSim", type: "website" },
  twitter: { card: "summary_large_image", title: "BikeSim", description: TAGLINE },
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
        <Analytics />
      </body>
    </html>
  );
}
