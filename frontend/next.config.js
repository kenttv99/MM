// Загружаем переменные из .env.local
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenvResult = require('dotenv').config({ path: '.env.local' });

if (dotenvResult.error) {
  console.error("🔴 Ошибка загрузки .env.local:", dotenvResult.error);
  throw new Error("Не удалось загрузить переменные окружения из .env.local. Сборка остановлена.");
}

console.log("Переменные из .env.local загружены:", dotenvResult.parsed);

// Получаем URL из переменных окружения, удаляя возможный слеш в конце
// Проверяем наличие переменных и выбрасываем ошибку, если их нет
const backendApiUrlRaw = process.env.NEXT_PUBLIC_API_URL;
const adminApiUrlRaw = process.env.NEXT_ADMIN_API_URL;

if (!backendApiUrlRaw) {
  throw new Error('Переменная NEXT_PUBLIC_API_URL не найдена в .env.local или process.env!');
}
if (!adminApiUrlRaw) {
  throw new Error('Переменная NEXT_ADMIN_API_URL не найдена в .env.local или process.env!');
}

const backendApiUrl = backendApiUrlRaw.replace(/\/$/, '');
const adminApiUrl = adminApiUrlRaw.replace(/\/$/, '');

console.log("Using Backend API URL:", backendApiUrl);
console.log("Using Admin API URL:", adminApiUrl);

// Извлекаем hostname и port для конфигурации images
const backendUrlParts = new URL(backendApiUrl);
const backendHostname = backendUrlParts.hostname;
const backendPort = backendUrlParts.port;

const adminUrlParts = new URL(adminApiUrl);
const adminHostname = adminUrlParts.hostname; // Скорее всего совпадет, но для полноты

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Домены можно брать из URL
    domains: [backendHostname, adminHostname],
    remotePatterns: [
      // Паттерны для основного бэкенда
      {
        protocol: backendUrlParts.protocol.replace(':', ''), // 'http' или 'https'
        hostname: backendHostname,
        port: backendPort,
        pathname: '/media/**',
      },
      {
        protocol: backendUrlParts.protocol.replace(':', ''),
        hostname: backendHostname,
        port: backendPort,
        pathname: '/images/**',
      },
      {
        protocol: backendUrlParts.protocol.replace(':', ''),
        hostname: backendHostname,
        port: backendPort,
        pathname: '/images/users_avatars/**',
      },
      // Паттерны для localhost:3000 (frontend) - оставить, если нужны
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
    console.log("Configuring rewrites for backend URLs:", backendApiUrl, adminApiUrl);
    return [
      // Перенаправление для изображений аватаров пользователей
      {
        source: '/images/users_avatars/:path*',
        destination: `${backendApiUrl}/images/users_avatars/:path*`
      },
      {
        source: '/images/:path*',
        destination: `${backendApiUrl}/images/:path*`
      },

      // Админские маршруты - приоритет выше, чем у общих
      // Специфические маршруты для админской аутентификации
      {
        source: '/admin/login',
        destination: `${adminApiUrl}/admin/login`
      },
      {
        source: '/admin/register',
        destination: `${adminApiUrl}/admin/register`
      },
      {
        source: '/admin/me',
        destination: `${adminApiUrl}/admin/me`
      },
      {
        source: '/admin/refresh',
        destination: `${adminApiUrl}/admin/refresh`
      },

      // Маршруты для админских операций с мероприятиями - важен порядок!
      // 1. Сначала специфические маршруты:
      {
        source: '/admin_edits/users/:id',
        destination: `${adminApiUrl}/admin_edits/users/:id`
      },
      {
        source: '/admin_edits/events/:id',
        destination: `${adminApiUrl}/admin_edits/events/:id`
      },
      // 2. Потом маршруты для операций с конкретными ID:
      {
        source: '/admin_edits/:id/',
        destination: `${adminApiUrl}/admin_edits/:id/`
      },
      {
        source: '/admin_edits/:id',
        destination: `${adminApiUrl}/admin_edits/:id`
      },
      // 3. Корневые маршруты для создания - самый точный маршрут:
      {
        source: '/admin_edits/',
        destination: `${adminApiUrl}/admin_edits/`
      },
      // 4. Маршрут без слеша:
      {
        source: '/admin_edits',
        destination: `${adminApiUrl}/admin_edits/`
      },

      // API маршруты для работы с событиями
      {
        source: '/api/events/:id',
        // Этот маршрут вел на admin_edits, убедитесь, что это правильно
        destination: `${adminApiUrl}/admin_edits/:id`
      },

      // Общие маршруты в конце
      {
        source: '/admin/:path*',
        destination: `${adminApiUrl}/admin/:path*`
      },
      {
        source: '/admin_edits/:path*',
        destination: `${adminApiUrl}/admin_edits/:path*`
      },

      // Пользовательские маршруты
      {
        source: '/auth/:path*',
        destination: `${backendApiUrl}/auth/:path*`
      },
      {
        source: '/users/:path*',
        destination: `${backendApiUrl}/users/:path*`
      },
      // API маршрут для событий - должен быть перед общим маршрутом для страниц мероприятий
      {
        source: '/v1/public/events/:path*',
        destination: `${backendApiUrl}/v1/public/events/:path*`
      },
      // Маршрут для страниц мероприятий не должен перенаправляться на API
      // {
      //   source: '/events/:path*',
      //   destination: `${backendApiUrl}/v1/public/events/:path*` // Закомментировано у вас, оставил так же
      // },
      {
        source: '/user_edits/:path*',
        destination: `${backendApiUrl}/user_edits/:path*`
      },
      {
        source: '/registration/:path*',
        destination: `${backendApiUrl}/registration/:path*`
      },
      {
        source: '/v1/:path*',
        destination: `${backendApiUrl}/v1/:path*`
      },
      {
        source: '/notifications/:path*',
        destination: `${backendApiUrl}/notifications/:path*`
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