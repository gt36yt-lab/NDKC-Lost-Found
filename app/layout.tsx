import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NDKC Lost & Found",
  description: "Notre Dame of Kidapawan College Lost and Found Reporting System",
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
