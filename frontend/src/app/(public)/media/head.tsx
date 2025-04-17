// JSON-LD схема BreadcrumbList
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const breadcrumbList = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Главная", "item": siteUrl },
    { "@type": "ListItem", "position": 2, "name": "Медиа", "item": `${siteUrl}/media` }
  ]
};

export const metadata = {
  title: 'Медиа – Moscow Mellows',
  description: 'Фото, видео и аудио материалы с мероприятий Moscow Mellows.',
  openGraph: {
    title: 'Медиа – Moscow Mellows',
    description: 'Фото, видео и аудио материалы с мероприятий Moscow Mellows.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/media`,
    siteName: 'Moscow Mellows',
    images: [{ url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/og-image-media.jpg`, width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Медиа – Moscow Mellows',
    description: 'Фото, видео и аудио материалы с мероприятий Moscow Mellows.',
    images: [`${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/og-image-media.jpg`],
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/media`,
  },
  // Добавляем JSON-LD BreadcrumbList
  other: {
    "script[type='application/ld+json']": JSON.stringify(breadcrumbList),
  }
}; 