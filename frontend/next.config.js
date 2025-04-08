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
    ],
  },
  async rewrites() {
    return [
      // User server routes (port 8000)
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
      // Fix the user_edits path to ensure it's properly routed
      {
        source: '/user_edits/:path*',
        destination: 'http://localhost:8000/user_edits/:path*',
      },
      // Add registration path
      {
        source: '/registration/:path*',
        destination: 'http://localhost:8000/registration/:path*',
      },
      // Admin server routes (port 8001)
      {
        source: '/admin/auth/:path*',
        destination: 'http://localhost:8001/admin/auth/:path*',
      },
      {
        source: '/admin/:path*',
        destination: 'http://localhost:8001/admin/:path*',
      },
      // Legacy v1 API routes (if needed)
      {
        source: '/v1/:path*',
        destination: 'http://localhost:8000/v1/:path*',
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