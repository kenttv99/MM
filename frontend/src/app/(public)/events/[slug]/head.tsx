// import React from 'react'; // Удаляем React
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventData } from '@/types/events';

interface GenerateMetadataProps {
  params: { slug: string };
  // searchParams больше не нужен
  // searchParams: Record<string, string | string[]>;
}

// Переименовываем и меняем сигнатуру
export async function generateMetadata(
  { params }: GenerateMetadataProps
): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const slug = params.slug;
  // Убираем чтение ID из searchParams, используем slug из пути
  // const rawId = searchParams['id'];
  // const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : null;

  // Убираем проверку на id, так как slug всегда должен быть
  // if (!id) { ... }

  // Используем slug в URL запроса к API
  // Удаляем TODO комментарий, так как эндпоинт верен
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/public/events/${slug}`, { cache: 'no-cache' });
  if (!res.ok) {
    // Если API вернул 404, используем notFound() из Next.js
    if (res.status === 404) {
      notFound();
    }
    // Для других ошибок можно выбросить исключение или вернуть дефолтные метаданные
    console.error(`API Error fetching event ${slug}: ${res.status}`);
    // Можно добавить возврат дефолтных метаданных или обработку ошибки
    // return { title: 'Ошибка загрузки мероприятия' };
    notFound(); // Пока используем notFound для всех ошибок API
  }
  const event: EventData = await res.json();

  const title = `${event.title} – Moscow Mellows`;
  const description = event.description ? event.description.slice(0, 160) : 'Подробности мероприятия на Moscow Mellows.';
  // Используем канонический slug из ответа API для формирования canonical URL
  const canonicalSlug = event.url_slug || slug; // Используем slug из параметров, если API не вернул
  const url = `${siteUrl}/events/${canonicalSlug}`;
  const imageUrl = event.image_url ? event.image_url : `${siteUrl}/og-image-default.jpg`;

  // BreadcrumbList JSON-LD
  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Главная", "item": siteUrl },
      { "@type": "ListItem", "position": 2, "name": "Все мероприятия", "item": `${siteUrl}/events` },
      { "@type": "ListItem", "position": 3, "name": event.title, "item": url }
    ]
  };

  // Event schema JSON-LD
  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    image: [imageUrl],
    startDate: event.start_date,
    endDate: event.end_date || event.start_date,
    location: event.location ? { "@type": "Place", name: event.location } : undefined,
    url,
    offers: {
      "@type": "Offer",
      url,
      price: event.price,
      priceCurrency: "RUB", // TODO: Уточнить валюту!
      availability: event.status === 'registration_open'
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut"
    }
  };

  const jsonLd = [breadcrumbList, eventSchema];

  // Возвращаем объект Metadata
  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
        },
      ],
      locale: 'ru_RU',
      type: 'article', // Или 'event' если применимо и поддерживается
      siteName: 'Moscow Mellows',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      site: '@MoscowMellows', // Добавляем хэндл твиттера
    },
    // Добавляем JSON-LD
    other: {
      "script[type='application/ld+json']": JSON.stringify(jsonLd),
    }
  };
} 