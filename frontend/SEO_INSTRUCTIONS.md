# SEO‑оптимизация для проекта "Moscow Mellows"

## 1. Общая структура метаданных

В Next.js App‑директории используются:
- `app/metadata.ts` — глобальные метаданные (для всех страниц).
- `app/(public)/*/head.tsx` — файлы, экспортирующие page-specific объект `metadata` или асинхронную функцию `generateMetadata` для каждой публичной страницы.

Next.js автоматически собирает метаданные из `app/metadata.ts` и соответствующего файла `head.tsx` (или `layout.tsx`/`page.tsx`, если `head.tsx` отсутствует) и генерирует теги `<title>`, `<meta>`, Open Graph, Twitter Cards, JSON-LD и др. на стороне сервера.

---

## 2. Пояснение полей метаданных

### 2.1. Title
- Тег `<title>` — заголовок вкладки браузера и сниппета в выдаче.
- Рекомендация: 50–60 символов, включать ключевые слова (например, «Мероприятия – Moscow Mellows»).

### 2.2. Description
- `<meta name="description">` — описание для сниппета. 
- Длина: 150–160 символов, естественный язык + ключи.

### 2.3. Keywords
- `<meta name="keywords">` — устаревший, но иногда учитывается (`['мероприятия', 'медиа', ...]`).

### 2.4. Viewport
- `<meta name="viewport" content="width=device-width, initial-scale=1">` — адаптивность.

### 2.5. Robots
- `<meta name="robots">` контролирует индексацию
  - `index, follow` — разрешить
  - `noindex, nofollow` — запретить
- Мы динамически переключаем через `NEXT_PUBLIC_DISABLE_INDEXING=true|false`.

### 2.6. Icons
- `<link rel="icon" href="/favicon.ico">` или `icons: { icon: "/favicon.ico" }`.

### 2.7. Canonical
- `<link rel="canonical" href="https://site/текущая-страница">`
- Устраняет проблемы дублей URL (query‑параметры и `/events/[slug]?id=`).

### 2.8. Open Graph (OG)
- `og:title`, `og:description`, `og:url`, `og:site_name`, `og:image`, `og:locale`
- Для красивых превью при шаринге в соцсетях.

### 2.9. Twitter Cards
- `twitter:card` (`summary_large_image`), `twitter:site` (`@MoscowMellows`), `twitter:title`, `twitter:description`, `twitter:image`.

### 2.10. JSON‑LD (schema.org)
- `<script type="application/ld+json">` для структурированных данных.
- Добавляется через поле `metadata.other`:
  ```ts
  // В файле head.tsx или metadata.ts
  const mySchema = { "@context": "...", ... };
  export const metadata = {
    // ... другие поля
    other: {
      "script[type='application/ld+json']": JSON.stringify(mySchema),
    }
  };
  ```
- Используем:
  - `WebSite` (на главной)
  - `BreadcrumbList` — хлебные крошки.

---

## 3. Управление индексацией

1. Добавьте в корень проекта файл `.env.local`:
   ```bash
   NEXT_PUBLIC_DISABLE_INDEXING=true
   ```
2. В `app/metadata.ts` мы проверяем переменную:
   ```ts
   const disableIndex = process.env.NEXT_PUBLIC_DISABLE_INDEXING === 'true';
   metadata.robots = disableIndex
     ? { index: false, follow: false }
     : { index: true, follow: true };
   ```
3. При деплое на боевой сервер флаг `true` → все страницы получают `<meta name="robots" content="noindex, nofollow">`.
4. После настройки выключите флаг или переключите на `false` → индексация включится.

---

## 4. Дополнительные рекомендации для профессионалов

- **robots.txt** — разместить в `public/robots.txt` и закрыть `/admin`, `/api`.
- **Sitemap.xml** — автоматически генерировать (через скрипт или плагин) и указывать в robots.txt.
- **Hreflang** — при мультиязычности `<link rel="alternate" hreflang="ru" href="…" />`, `<link rel="alternate" hreflang="en" …/>`.
- **Canonical pagination** — для разбивки на страницы: `rel="prev"`/`rel="next"`.
- **Rich Snippets** — FAQ, HowTo, Product, VideoObject для медиа-контента.
- **Preload / Prefetch** критических ресурсов (шрифты, hero‑image).
- **Оптимизация производительности** (Core Web Vitals): lazy‑load, оптимизация картинок.
- **Accessibility**: правильные теги `h1–h6`, `alt` у `<img>`, семантика.

---

## 5. Переход к мультиязычности

1. В `next.config.js` добавить:
   ```js
   i18n: { locales: ['ru', 'en'], defaultLocale: 'ru' }
   ```
2. Разбить App‑директорию на `/ru` и `/en`.
3. В `generateMetadata({ params, locale })` возвращать переведённые `title`, `description`, `keywords`, `hreflang`.
4. Адаптировать JSON‑LD (локаль, тексты схем) под каждый язык.
5. Добавить переключатель языка и многоязычные словари.

---

## 6. Дополнительные файлы и настройки

Чтобы довести SEO до «профессионального» уровня, создайте и настройте следующие вспомогательные файлы:

1. `public/robots.txt`
   - Опишите правила для поисковых роботов:
     ```txt
     User-agent: *
     Disallow: /admin/
     Disallow: /api/
     Sitemap: https://your-domain.com/sitemap.xml
     ```

2. `next-sitemap.config.js` (или `next-sitemap.js`)
   - Конфиг для пакетa `next-sitemap`:
     ```js
     module.exports = {
       siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.com',
       generateRobotsTxt: true,
       sitemapSize: 7000,
       changefreq: 'daily',
       priority: 0.7,
       exclude: ['/admin/*', '/api/*'],
     }
     ```

3. Автоматически генерируемый `sitemap.xml`
   - При билде скрипт `next-sitemap` создаст его в корне `public/`.

4. `public/manifest.webmanifest`
   - Для PWA‑работоспособности и кастомизации иконок:
     ```json
     {
       "name": "Moscow Mellows",
       "short_name": "Mellows",
       "start_url": "/",
       "display": "standalone",
       "background_color": "#ffffff",
       "theme_color": "#f97316",
       "icons": [
         { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
         { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
       ]
     }
     ```

5. Папка `public/icons/`
   - Набор иконок разных размеров, включая Apple Touch (`apple-touch-icon.png`).

6. `public/robots.txt` и `public/sitemap.xml` должны быть доступны по корневым URL:
   - `https://site.com/robots.txt`  
   - `https://site.com/sitemap.xml`

7. Файл `_headers` (для Netlify) или `.htaccess` (для Apache)
   - Настройки кеширования и редиректы (https, www, без/с `/`).

8. Добавьте в `head.tsx` глобальные `<link rel="manifest" href="/manifest.webmanifest">`, `<meta name="theme-color" content="#f97316">`.

---

## 7. Схема компонентов и файлов

Ниже краткая схема, какие файлы участвуют в SEO и за что отвечают:

- **`app/metadata.ts`**
  - Глобальные настройки SEO: `metadataBase`, `title` (default + template), `description`, `keywords`, `authors`, `openGraph` (default), `twitter` (default), `viewport`, `icons`, `robots`, `manifest`, `themeColor`.

- **`app/(public)/head.tsx`**
  - Главная страница сайта.
  - Экспортирует `metadata`, переопределяя `title`, `description`, `openGraph`, `twitter`.
  - Включает JSON‑LD схему `WebSite` через `metadata.other`.

- **`app/(public)/events/head.tsx`**
  - Статическая страница «Все мероприятия».
  - Экспортирует `metadata`, переопределяя `title`, `description`, `openGraph`, `twitter`.
  - Включает JSON‑LD `BreadcrumbList` через `metadata.other`.

- **`app/(public)/media/head.tsx`**
  - Статическая страница «Медиа».
  - Экспортирует `metadata`, переопределяя `title`, `description`, `openGraph`, `twitter`.
  - Включает JSON‑LD `BreadcrumbList` через `metadata.other`.

- **`app/(public)/events/[slug]/head.tsx`**
  - Динамическая страница конкретного события.
  - Экспортирует асинхронную функцию `generateMetadata({ params })`, которая фетчит данные события и возвращает `metadata`.
  - Переопределяет `title`, `description`, `openGraph`, `twitter`, `canonical`.
  - Включает JSON‑LD схемы `BreadcrumbList` и `Event` через `metadata.other`.

- **`.env.local`**
  - Переменные окружения для SEO:
    - `NEXT_PUBLIC_SITE_URL` — базовый URL сайта (используется для `metadataBase` и др.)
    - `NEXT_PUBLIC_DISABLE_INDEXING` — флаг `noindex`/`index`
    - `NEXT_PUBLIC_FB_APP_ID`, `NEXT_PUBLIC_VK_APP_ID`, `NEXT_PUBLIC_TELEGRAM_CHANNEL` (используются, если нужны специфичные мета-теги, которых нет в стандартном `Metadata` API)

- **`public/robots.txt`**, **`public/manifest.webmanifest`**, **`public/icons/`**, **`public/og-image-*.jpg`**, **`next-sitemap.config.js`**, **`public/_headers`**, **`.htaccess`**
  - Вспомогательные файлы: правила для роботов, карта сайта, PWA-манифест, иконки, OG-изображения, Netlify/Apache настройки.

--- 

*Соблюдение всех этих шагов позволит сайту Moscow Mellows занять лидирующие позиции в рунете и заложить прочный фундамент для дальнейшего развития.* 