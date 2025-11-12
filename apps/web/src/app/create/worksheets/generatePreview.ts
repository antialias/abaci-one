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
import { validateProblemSpace } from './utils/validateProblemSpace'

export interface PreviewResult {
  success: boolean
  pages?: string[]
  totalPages?: number
  startPage?: number
  endPage?: number
  error?: string
  details?: string
  warnings?: string[] // Added for problem space validation warnings
}

/**
 * Generate worksheet preview SVG pages
 * Can be called from API routes or Server Components
 * @param config - Worksheet configuration
 * @param startPage - Optional start page (0-indexed, inclusive). Default: 0
 * @param endPage - Optional end page (0-indexed, inclusive). Default: last page
 */
export function generateWorksheetPreview(
  config: WorksheetFormState,
  startPage?: number,
  endPage?: number
): PreviewResult {
  const totalProblems = (config.problemsPerPage ?? 20) * (config.pages ?? 1)
  console.log(`[PREVIEW] Starting generation: ${totalProblems} problems, pages ${config.pages}`)

  try {
    console.log('[PREVIEW] Step 1: Validating configuration...')
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
    console.log('[PREVIEW] Step 1: ✓ Configuration valid')

    // Generate all problems for full preview based on operator
    const operator = validatedConfig.operator ?? 'addition'
    const mode = config.mode ?? 'smart'

    console.log(
      `[PREVIEW] Step 2: Generating ${validatedConfig.total} problems (mode: ${mode}, operator: ${operator})...`
    )

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

    console.log(`[PREVIEW] Step 2: ✓ Generated ${problems.length} problems`)

    // Generate Typst sources (one per page)
    console.log(`[PREVIEW] Step 3: Generating Typst source for ${validatedConfig.pages} pages...`)
    const startTypst = Date.now()
    const typstSources = generateTypstSource(validatedConfig, problems)
    const typstTime = Date.now() - startTypst
    const totalPages = typstSources.length
    console.log(`[PREVIEW] Step 3: ✓ Generated ${totalPages} Typst sources in ${typstTime}ms`)

    // Determine range to compile
    const start = startPage !== undefined ? Math.max(0, startPage) : 0
    const end = endPage !== undefined ? Math.min(endPage, totalPages - 1) : totalPages - 1

    // Validate range
    if (start > end || start >= totalPages) {
      return {
        success: false,
        error: `Invalid page range: start=${start}, end=${end}, totalPages=${totalPages}`,
      }
    }

    console.log(
      `[PREVIEW] Step 4: Compiling pages ${start}-${end} (${end - start + 1} pages) to SVG...`
    )

    // Compile only requested page range to SVG
    const pages: string[] = []
    const compileStart = Date.now()
    for (let i = start; i <= end; i++) {
      const pageStart = Date.now()
      const typstSource = typstSources[i]

      // Compile to SVG via stdin/stdout
      try {
        const svgOutput = execSync('typst compile --format svg - -', {
          input: typstSource,
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024, // 10MB limit
        })
        const pageTime = Date.now() - pageStart
        console.log(`[PREVIEW] Step 4.${i + 1}: ✓ Page ${i} compiled in ${pageTime}ms`)
        pages.push(svgOutput)
      } catch (error) {
        console.error(`Typst compilation error (page ${i}):`, error)

        // Extract the actual Typst error message
        const stderr =
          error instanceof Error && 'stderr' in error
            ? String((error as any).stderr)
            : 'Unknown compilation error'

        return {
          success: false,
          error: `Failed to compile preview (page ${i})`,
          details: stderr,
        }
      }
    }

    const totalCompileTime = Date.now() - compileStart
    console.log(
      `[PREVIEW] Step 4: ✓ All ${pages.length} pages compiled in ${totalCompileTime}ms (avg: ${Math.round(totalCompileTime / pages.length)}ms/page)`
    )

    return {
      success: true,
      pages,
      totalPages,
      startPage: start,
      endPage: end,
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

/**
 * Generate a single worksheet page SVG
 * Much faster than generating all pages when you only need one
 */
export function generateSinglePage(
  config: WorksheetFormState,
  pageNumber: number
): SinglePageResult {
  try {
    // First, validate and get total page count
    const validation = validateWorksheetConfig(config)
    if (!validation.isValid || !validation.config) {
      return {
        success: false,
        error: 'Invalid configuration',
        details: validation.errors?.join(', '),
      }
    }

    const validatedConfig = validation.config
    const totalPages = validatedConfig.pages

    // Check if requested page is valid
    if (pageNumber < 0 || pageNumber >= totalPages) {
      return {
        success: false,
        error: `Invalid page number ${pageNumber}. Total pages: ${totalPages}`,
      }
    }

    // Generate all problems (need full set to know which problems go on which page)
    // This is unavoidable because problems are distributed across pages
    const operator = validatedConfig.operator ?? 'addition'
    const mode = config.mode ?? 'smart'

    let problems

    // Same problem generation logic as generateWorksheetPreview
    if (mode === 'mastery' && operator === 'mixed') {
      const addSkillId = config.currentAdditionSkillId
      const subSkillId = config.currentSubtractionSkillId

      if (!addSkillId || !subSkillId) {
        return {
          success: false,
          error: 'Mixed mastery mode requires both addition and subtraction skill IDs',
        }
      }

      const addSkill = getSkillById(addSkillId as any)
      const subSkill = getSkillById(subSkillId as any)

      if (!addSkill || !subSkill) {
        return {
          success: false,
          error: 'Invalid skill IDs',
        }
      }

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
    } else if (operator === 'mixed') {
      problems = generateMixedProblems(
        validatedConfig.total,
        validatedConfig.digitRange,
        validatedConfig.pAnyStart,
        validatedConfig.pAllStart,
        validatedConfig.seed
      )
    } else if (operator === 'subtraction') {
      problems = generateSubtractionProblems(
        validatedConfig.total,
        validatedConfig.digitRange,
        validatedConfig.pAnyStart,
        validatedConfig.pAllStart,
        validatedConfig.seed
      )
    } else {
      problems = generateProblems(
        validatedConfig.total,
        validatedConfig.digitRange,
        validatedConfig.pAnyStart,
        validatedConfig.pAllStart,
        validatedConfig.seed
      )
    }

    // Generate Typst source for ALL pages (lightweight operation)
    const typstSources = generateTypstSource(problems, validatedConfig)

    // Only compile the requested page
    const typstSource = typstSources[pageNumber]

    try {
      const svgOutput = execSync('typst compile --format svg - -', {
        input: typstSource,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      })

      return {
        success: true,
        page: svgOutput,
        totalPages,
      }
    } catch (error) {
      console.error(`Typst compilation error (page ${pageNumber}):`, error)

      const stderr =
        error instanceof Error && 'stderr' in error
          ? String((error as any).stderr)
          : 'Unknown compilation error'

      return {
        success: false,
        error: `Failed to compile page ${pageNumber}`,
        details: stderr,
      }
    }
  } catch (error) {
    console.error('Error generating single page:', error)

    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      success: false,
      error: 'Failed to generate page',
      details: errorMessage,
    }
  }
}
