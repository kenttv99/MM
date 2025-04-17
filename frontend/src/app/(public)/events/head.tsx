// Создаю файл метаданных для SEO страницы списка мероприятий
export const metadata = {
  title: 'Все мероприятия – Moscow Mellows',
  description: 'Просмотрите все предстоящие и завершенные мероприятия Moscow Mellows.',
  openGraph: {
    title: 'Все мероприятия – Moscow Mellows',
    description: 'Просмотрите все предстоящие и завершенные мероприятия Moscow Mellows.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/events`,
    siteName: 'Moscow Mellows',
    images: [{ url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/og-image-events.jpg`, width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Все мероприятия – Moscow Mellows',
    description: 'Просмотрите все предстоящие и завершенные мероприятия Moscow Mellows.',
    images: [`${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/og-image-events.jpg`],
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/events`,
  },
};

export default function Head() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
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
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbList) }} />
    </>
  );
} 