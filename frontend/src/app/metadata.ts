import { Metadata } from 'next';

const disableIndex = process.env.NEXT_PUBLIC_DISABLE_INDEXING === 'true';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl || 'https://example.com'),
  title: {
    default: "Moscow Mellows",
    template: "%s – Moscow Mellows",
  },
  description: "Vrindavan в центре Москвы",
  applicationName: 'Moscow Mellows',
  keywords: ['Moscow Mellows', 'киртан', 'мероприятия', 'события', 'медиа', 'ИСККОН', 'Кришна'],
  authors: [{ name: 'Moscow Mellows Team', url: siteUrl }],
  creator: 'Moscow Mellows Team',
  publisher: 'Moscow Mellows',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
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
  ],
  openGraph: {
    title: 'Moscow Mellows',
    description: 'Vrindavan в центре Москвы',
    url: siteUrl,
    siteName: 'Moscow Mellows',
    images: [
      {
        url: '/og-image-default.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Moscow Mellows',
    description: 'Vrindavan в центре Москвы',
    site: '@MoscowMellows',
    creator: '@MoscowMellows',
    images: ['/og-image-default.jpg'],
  },
}; 