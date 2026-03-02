/**
 * GET/PATCH /api/admin/characters/[id]
 *
 * GET: Returns full character data for admin display.
 *   Query: ?propositionId=1&step=0
 *
 * PATCH: Updates character fields by writing back to source files.
 *   Body: { personality?: Record<string, string>, chat?: Record<string, string>, profilePrompt?: string }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { CHARACTER_PROVIDERS } from '@/lib/character/characters'
import fs from 'fs/promises'
import path from 'path'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const provider = CHARACTER_PROVIDERS[id]
  if (!provider) {
    return NextResponse.json({ error: `Character '${id}' not found` }, { status: 404 })
  }

  const url = new URL(request.url)
  const propositionId = Number(url.searchParams.get('propositionId')) || undefined
  const step = Number(url.searchParams.get('step')) || undefined

  const data = provider.getFullData({ propositionId, step })
  return NextResponse.json(data)
}

/** Source file paths relative to the web app root. */
const WEB_ROOT = path.resolve(process.cwd())

/**
 * Replace a template literal export in a TypeScript source file.
 * Finds `export const NAME = \`...\`` and replaces the backtick content.
 */
async function replaceTemplateExport(
  relativeFile: string,
  exportName: string,
  newContent: string
): Promise<boolean> {
  const filePath = path.join(WEB_ROOT, relativeFile)
  const source = await fs.readFile(filePath, 'utf-8')

  // Match: export const EXPORT_NAME = `...`
  const re = new RegExp(
    `(export const ${exportName} = \`)([\\s\\S]*?)(\`)`,
  )
  const match = source.match(re)
  if (!match) return false

  const updated = source.replace(re, `$1${newContent}$3`)
  await fs.writeFile(filePath, updated, 'utf-8')
  return true
}

/**
 * Replace a string property value in a TypeScript object literal.
 * Finds `propertyName: '...'` or `propertyName: "..."` and replaces the string value.
 */
async function replaceStringProperty(
  relativeFile: string,
  propertyName: string,
  newValue: string
): Promise<boolean> {
  const filePath = path.join(WEB_ROOT, relativeFile)
  const source = await fs.readFile(filePath, 'utf-8')

  // Match: propertyName: '...' or propertyName: "..."
  const re = new RegExp(
    `(${propertyName}:\\s*)(['"])(.*?)\\2`,
  )
  const match = source.match(re)
  if (!match) return false

  const quote = match[2]
  const escaped = newValue.replace(new RegExp(`\\\\${quote}`, 'g'), `\\${quote}`)
  const updated = source.replace(re, `$1${quote}${escaped}${quote}`)
  await fs.writeFile(filePath, updated, 'utf-8')
  return true
}

/** Map of personality block key → export name. */
const PERSONALITY_EXPORT_MAP: Record<string, string> = {
  character: 'EUCLID_CHARACTER',
  teachingStyle: 'EUCLID_TEACHING_STYLE',
  dontDo: 'EUCLID_WHAT_NOT_TO_DO',
  pointLabeling: 'EUCLID_POINT_LABELING',
  hiddenDepth: 'EUCLID_DIAGRAM_QUESTION',
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const provider = CHARACTER_PROVIDERS[id]
  if (!provider) {
    return NextResponse.json({ error: `Character '${id}' not found` }, { status: 404 })
  }

  // Only Euclid is editable for now
  if (id !== 'euclid') {
    return NextResponse.json({ error: 'Only Euclid is editable' }, { status: 400 })
  }

  const body = await request.json()
  const results: Record<string, boolean> = {}

  // Update personality blocks
  if (body.personality && typeof body.personality === 'object') {
    for (const [key, value] of Object.entries(body.personality)) {
      if (typeof value !== 'string') continue
      const exportName = PERSONALITY_EXPORT_MAP[key]
      if (!exportName) continue
      results[`personality.${key}`] = await replaceTemplateExport(
        'src/components/toys/euclid/euclidCharacter.ts',
        exportName,
        value
      )
    }
  }

  // Update chat config strings
  if (body.chat && typeof body.chat === 'object') {
    for (const [key, value] of Object.entries(body.chat)) {
      if (typeof value !== 'string') continue
      results[`chat.${key}`] = await replaceStringProperty(
        'src/components/toys/euclid/euclidCharacterDef.ts',
        key,
        value
      )
    }
  }

  // Update profile prompt
  if (typeof body.profilePrompt === 'string') {
    const filePath = path.join(WEB_ROOT, 'src/app/api/admin/euclid-profile/generate/route.ts')
    const source = await fs.readFile(filePath, 'utf-8')

    // Replace the PROMPT array content
    const re = /(const PROMPT = \[)([\s\S]*?)(\]\.join\(' '\))/
    const match = source.match(re)
    if (match) {
      // Split new prompt into sentence-ish chunks for readability
      const sentences = body.profilePrompt.split('. ').map((s: string) =>
        s.endsWith('.') ? s : `${s}.`
      )
      const arrayContent = sentences.map((s: string) => `\n  ${JSON.stringify(s)},`).join('')
      const updated = source.replace(re, `$1${arrayContent}\n$3`)
      await fs.writeFile(filePath, updated, 'utf-8')
      results['profilePrompt'] = true
    } else {
      results['profilePrompt'] = false
    }
  }

  return NextResponse.json({ results })
}
