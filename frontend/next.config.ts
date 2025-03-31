/** @type {import('next').NextConfig} */
const USER_API_URL = "http://localhost:8000";
const ADMIN_API_URL = "http://localhost:8001";

const nextConfig = {
  async rewrites() {
    console.log("Applying rewrites...");
    return [
      // Пользовательский сервер (порт 8000)
      { source: "/auth/:path*", destination: `${USER_API_URL}/auth/:path*` },
      { source: "/user_edits/:path*", destination: `${USER_API_URL}/user_edits/:path*` },
      { source: "/v1/public/events/:path*", destination: `${USER_API_URL}/v1/public/events/:path*` },
      { source: "/register", destination: `${USER_API_URL}/register` },
      { source: "/images/:path*", destination: `${USER_API_URL}/images/:path*` },

      // Административный сервер (порт 8001)
      { source: "/admin/:path*", destination: `${ADMIN_API_URL}/admin/:path*` },
      { source: "/admin_edits/:path*", destination: `${ADMIN_API_URL}/admin_edits/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000", // Оставляем порт для изображений пользователей
        pathname: "/images/users_avatars/**",
      },
      // Добавляем паттерн для администраторских изображений, если нужно
      {
        protocol: "http",
        hostname: "localhost",
        port: "8001",
        pathname: "/images/**",
      },
    ],
  },
};

module.exports = nextConfig;