import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Reliability Report Card",
  description:
    "Run the same coding task 10 times, each on its own throwaway machine. See how often your agent succeeds - and how it fails when it doesn't.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
