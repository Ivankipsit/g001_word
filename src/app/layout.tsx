import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { ThemeRegistry } from "@/components/ThemeRegistry";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://wordforge.ashwinagilan.com"),
  title: "Word Forge",
  description:
    "Browser-first English word-building idle game. Forge anagrams, unlock letters, earn offline coins.",
  applicationName: "Word Forge",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Word Forge",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Word Forge",
    description:
      "Browser-first English word-building idle game. Forge anagrams, unlock letters, earn offline coins.",
    url: "https://wordforge.ashwinagilan.com",
    siteName: "Word Forge",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#2A6F6F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full`}>
      <body className="min-h-full">
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
