import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Dev-only API endpoint to save/delete crop coordinates in customCrops.ts
 * Only works in development mode
 *
 * POST: Save a new crop
 * DELETE: Remove a crop
 */

const CUSTOM_CROPS_PATH = join(process.cwd(), 'src/arcade-games/know-your-world/customCrops.ts')

function parseCropsFile(): Record<string, Record<string, string>> {
  const currentContent = readFileSync(CUSTOM_CROPS_PATH, 'utf-8')

  // Find the customCrops assignment and extract the object
  // Look for the pattern and then find the matching closing brace
  const startMatch = currentContent.match(/export const customCrops: CropOverrides = /)
  if (!startMatch || startMatch.index === undefined) {
    console.error('[DevCropTool] Could not find customCrops declaration')
    return {}
  }

  const startIndex = startMatch.index + startMatch[0].length
  let braceCount = 0
  let endIndex = startIndex
  let inString = false
  let stringChar = ''

  for (let i = startIndex; i < currentContent.length; i++) {
    const char = currentContent[i]

    // Handle string literals
    if ((char === "'" || char === '"') && currentContent[i - 1] !== '\\') {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
      }
      continue
    }

    if (inString) continue

    if (char === '{') {
      braceCount++
    } else if (char === '}') {
      braceCount--
      if (braceCount === 0) {
        endIndex = i + 1
        break
      }
    }
  }

  const objectStr = currentContent.slice(startIndex, endIndex)

  try {
    const cleanedObject = objectStr
      .replace(/\/\/.*$/gm, '') // Remove comments
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/'/g, '"') // Convert single quotes to double
    return JSON.parse(cleanedObject)
  } catch (e) {
    console.error('[DevCropTool] Failed to parse crops:', e, objectStr)
    return {}
  }
}

function writeCropsFile(crops: Record<string, Record<string, string>>): void {
  const currentContent = readFileSync(CUSTOM_CROPS_PATH, 'utf-8')

  // Find the customCrops assignment
  const startMatch = currentContent.match(/export const customCrops: CropOverrides = /)
  if (!startMatch || startMatch.index === undefined) {
    console.error('[DevCropTool] Could not find customCrops declaration for writing')
    return
  }

  const declStart = startMatch.index
  const objStart = declStart + startMatch[0].length

  // Find the matching closing brace
  let braceCount = 0
  let endIndex = objStart
  let inString = false
  let stringChar = ''

  for (let i = objStart; i < currentContent.length; i++) {
    const char = currentContent[i]

    if ((char === "'" || char === '"') && currentContent[i - 1] !== '\\') {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
      }
      continue
    }

    if (inString) continue

    if (char === '{') {
      braceCount++
    } else if (char === '}') {
      braceCount--
      if (braceCount === 0) {
        endIndex = i + 1
        break
      }
    }
  }

  // Format the new crops object
  let formattedCrops: string
  if (Object.keys(crops).length === 0) {
    formattedCrops = '{}'
  } else {
    formattedCrops = JSON.stringify(crops, null, 2)
      // Only remove quotes from keys that are valid JS identifiers (no hyphens, spaces, etc.)
      // Valid identifiers: start with letter/$/_,  contain only letters/digits/$/_
      .replace(/"([a-zA-Z_$][a-zA-Z0-9_$]*)":/g, '$1:')
      // Keep quotes but convert to single quotes for keys with special chars (like hyphens)
      .replace(/"([^"]+)":/g, "'$1':")
      .replace(/"/g, "'") // Use single quotes for values
      // Add trailing commas before closing braces/brackets
      .replace(/([^,{\s])\n(\s*[}\]])/g, '$1,\n$2')
  }

  // Replace the object
  const newContent =
    currentContent.slice(0, objStart) + formattedCrops + currentContent.slice(endIndex)

  writeFileSync(CUSTOM_CROPS_PATH, newContent, 'utf-8')
}

interface CropRequest {
  mapId: string
  continentId: string
  viewBox?: string
}

export async function POST(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    )
  }

  try {
    const body: CropRequest = await request.json()
    const { mapId, continentId, viewBox } = body

    if (!mapId || !continentId || !viewBox) {
      return NextResponse.json(
        { error: 'Missing required fields: mapId, continentId, viewBox' },
        { status: 400 }
      )
    }

    const crops = parseCropsFile()

    // Update the crops
    if (!crops[mapId]) {
      crops[mapId] = {}
    }
    crops[mapId][continentId] = viewBox

    writeCropsFile(crops)

    console.log(`[DevCropTool] Saved crop for ${mapId}/${continentId}: ${viewBox}`)

    return NextResponse.json({
      success: true,
      message: `Saved crop for ${mapId}/${continentId}`,
      crops,
    })
  } catch (error) {
    console.error('[DevCropTool] Error saving crop:', error)
    return NextResponse.json(
      { error: 'Failed to save crop', details: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const mapId = searchParams.get('mapId')
    const continentId = searchParams.get('continentId')

    if (!mapId || !continentId) {
      return NextResponse.json(
        { error: 'Missing required query params: mapId, continentId' },
        { status: 400 }
      )
    }

    const crops = parseCropsFile()

    // Check if crop exists
    if (!crops[mapId]?.[continentId]) {
      return NextResponse.json({
        success: true,
        message: `No crop found for ${mapId}/${continentId}`,
        crops,
      })
    }

    // Delete the crop
    delete crops[mapId][continentId]

    // Clean up empty map objects
    if (Object.keys(crops[mapId]).length === 0) {
      delete crops[mapId]
    }

    writeCropsFile(crops)

    console.log(`[DevCropTool] Deleted crop for ${mapId}/${continentId}`)

    return NextResponse.json({
      success: true,
      message: `Deleted crop for ${mapId}/${continentId}`,
      crops,
    })
  } catch (error) {
    console.error('[DevCropTool] Error deleting crop:', error)
    return NextResponse.json(
      { error: 'Failed to delete crop', details: String(error) },
      { status: 500 }
    )
  }
}
