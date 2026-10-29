import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Warmline",
  description: "A companion that remembers what matters about the people you care about.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
