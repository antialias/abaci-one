import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/test/', '/_next/'],
    },
    sitemap: 'https://abaci.one/sitemap.xml',
  }
}
