import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

/*
 * The guide specifies Britti Sans, which is licensed and cannot be shipped
 * here. Hanken Grotesk is the closest free match on the axes that matter for
 * the brand: geometric skeleton, tall x-height, and a lowercase that still
 * reads as deliberate at display size.
 */
const brand = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agent Reliability Report Card",
  description:
    "Run the same coding task 10 times, each on its own throwaway machine. See how often your agent succeeds - and how it fails when it doesn't.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={brand.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
