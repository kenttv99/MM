import { Metadata } from 'next';

const disableIndex = process.env.NEXT_PUBLIC_DISABLE_INDEXING === 'true';
export const metadata: Metadata = {
  title: "Moscow Mellows",
  description: "Vrindavan в центре Москвы",
  viewport: "width=device-width, initial-scale=1",
  icons: { icon: "/favicon.ico" },
  robots: disableIndex
    ? { index: false, follow: false }
    : { index: true, follow: true }
}; 