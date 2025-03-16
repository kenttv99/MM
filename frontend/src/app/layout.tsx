import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css"; // или "./globals.postcss" если вы переименовали файл

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Moscow Mellows',
  description: 'Moscow Mellows - ваша платформа для мероприятий',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}