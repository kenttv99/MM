// import React from 'react'; // Удаляем React
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventData } from '@/types/events';

interface GenerateMetadataProps {
  params: { slug: string };
  searchParams: Record<string, string | string[]>;
}

// Переименовываем и меняем сигнатуру
export async function generateMetadata(
  { params, searchParams }: GenerateMetadataProps
): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
  const slug = params.slug;
  const rawId = searchParams['id'];
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : null;

  if (!id) {
    return {
      title: 'Мероприятие – Moscow Mellows'
    };
  }

  // TODO: Заменить на актуальный API-эндпоинт
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/public/events/${id}`, { cache: 'no-cache' });
  if (!res.ok) {
    notFound();
  }
  const event: EventData = await res.json();

  const title = `${event.title} – Moscow Mellows`;
  const description = event.description ? event.description.slice(0, 160) : 'Подробности мероприятия на Moscow Mellows.';
  const url = `${siteUrl}/events/${slug}?id=${id}`;
  const imageUrl = event.image_url ? event.image_url : `${siteUrl}/og-image-default.jpg`; // Добавляем дефолтное изображение

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