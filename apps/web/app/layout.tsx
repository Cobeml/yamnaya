import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Yamnaya — Computer maneuver",
  description:
    "Mission-oriented camps of Hermes agents. Research, computer maneuver, and evolving Quarto publications.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
