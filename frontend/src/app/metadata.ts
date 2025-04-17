import { Metadata } from 'next';

const disableIndex = process.env.NEXT_PUBLIC_DISABLE_INDEXING === 'true';
export const metadata: Metadata = {
  title: "Moscow Mellows",
  description: "Vrindavan в центре Москвы",
  viewport: "width=device-width, initial-scale=1",
  icons: {
    icon: "/icons/favicon.ico",
    shortcut: "/icons/favicon.ico",
    apple: "/icons/apple-touch-icon.png"
  },
  robots: disableIndex
    ? { index: false, follow: false }
    : { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f97316' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ]
}; 