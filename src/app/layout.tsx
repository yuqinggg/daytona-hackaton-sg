import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Reliability Report Card",
  description: "Run one agent task 50 times in 50 isolated sandboxes. Get a number.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
