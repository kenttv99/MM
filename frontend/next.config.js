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
        port: '8001',
        pathname: '/images/**',
      },
    ],
  },
  async rewrites() {
    return [
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
      
      // Специфические маршруты для админских операций над событиями
      // Важно: сначала URL со слешем в конце
      {
        source: '/admin_edits/',
        destination: 'http://localhost:8001/admin_edits/'
      },
      {
        source: '/admin_edits',
        destination: 'http://localhost:8001/admin_edits'
      },
      {
        source: '/admin_edits/:id/',
        destination: 'http://localhost:8001/admin_edits/:id/'
      },
      {
        source: '/admin_edits/:id',
        destination: 'http://localhost:8001/admin_edits/:id'
      },
      {
        source: '/admin_edits/users/:id',
        destination: 'http://localhost:8001/admin_edits/users/:id'
      },
      {
        source: '/admin_edits/events/:id',
        destination: 'http://localhost:8001/admin_edits/events/:id'
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
      {
        source: '/events/:path*',
        destination: 'http://localhost:8000/events/:path*'
      },
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
      {
        source: '/v1/public/events/:path*',
        destination: 'http://localhost:8000/events/:path*'
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