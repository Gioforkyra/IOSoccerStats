import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "IOStats — Advanced IOSoccer Statistics",
  description:
    "The most advanced statistics hub for IOSoccer. Player profiles, match analytics, shot maps, xG and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-pitch-950 text-chalk-100">
        <Navbar />
        <main>{children}</main>
        <footer className="border-t border-chalk-100/5 py-8 mt-16">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-chalk-400 text-sm font-body">
            <span>IOStats — not affiliated with IOSoccer Team</span>
            <span className="font-mono text-xs">v0.1.0</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
