/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/images/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/images/users_avatars/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8001',
        pathname: '/images/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/images/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/images/users_avatars/**',
      },
    ],
    // Next.js doesn't support data URLs in Image component by design
    // We're using regular <img> tags for data URLs instead
    // Включаем отладку для Next.js Image Optimization
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    minimumCacheTTL: 60,
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async rewrites() {
    return [
      // Перенаправление для изображений аватаров пользователей
      {
        source: '/images/users_avatars/:path*',
        destination: 'http://localhost:8000/images/users_avatars/:path*'
      },
      {
        source: '/images/:path*',
        destination: 'http://localhost:8000/images/:path*'
      },
      
      // Админские маршруты - приоритет выше, чем у общих
      // Специфические маршруты для админской аутентификации
      {
        source: '/admin/login',
        destination: 'http://localhost:8001/admin/login'
      },
      {
        source: '/admin/register',
        destination: 'http://localhost:8001/admin/register'
      },
      {
        source: '/admin/me',
        destination: 'http://localhost:8001/admin/me'
      },
      {
        source: '/admin/refresh',
        destination: 'http://localhost:8001/admin/refresh'
      },
      
      // Маршруты для админских операций с мероприятиями - важен порядок!
      // 1. Сначала специфические маршруты:
      {
        source: '/admin_edits/users/:id',
        destination: 'http://localhost:8001/admin_edits/users/:id'
      },
      {
        source: '/admin_edits/events/:id',
        destination: 'http://localhost:8001/admin_edits/events/:id'
      },
      // 2. Потом маршруты для операций с конкретными ID:
      {
        source: '/admin_edits/:id/',
        destination: 'http://localhost:8001/admin_edits/:id/'
      },
      {
        source: '/admin_edits/:id',
        destination: 'http://localhost:8001/admin_edits/:id'
      },
      // 3. Корневые маршруты для создания - самый точный маршрут:
      {
        source: '/admin_edits/',
        destination: 'http://localhost:8001/admin_edits/'
      },
      // 4. Маршрут без слеша:
      {
        source: '/admin_edits',
        destination: 'http://localhost:8001/admin_edits/'
      },
      
      // API маршруты для работы с событиями
      {
        source: '/api/events/:id',
        destination: 'http://localhost:8001/admin_edits/:id'
      },
      
      // Общие маршруты в конце
      {
        source: '/admin/:path*',
        destination: 'http://localhost:8001/admin/:path*'
      },
      {
        source: '/admin_edits/:path*',
        destination: 'http://localhost:8001/admin_edits/:path*'
      },
      
      // Пользовательские маршруты
      {
        source: '/auth/:path*',
        destination: 'http://localhost:8000/auth/:path*'
      },
      {
        source: '/users/:path*',
        destination: 'http://localhost:8000/users/:path*'
      },
      // API маршрут для событий - должен быть перед общим маршрутом для страниц мероприятий
      {
        source: '/v1/public/events/:path*',
        destination: 'http://localhost:8000/v1/public/events/:path*'
      },
      // Маршрут для страниц мероприятий не должен перенаправляться на API
      // {
      //   source: '/events/:path*',
      //   destination: 'http://localhost:8000/v1/public/events/:path*'
      // },
      {
        source: '/user_edits/:path*',
        destination: 'http://localhost:8000/user_edits/:path*'
      },
      {
        source: '/registration/:path*',
        destination: 'http://localhost:8000/registration/:path*'
      },
      {
        source: '/v1/:path*',
        destination: 'http://localhost:8000/v1/:path*'
      },
      {
        source: '/notifications/:path*',
        destination: 'http://localhost:8000/notifications/:path*'
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;