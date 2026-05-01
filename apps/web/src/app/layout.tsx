import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FocusPad - Tiny focus timer + notes for Mac",
  description: "A small, fast desktop focus timer with notes. Native for macOS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
