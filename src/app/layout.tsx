import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cacsms Engine",
  description: "Enterprise command center for autonomous AI forex trading operations.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
