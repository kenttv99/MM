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
      // Admin routes (с более высоким приоритетом, должны идти первыми)
      // Исправленные маршруты для admin_auth_router, учитывая префикс /admin 
      {
        source: '/admin/login',
        destination: 'http://localhost:8001/admin/login',
      },
      {
        source: '/admin/register',
        destination: 'http://localhost:8001/admin/register',
      },
      {
        source: '/admin/me',
        destination: 'http://localhost:8001/admin/me',
      },
      {
        source: '/admin/auth/:path*',
        destination: 'http://localhost:8001/admin/auth/:path*',
      },
      {
        source: '/admin/:path*',
        destination: 'http://localhost:8001/admin/:path*',
      },
      
      // Admin edit routes - добавляем маршруты для админских операций редактирования
      {
        source: '/admin_edits/:path*',
        destination: 'http://localhost:8001/admin_edits/:path*',
      },
      {
        source: '/admin_edits/users/:path*',
        destination: 'http://localhost:8001/admin_edits/users/:path*',
      },
      {
        source: '/admin_edits/events/:path*',
        destination: 'http://localhost:8001/admin_edits/events/:path*',
      },
      
      // User routes (с более низким приоритетом)
      {
        source: '/auth/:path*',
        destination: 'http://localhost:8000/auth/:path*',
      },
      {
        source: '/users/:path*',
        destination: 'http://localhost:8000/users/:path*',
      },
      {
        source: '/events/:path*',
        destination: 'http://localhost:8000/events/:path*',
      },
      {
        source: '/user_edits/:path*',
        destination: 'http://localhost:8000/user_edits/:path*',
      },
      {
        source: '/registration/:path*',
        destination: 'http://localhost:8000/registration/:path*',
      },
      // Legacy v1 API routes
      {
        source: '/v1/:path*',
        destination: 'http://localhost:8000/v1/:path*',
      },
      // Notifications
      {
        source: '/notifications/:path*',
        destination: 'http://localhost:8000/notifications/:path*',
      },
      {
        source: '/v1/public/events/:path*',
        destination: 'http://localhost:8000/events/:path*',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig