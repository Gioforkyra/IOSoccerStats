import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Scores — IOSHUBv2",
  description: "Watch IOSoccer matches live with real-time scores and match updates.",
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
