// Создаю файл метаданных для SEO страницы списка мероприятий
// JSON-LD схема BreadcrumbList
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const breadcrumbList = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Главная",
      "item": siteUrl
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Все мероприятия",
      "item": `${siteUrl}/events`
    }
  ]
};

export const metadata = {
  title: 'Все мероприятия – Moscow Mellows',
  description: 'Просмотрите все предстоящие и завершенные мероприятия Moscow Mellows.',
  openGraph: {
    title: 'Все мероприятия – Moscow Mellows',
    description: 'Просмотрите все предстоящие и завершенные мероприятия Moscow Mellows.',
    url: `${siteUrl}/events`,
    siteName: 'Moscow Mellows',
    images: [{ url: `${siteUrl}/og-image-events.jpg`, width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Все мероприятия – Moscow Mellows',
    description: 'Просмотрите все предстоящие и завершенные мероприятия Moscow Mellows.',
    images: [`${siteUrl}/og-image-events.jpg`],
    site: '@MoscowMellows'
  },
  alternates: {
    canonical: `${siteUrl}/events`,
  },
  // Добавляем JSON-LD BreadcrumbList
  other: {
    "script[type='application/ld+json']": JSON.stringify(breadcrumbList),
  }
}; 