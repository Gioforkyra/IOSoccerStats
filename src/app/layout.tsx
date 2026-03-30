import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "IOSHUBv2 | Advanced IOSoccer Statistics",
  description:
    "The most advanced statistics hub for IOSoccer. Player profiles, match analytics, shot maps, xG and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-pitch-950 text-chalk-100">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
