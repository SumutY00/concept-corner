import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import './themes.css'
import ToastContainer from './components/ToastContainer'
import BottomNav from './components/BottomNav'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Concept Corner',
  description: 'Konseptlerini paylaş, ilham al, yaratıcıları takip et.',
  manifest: '/manifest.json',
  openGraph: {
    siteName: 'Concept Corner',
    title: 'Concept Corner',
    description: 'Konseptlerini paylaş, ilham al, yaratıcıları takip et.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Concept Corner',
    description: 'Konseptlerini paylaş, ilham al, yaratıcıları takip et.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Concept Corner" />
        <meta name="theme-color" content="#4F7CFF" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('cc-theme')||'dark-social';document.documentElement.setAttribute('data-theme',t);}catch(e){}})()` }} />
      </head>
      <body className="min-h-full flex flex-col">
  {children}
  <BottomNav />
  <ToastContainer />
</body>
    </html>
  );
}
