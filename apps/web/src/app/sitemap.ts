import type { MetadataRoute } from 'next'
import { CREATE_TOOLS } from '@/lib/create-tools/createToolList'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://abaci.one'

  // Main pages
  const routes = [
    '',
    '/arcade',
    '/create',
    '/guide',
    '/about',
    '/why-abacus',
    '/for-teachers',
    '/features/worksheet-parsing',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

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

  // Create tools, straight off the registry so a new tool is listed the day it
  // ships. Tier drives priority the same way games sit below the top routes.
  const createTools = CREATE_TOOLS.map((tool) => ({
    url: `${baseUrl}${tool.href}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: tool.tier === 'primary' ? 0.8 : 0.6,
  }))

  return [...routes, ...games, ...guides, ...createTools]
}
