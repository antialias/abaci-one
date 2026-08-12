/**
 * The metadata helper is the only thing standing between a client-component
 * route and the site-wide default title, so this checks the shape every one of
 * those four layouts depends on.
 */
import { describe, expect, it } from 'vitest'
import { CREATE_TOOLS, type CreateToolId } from '../createToolList'
import { createToolMetadata } from '../createToolMetadata'

describe('createToolMetadata', () => {
  it.each(CREATE_TOOLS.map((tool) => [tool.id, tool] as const))(
    '%s gets its registry copy, a relative canonical, and matching OG tags',
    (_id, tool) => {
      const meta = createToolMetadata(tool.id)

      expect(meta.title).toBe(tool.seo.title)
      expect(meta.description).toBe(tool.seo.description)

      // Relative so the root layout's metadataBase owns the host; an absolute
      // URL here would silently fork the canonical host from the sitemap's.
      expect(meta.alternates?.canonical).toBe(tool.href)
      expect(String(meta.alternates?.canonical)).not.toMatch(/^https?:/)

      expect(meta.openGraph).toMatchObject({
        title: tool.seo.title,
        description: tool.seo.description,
        url: tool.href,
        type: 'website',
      })
    }
  )

  it('does not carry the site title suffix — the root template appends it', () => {
    for (const tool of CREATE_TOOLS) {
      expect(String(createToolMetadata(tool.id).title), tool.id).not.toContain('Abaci One')
    }
  })

  it('throws loudly on an unknown tool rather than shipping a default title', () => {
    expect(() => createToolMetadata('not-a-tool' as CreateToolId)).toThrow(/unknown create tool/)
  })
})
