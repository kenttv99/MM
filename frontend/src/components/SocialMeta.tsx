import React from 'react';

interface SocialMetaProps {
  title: string;
  description: string;
  url: string;
  image?: string;
}

const SocialMeta: React.FC<SocialMetaProps> = ({ title, description, url, image }) => (
  <>
    {/* Open Graph */}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Moscow Mellows" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={url} />
    {image && <meta property="og:image" content={image} />}
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    {process.env.NEXT_PUBLIC_FB_APP_ID && (
      <meta property="fb:app_id" content={process.env.NEXT_PUBLIC_FB_APP_ID} />
    )}
    {process.env.NEXT_PUBLIC_VK_APP_ID && (
      <meta property="vk:app_id" content={process.env.NEXT_PUBLIC_VK_APP_ID} />
    )}
    {process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL && (
      <meta name="telegram:channel" content={process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL} />
    )}

    {/* Twitter Cards */}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@MoscowMellows" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    {image && <meta name="twitter:image" content={image} />}
  </>
);

export default SocialMeta; 