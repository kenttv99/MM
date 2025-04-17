module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://ваш-домен.ru',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: 'daily',
  priority: 0.7,
  exclude: ['/admin/*', '/api/*'],
};
