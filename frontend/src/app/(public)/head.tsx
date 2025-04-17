// import React from "react"; // Удаляем неиспользуемый импорт
// Удаляем импорт SocialMeta, так как Head будет удален
// import SocialMeta from '@/components/SocialMeta';

// JSON-LD схема WebSite
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
  name: 'MOSCOW MELLOWS'
};

export const metadata = {
  title: 'MOSCOW MELLOWS – Главная',
  description: 'Официальный сайт Moscow Mellows. Узнайте о мероприятиях, просматривайте медиа и следите за событиями.',
  keywords: ['Moscow Mellows', 'мероприятия', 'события', 'медиа', 'фото', 'видео', 'аудио'],
  openGraph: {
    title: 'MOSCOW MELLOWS – Главная',
    description: 'Официальный сайт Moscow Mellows. Узнайте о мероприятиях, просматривайте медиа и следите за событиями.',
    locale: 'ru_RU',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
    siteName: 'Moscow Mellows',
    images: [{ url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/og-image-home.jpg`, width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MOSCOW MELLOWS – Главная',
    description: 'Официальный сайт Moscow Mellows. Узнайте о мероприятиях, просматривайте медиа и следите за событиями.',
    images: [`${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/og-image-home.jpg`],
    site: '@MoscowMellows'
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
  },
  // Добавляем JSON-LD в metadata
  other: {
    "script[type='application/ld+json']": JSON.stringify(websiteSchema),
  }
};

// Удаляем экспорт по умолчанию Head
// export default function Head() { ... }
