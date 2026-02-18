import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: 'Moodboard Generator',
  description:
    'Create and share beautiful moodboard collages. Upload images, generate artistic layouts, and cast to Farcaster.',
  openGraph: {
    title: 'Moodboard Generator',
    description: 'Create and share beautiful moodboard collages on Farcaster.',
    type: 'website',
  },
  other: {
    'fc:frame': JSON.stringify({
      version: 'next',
      imageUrl: 'https://moodboard.example.com/og.png',
      button: {
        title: 'Create Moodboard',
        action: {
          type: 'launch_frame',
          name: 'Moodboard Generator',
          url: 'https://moodboard.example.com',
          splashBackgroundColor: '#ffffff',
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
