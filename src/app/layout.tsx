import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Github Card generator",
  description: "Create yourself a github card",
  keywords: [
    "GitHub Card",
    "GitHub profile generator",
    "GitHub API",
    "developer portfolio",
    "open source profile card",
    "GitHub badge",
    "developer card",
    "GitHub profile viewer",
    "GitHub username card",
    "GitHub profile summary"
  ]
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content="ZVCjYC2fcAJ7t7xzTIQ8OGPdZ2JphfM37hcle0fsrjY" />
      </head>
      <body
        style={{ fontFamily: '"IBM Plex Sans Condensed", sans-serif' }}
        className={` antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
