import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NDKC Lost & Found",
  description: "Notre Dame of Kidapawan College Lost and Found Reporting System",
  icons: {
    icon: "/Logo.jpg",
    shortcut: "/Logo.jpg",
    apple: "/Logo.jpg",
  },
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
