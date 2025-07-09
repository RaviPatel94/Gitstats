import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Github Card",
  description: "Create yourself a github card",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif' }}
        className={` antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
