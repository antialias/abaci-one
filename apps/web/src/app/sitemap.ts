import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://abaci.one'

  // Main pages
  const routes = ['', '/arcade', '/create', '/guide', '/about', '/why-abacus', '/for-teachers'].map(
    (route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: route === '' ? 1 : 0.8,
    })
  )

  // Arcade games
  const games = [
    '/arcade/rithmomachia',
    '/arcade/complement-race',
    '/arcade/matching',
    '/arcade/memory-quiz',
    '/arcade/card-sorting',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  // Guide pages
  const guides = ['/arcade/rithmomachia/guide'].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  return [...routes, ...games, ...guides]
}
