import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { CloudProvider } from '@/components/CloudProvider';
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
    'fc:miniapp': JSON.stringify({
      version: '1',
      imageUrl: 'https://moodboard-generator-phi.vercel.app/og.png',
      button: {
        title: 'Create Moodboard',
        action: {
          type: 'launch_frame',
          name: 'Moodboard Generator',
          url: 'https://moodboard-generator-phi.vercel.app',
          splashImageUrl: 'https://moodboard-generator-phi.vercel.app/icon.png',
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
      <body className={`${geistSans.variable} antialiased`}>
        <CloudProvider>{children}</CloudProvider>
      </body>
    </html>
  );
}
