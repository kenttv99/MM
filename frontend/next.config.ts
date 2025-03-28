/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    console.log("Applying rewrites...");
    return [
      {
        source: "/auth/:path*",
        destination: "http://localhost:8000/auth/:path*",
      },
      {
        source: "/user_edits/:path*",
        destination: "http://localhost:8000/user_edits/:path*",
      },
      {
        source: "/v1/public/events/:path*",
        destination: "http://localhost:8000/v1/public/events/:path*",
      },
      {
        source: "/register",
        destination: "http://localhost:8000/register",
      },
      {
        source: "/admin/:path*",
        destination: "http://localhost:8001/admin/:path*",
      },
      {
        source: "/admin_edits/:path*",
        destination: "http://localhost:8001/admin_edits/:path*",
      },
      // {
      //   source: "/images/:path*",
      //   destination: "http://localhost:8001/images/:path*",
      // },
      {
        source: "/images/:path*",
        destination: "http://localhost:8000/images/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000", // Для сервера пользователей
        pathname: "/images/users_avatars/**",
      },
    ],
  },
};

module.exports = nextConfig;