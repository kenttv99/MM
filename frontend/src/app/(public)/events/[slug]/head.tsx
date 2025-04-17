import React from 'react';
import { notFound } from 'next/navigation';
import { EventData } from '@/types/events';

interface HeadProps {
  params: { slug: string };
  searchParams: Record<string, string | string[]>;
}

export default async function Head({ params, searchParams }: HeadProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
  const slug = params.slug;
  const rawId = searchParams['id'];
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : null;

  if (!id) {
    return <title>Мероприятие – Moscow Mellows</title>;
  }

  const res = await fetch(`${siteUrl}/v1/public/events/${id}`, { cache: 'no-cache' });
  if (!res.ok) {
    notFound();
  }
  const event: EventData = await res.json();

  const title = `${event.title} – Moscow Mellows`;
  const description = event.description ? event.description.slice(0, 160) : '';
  const url = `${siteUrl}/events/${slug}?id=${id}`;

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
    image: event.image_url ? [event.image_url] : undefined,
    startDate: event.start_date,
    endDate: event.end_date || event.start_date,
    location: event.location ? { "@type": "Place", name: event.location } : undefined,
    url,
    offers: {
      "@type": "Offer",
      url,
      price: event.price,
      priceCurrency: "USD",
      availability: event.status === 'registration_open'
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut"
    }
  };

  const jsonLd = [breadcrumbList, eventSchema];

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {event.image_url && <meta property="og:image" content={event.image_url} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {event.image_url && <meta name="twitter:image" content={event.image_url} />}

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
} 