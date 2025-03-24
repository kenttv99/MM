/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/images/:path*', // Все запросы к /images/...
        destination: 'http://localhost:8001/images/:path*', // Перенаправляем на FastAPI
      },
      {
        source: '/admin/:path*', // Для API-роутов админа
        destination: 'http://localhost:8001/admin/:path*',
      },
      {
        source: '/admin_edits/:path*', // Для редактирования
        destination: 'http://localhost:8001/admin_edits/:path*',
      },
      {
        source: '/events/:path*', // Для публичных мероприятий
        destination: 'http://localhost:8001/events/:path*',
      },
      {
        source: '/auth/:path*', // Для авторизации пользователей
        destination: 'http://localhost:8000/auth/:path*', // server_user.py на 8000
      },
    ];
  },
};

export default nextConfig;