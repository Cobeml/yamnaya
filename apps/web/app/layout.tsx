import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Yamnaya — Mission control",
  description:
    "Mission-oriented defense across code, data, people, and physical assets. A synthetic utility demonstration.",
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
