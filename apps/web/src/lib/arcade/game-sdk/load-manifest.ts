/**
 * Manifest loading and validation utilities
 */

import yaml from 'js-yaml'
import { readFileSync } from 'fs'
import { join } from 'path'
import { validateManifest, type GameManifest } from '../manifest-schema'

/**
 * Load and validate a game manifest from a YAML file
 *
 * @param manifestPath - Absolute path to game.yaml file
 * @returns Validated GameManifest object
 * @throws Error if manifest is invalid or file doesn't exist
 */
export function loadManifest(manifestPath: string): GameManifest {
  try {
    const fileContents = readFileSync(manifestPath, 'utf8')
    const data = yaml.load(fileContents)
    return validateManifest(data)
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load manifest from ${manifestPath}: ${error.message}`)
    }
    throw error
  }
}

/**
 * Load manifest from a game directory
 *
 * @param gameDir - Absolute path to game directory
 * @returns Validated GameManifest object
 */
export function loadManifestFromDir(gameDir: string): GameManifest {
  const manifestPath = join(gameDir, 'game.yaml')
  return loadManifest(manifestPath)
}
