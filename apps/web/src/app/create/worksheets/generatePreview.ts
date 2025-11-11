// Shared logic for generating worksheet previews (used by both API route and SSR)

import { execSync } from 'child_process'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import {
  generateMasteryMixedProblems,
  generateMixedProblems,
  generateProblems,
  generateSubtractionProblems,
} from './problemGenerator'
import { getSkillById } from './skills'
import { generateTypstSource } from './typstGenerator'
import { validateWorksheetConfig } from './validation'

export interface PreviewResult {
  success: boolean
  pages?: string[]
  error?: string
  details?: string
}

/**
 * Generate worksheet preview SVG pages
 * Can be called from API routes or Server Components
 */
export function generateWorksheetPreview(config: WorksheetFormState): PreviewResult {
  try {
    // Validate configuration
    const validation = validateWorksheetConfig(config)
    if (!validation.isValid || !validation.config) {
      return {
        success: false,
        error: 'Invalid configuration',
        details: validation.errors?.join(', '),
      }
    }

    const validatedConfig = validation.config

    // Generate all problems for full preview based on operator
    const operator = validatedConfig.operator ?? 'addition'
    const mode = config.mode ?? 'smart'

    let problems

    // Special handling for mastery + mixed mode
    if (mode === 'mastery' && operator === 'mixed') {
      // Query both skill configs
      const addSkillId = config.currentAdditionSkillId
      const subSkillId = config.currentSubtractionSkillId

      if (!addSkillId || !subSkillId) {
        return {
          success: false,
          error: 'Mixed mastery mode requires both addition and subtraction skill IDs',
          details: `Missing skill IDs - addition: ${addSkillId || 'none'}, subtraction: ${subSkillId || 'none'}. This config may have been shared before mastery mode fields were added to the share system.`,
        }
      }

      const addSkill = getSkillById(addSkillId as any)
      const subSkill = getSkillById(subSkillId as any)

      if (!addSkill || !subSkill) {
        return {
          success: false,
          error: 'Invalid skill IDs',
          details: `Addition skill ID: ${addSkillId} (${addSkill ? 'valid' : 'invalid'}), Subtraction skill ID: ${subSkillId} (${subSkill ? 'valid' : 'invalid'})`,
        }
      }

      // Use skill-specific configs
      problems = generateMasteryMixedProblems(
        validatedConfig.total,
        {
          digitRange: addSkill.digitRange,
          pAnyStart: addSkill.regroupingConfig.pAnyStart,
          pAllStart: addSkill.regroupingConfig.pAllStart,
        },
        {
          digitRange: subSkill.digitRange,
          pAnyStart: subSkill.regroupingConfig.pAnyStart,
          pAllStart: subSkill.regroupingConfig.pAllStart,
        },
        validatedConfig.seed
      )
    } else {
      // Standard problem generation
      problems =
        operator === 'addition'
          ? generateProblems(
              validatedConfig.total,
              validatedConfig.pAnyStart,
              validatedConfig.pAllStart,
              validatedConfig.interpolate,
              validatedConfig.seed,
              validatedConfig.digitRange
            )
          : operator === 'subtraction'
            ? generateSubtractionProblems(
                validatedConfig.total,
                validatedConfig.digitRange,
                validatedConfig.pAnyStart,
                validatedConfig.pAllStart,
                validatedConfig.interpolate,
                validatedConfig.seed
              )
            : generateMixedProblems(
                validatedConfig.total,
                validatedConfig.digitRange,
                validatedConfig.pAnyStart,
                validatedConfig.pAllStart,
                validatedConfig.interpolate,
                validatedConfig.seed
              )
    }

    // Generate Typst sources (one per page)
    const typstSources = generateTypstSource(validatedConfig, problems)

    // Compile each page source to SVG (using stdout for single-page output)
    const pages: string[] = []
    for (let i = 0; i < typstSources.length; i++) {
      const typstSource = typstSources[i]

      // Compile to SVG via stdin/stdout
      try {
        const svgOutput = execSync('typst compile --format svg - -', {
          input: typstSource,
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024, // 10MB limit
        })
        pages.push(svgOutput)
      } catch (error) {
        console.error(`Typst compilation error (page ${i + 1}):`, error)

        // Extract the actual Typst error message
        const stderr =
          error instanceof Error && 'stderr' in error
            ? String((error as any).stderr)
            : 'Unknown compilation error'

        return {
          success: false,
          error: `Failed to compile preview (page ${i + 1})`,
          details: stderr,
        }
      }
    }

    return {
      success: true,
      pages,
    }
  } catch (error) {
    console.error('Error generating preview:', error)

    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      success: false,
      error: 'Failed to generate preview',
      details: errorMessage,
    }
  }
}
