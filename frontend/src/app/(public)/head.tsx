// Создаю файл метаданных для SEO главной страницы
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
};

export default function Head() {
  // Здесь можно добавить JSON-LD или дополнительные теги, если потребуется
  return null;
}
