// import React from "react"; // Удаляем неиспользуемый импорт
// Удаляем импорт SocialMeta, так как Head будет удален
// import SocialMeta from '@/components/SocialMeta';

// JSON-LD схема WebSite
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL; // Определяем siteUrl один раз
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  url: siteUrl, // Используем siteUrl
  name: 'MOSCOW MELLOWS'
};

export const metadata = {
  title: 'MOSCOW MELLOWS – Главная',
  description: 'Официальный сайт Moscow Mellows. Узнайте о мероприятиях, просматривайте медиа и следите за событиями.',
  keywords: ['Moscow Mellows', 'мероприятия', 'события', 'медиа', 'фото', 'видео', 'аудио', 'киртан', 'Кришна', 'ИСККОН'],
  openGraph: {
    title: 'MOSCOW MELLOWS – Главная',
    description: 'Официальный сайт Moscow Mellows. Узнайте о мероприятиях, просматривайте медиа и следите за событиями.',
    locale: 'ru_RU', // Исправлено: одна локаль
    url: siteUrl, // Используем siteUrl
    siteName: 'Moscow Mellows',
    images: [{ url: `${siteUrl}/og-image-home.jpg`, width: 1200, height: 630 }], // Используем siteUrl
    type: 'website',
  },
  twitter: { // Раскомментировано
    card: 'summary_large_image',
    title: 'MOSCOW MELLOWS – Главная',
    description: 'Официальный сайт Moscow Mellows. Узнайте о мероприятиях, просматривайте медиа и следите за событиями.',
    images: [`${siteUrl}/og-image-home.jpg`], // Используем siteUrl, убран fallback
    site: '@MoscowMellows'
  },
  alternates: {
    canonical: siteUrl, // Используем siteUrl, убран fallback
    languages: { // Добавлена альтернативная локаль
      // 'en-US': `${siteUrl}/en`, // Закомментировано, если нет английской версии
      'ru-RU': `${siteUrl}/`,
    },
  },
  // Добавляем JSON-LD в metadata
  other: {
    "script[type='application/ld+json']": JSON.stringify(websiteSchema),
  }
};

// Удаляем экспорт по умолчанию Head
// export default function Head() { ... }
