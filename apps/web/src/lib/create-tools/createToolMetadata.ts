import type { Metadata } from 'next'
import { type CreateToolId, getCreateTool } from './createToolList'

/**
 * `<head>` metadata for one create tool, from the registry's `seo` block.
 *
 * Factored rather than copied into each route's layout so the five tools can't
 * drift into five different shapes — add a field here and every tool gets it.
 *
 * Canonicals are relative on purpose: the root layout sets
 * `metadataBase: new URL('https://abaci.one')`, so Next resolves them and the
 * host lives in exactly one place. The root also sets a `'%s | Abaci One'`
 * title template, which is why these titles don't carry the suffix themselves.
 */
export function createToolMetadata(id: CreateToolId): Metadata {
  const tool = getCreateTool(id)
  // Unreachable for a valid `CreateToolId`; a loud build failure beats a page
  // that quietly ships with the site-wide default title.
  if (!tool) throw new Error(`createToolMetadata: unknown create tool "${id}"`)

  const { title, description } = tool.seo
  return {
    title,
    description,
    alternates: { canonical: tool.href },
    openGraph: { title, description, url: tool.href, type: 'website' },
  }
}
