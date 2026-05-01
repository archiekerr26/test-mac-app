import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeetCommand - Mic, volume, devices in your macOS menu bar",
  description: "A tiny macOS menu bar control surface for audio: mute the mic, switch input or output device, push the system volume around — without opening System Settings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
