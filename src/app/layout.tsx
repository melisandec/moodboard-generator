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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://auth.farcaster.xyz" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} antialiased bg-background text-foreground`}>
        <CloudProvider>{children}</CloudProvider>
      </body>
    </html>
  );
}
