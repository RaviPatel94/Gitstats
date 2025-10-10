import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "GitHub Card Generator - Create Beautiful Profile Cards",
    template: "%s | GitHub Card Generator"
  },
  description: "Free GitHub card generator tool to create stunning profile cards. Display your GitHub stats, repositories, and contributions with customizable designs. Perfect for developers and portfolios.",
  keywords: [
    "GitHub Card Generator",
    "GitHub profile card",
    "GitHub stats card",
    "GitHub API card generator",
    "developer portfolio card",
    "GitHub profile generator free",
    "GitHub badge creator",
    "GitHub username card maker",
    "GitHub profile viewer",
    "GitHub contribution card",
    "custom GitHub card",
    "GitHub profile summary card",
    "open source profile card",
    "GitHub card for portfolio",
    "developer card generator"
  ],
  authors: [{ name: "Ravi Patel" }],
  creator: "Ravi Patel",
  publisher: "Ravi Patel",
  metadataBase: new URL('https://gityou.vercel.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://gityou.vercel.app',
    title: 'GitHub Card Generator - Create Beautiful Profile Cards',
    description: 'Free tool to create stunning GitHub profile cards. Display your GitHub stats, repositories, and contributions with customizable designs.',
    siteName: 'GitYou - GitHub Card Generator',
    images: [
      {
        url: '/assets/template.png',
        width: 630 ,
        height:1200,
        alt: 'GitYou GitHub Card Generator Preview',
      }
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'Technology',
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
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}