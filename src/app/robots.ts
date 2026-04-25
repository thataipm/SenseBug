import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/results/',
          '/processing',
          '/settings',
          '/account',
          '/historyRun',
          '/api/',
          '/checkout',
        ],
      },
    ],
    sitemap: 'https://www.sensebug.com/sitemap.xml',
  }
}
