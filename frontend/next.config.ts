/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/auth/:path*',
        destination: 'http://localhost:8000/auth/:path*', // URL вашего FastAPI-сервера для пользователей
      },
      {
        source: '/admin/:path*',
        destination: 'http://localhost:8001/admin/:path*', // Для аутентификации администраторов
      },
      {
        source: '/admin_edits/:path*',
        destination: 'http://localhost:8001/admin_edits/:path*', // Для действий администраторов
      },
      {
        source: '/events/:path*',
        destination: 'http://localhost:8001/events/:path*', // Для публичных маршрутов мероприятий
      },
    ];
  },
};

module.exports = nextConfig;