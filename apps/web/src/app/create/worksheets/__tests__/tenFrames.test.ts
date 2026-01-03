// Unit tests for ten-frames rendering
// These tests verify the complete path from config -> display rules -> Typst template

import { describe, it, expect } from 'vitest'
import { analyzeProblem } from '../problemAnalysis'
import { evaluateRule, resolveDisplayForProblem } from '../displayRules'
import type { DisplayRules } from '../displayRules'
import { generateTypstSource } from '../typstGenerator'
import type { WorksheetConfig, WorksheetProblem } from '@/app/create/worksheets/types'

describe('Ten-frames rendering', () => {
  describe('Problem analysis', () => {
    it('should detect regrouping in 45 + 27', () => {
      const meta = analyzeProblem(45, 27)
      expect(meta.requiresRegrouping).toBe(true)
      expect(meta.regroupCount).toBe(1) // Ones place: 5 + 7 = 12
    })

    it('should detect regrouping in 8 + 7', () => {
      const meta = analyzeProblem(8, 7)
      expect(meta.requiresRegrouping).toBe(true)
      expect(meta.regroupCount).toBe(1)
    })

    it('should not detect regrouping in 12 + 23', () => {
      const meta = analyzeProblem(12, 23)
      expect(meta.requiresRegrouping).toBe(false)
      expect(meta.regroupCount).toBe(0)
    })
  })

  describe('Display rule evaluation', () => {
    it('should resolve "whenRegrouping" to true for problem with regrouping', () => {
      const meta = analyzeProblem(45, 27) // Has regrouping
      const result = evaluateRule('whenRegrouping', meta)
      expect(result).toBe(true)
    })

    it('should resolve "whenRegrouping" to false for problem without regrouping', () => {
      const meta = analyzeProblem(12, 23) // No regrouping
      const result = evaluateRule('whenRegrouping', meta)
      expect(result).toBe(false)
    })

    it('should resolve "always" to true regardless of problem', () => {
      const meta = analyzeProblem(12, 23) // No regrouping
      const result = evaluateRule('always', meta)
      expect(result).toBe(true)
    })

    it('should resolve "never" to false regardless of problem', () => {
      const meta = analyzeProblem(45, 27) // Has regrouping
      const result = evaluateRule('never', meta)
      expect(result).toBe(false)
    })
  })

  describe('Full display rules resolution', () => {
    it('should resolve showTenFrames: true for regrouping problem with "whenRegrouping" rule', () => {
      const rules: DisplayRules = {
        carryBoxes: 'whenRegrouping',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'whenRegrouping', // ← This should trigger for 45 + 27
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'never',
        borrowingHints: 'never',
      }

      const meta = analyzeProblem(45, 27) // Has regrouping (5 + 7 = 12)
      const resolved = resolveDisplayForProblem(rules, meta)

      expect(resolved.showTenFrames).toBe(true)
    })

    it('should resolve showTenFrames: false for non-regrouping problem with "whenRegrouping" rule', () => {
      const rules: DisplayRules = {
        carryBoxes: 'whenRegrouping',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'whenRegrouping',
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'never',
        borrowingHints: 'never',
      }

      const meta = analyzeProblem(12, 23) // No regrouping
      const resolved = resolveDisplayForProblem(rules, meta)

      expect(resolved.showTenFrames).toBe(false)
    })
  })

  describe('Typst template generation', () => {
    it('should pass showTenFrames: true to Typst template for regrouping problems', () => {
      const config: WorksheetConfig = {
        version: 4,
        mode: 'custom',
        problemsPerPage: 4,
        cols: 2,
        pages: 1,
        total: 4,
        rows: 2,
        orientation: 'portrait',
        name: 'Test Student',
        date: '2025-11-10',
        seed: 12345,
        fontSize: 12,
        digitRange: { min: 2, max: 2 },
        operator: 'addition',
        pAnyStart: 1.0, // 100% regrouping
        pAllStart: 0,
        displayRules: {
          carryBoxes: 'whenRegrouping',
          answerBoxes: 'always',
          placeValueColors: 'always',
          tenFrames: 'whenRegrouping', // ← Key rule being tested
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'never',
          borrowingHints: 'never',
        },
        interpolate: false,
        page: { wIn: 8.5, hIn: 11 },
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 },
      }

      const problems: WorksheetProblem[] = [
        { operator: 'add', a: 45, b: 27 }, // Has regrouping
        { operator: 'add', a: 38, b: 54 }, // Has regrouping
      ]

      const typstPages = generateTypstSource(config, problems)

      // Should generate at least one page
      expect(typstPages.length).toBeGreaterThan(0)

      const firstPage = typstPages[0]

      // Should include showTenFrames: true in problem data
      expect(firstPage).toContain('showTenFrames: true')

      // Should NOT contain showTenFrames: false (all problems have regrouping)
      expect(firstPage).not.toContain('showTenFrames: false')
    })

    it('should include ten-frames rendering code when showTenFrames: true', () => {
      const config: WorksheetConfig = {
        version: 4,
        mode: 'custom',
        problemsPerPage: 2,
        cols: 1,
        pages: 1,
        total: 2,
        rows: 2,
        orientation: 'portrait',
        name: 'Test Student',
        date: '2025-11-10',
        seed: 12345,
        fontSize: 12,
        digitRange: { min: 1, max: 1 },
        operator: 'addition',
        pAnyStart: 1.0,
        pAllStart: 0,
        displayRules: {
          carryBoxes: 'whenRegrouping',
          answerBoxes: 'always',
          placeValueColors: 'always',
          tenFrames: 'whenRegrouping',
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'never',
          borrowingHints: 'never',
        },
        interpolate: false,
        page: { wIn: 8.5, hIn: 11 },
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 },
      }

      const problems: WorksheetProblem[] = [
        { operator: 'add', a: 8, b: 7 }, // 8 + 7 = 15, has regrouping
      ]

      const typstPages = generateTypstSource(config, problems)
      const firstPage = typstPages[0]

      // Should include the ten-frames function
      expect(firstPage).toContain('ten-frames-stacked')

      // Should include regrouping detection logic
      expect(firstPage).toContain('regrouping-places')

      // Should include contains() method for array membership
      expect(firstPage).toContain('.contains(')
    })

    it('should handle manual mode with showTenFrames: true', () => {
      const config: WorksheetConfig = {
        version: 4,
        mode: 'manual',
        problemsPerPage: 2,
        cols: 1,
        pages: 1,
        total: 2,
        rows: 2,
        orientation: 'portrait',
        name: 'Test Student',
        date: '2025-11-10',
        seed: 12345,
        fontSize: 12,
        digitRange: { min: 2, max: 2 },
        operator: 'addition',
        pAnyStart: 0.5,
        pAllStart: 0,
        // Manual mode uses boolean flags
        showCarryBoxes: true,
        showAnswerBoxes: true,
        showPlaceValueColors: true,
        showTenFrames: true, // ← Explicitly enabled
        showProblemNumbers: true,
        showCellBorder: true,
        showTenFramesForAll: false,
        interpolate: false,
        page: { wIn: 8.5, hIn: 11 },
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 },
      }

      const problems: WorksheetProblem[] = [
        { operator: 'add', a: 45, b: 27 },
        { operator: 'add', a: 12, b: 23 }, // No regrouping, but should still show frames
      ]

      const typstPages = generateTypstSource(config, problems)
      const firstPage = typstPages[0]

      // All problems should have showTenFrames: true in manual mode
      const tenFramesMatches = firstPage.match(/showTenFrames: true/g)
      expect(tenFramesMatches?.length).toBe(2) // Both problems
    })
  })

  describe('Mastery progression mode', () => {
    it('should use displayRules when in mastery mode (step 0: full scaffolding)', () => {
      // Simulating mastery mode step 0 with full scaffolding
      const config: WorksheetConfig = {
        version: 4,
        mode: 'mastery',
        problemsPerPage: 20,
        cols: 4,
        pages: 1,
        total: 20,
        rows: 5,
        orientation: 'portrait',
        name: 'Test Student',
        date: '2025-11-10',
        seed: 12345,
        fontSize: 12,
        digitRange: { min: 1, max: 1 },
        operator: 'addition',
        pAnyStart: 1.0, // 100% regrouping
        pAllStart: 0,
        displayRules: {
          carryBoxes: 'whenRegrouping',
          answerBoxes: 'always',
          placeValueColors: 'always',
          tenFrames: 'whenRegrouping', // ← Full scaffolding
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'never',
          borrowingHints: 'never',
        },
        interpolate: false,
        page: { wIn: 8.5, hIn: 11 },
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 },
      }

      const problems: WorksheetProblem[] = [
        { operator: 'add', a: 8, b: 7 }, // Has regrouping
        { operator: 'add', a: 9, b: 6 }, // Has regrouping
      ]

      const typstPages = generateTypstSource(config, problems)
      const firstPage = typstPages[0]

      // Should include ten-frames for all regrouping problems
      expect(firstPage).toContain('showTenFrames: true')
      expect(firstPage).toContain('ten-frames-stacked')
    })

    it('should not show ten-frames in mastery mode step 1 (scaffolding faded)', () => {
      const config: WorksheetConfig = {
        version: 4,
        mode: 'mastery',
        problemsPerPage: 20,
        cols: 4,
        pages: 1,
        total: 20,
        rows: 5,
        orientation: 'portrait',
        name: 'Test Student',
        date: '2025-11-10',
        seed: 12345,
        fontSize: 12,
        digitRange: { min: 1, max: 1 },
        operator: 'addition',
        pAnyStart: 1.0,
        pAllStart: 0,
        displayRules: {
          carryBoxes: 'whenRegrouping',
          answerBoxes: 'always',
          placeValueColors: 'always',
          tenFrames: 'never', // ← Scaffolding faded
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'never',
          borrowingHints: 'never',
        },
        interpolate: false,
        page: { wIn: 8.5, hIn: 11 },
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 },
      }

      const problems: WorksheetProblem[] = [
        { operator: 'add', a: 8, b: 7 }, // Has regrouping
      ]

      const typstPages = generateTypstSource(config, problems)
      const firstPage = typstPages[0]

      // Should NOT show ten-frames (rule is 'never')
      expect(firstPage).toContain('showTenFrames: false')
    })
  })

  describe('Mixed mode operator-specific scaffolding', () => {
    it('should apply additionDisplayRules to addition problems in mixed mode', () => {
      const config: WorksheetConfig = {
        version: 4,
        mode: 'mastery',
        problemsPerPage: 4,
        cols: 2,
        pages: 1,
        total: 4,
        rows: 2,
        orientation: 'portrait',
        name: 'Test Student',
        date: '2025-11-10',
        seed: 12345,
        fontSize: 12,
        digitRange: { min: 2, max: 2 },
        operator: 'mixed',
        pAnyStart: 1.0,
        pAllStart: 0,
        // Default display rules (not used for operator-specific problems)
        displayRules: {
          carryBoxes: 'never',
          answerBoxes: 'never',
          placeValueColors: 'never',
          tenFrames: 'never',
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'never',
          borrowingHints: 'never',
        },
        // Operator-specific rules
        additionDisplayRules: {
          carryBoxes: 'whenRegrouping',
          answerBoxes: 'always',
          placeValueColors: 'always',
          tenFrames: 'whenRegrouping', // ← Addition should show ten-frames
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'never',
          borrowingHints: 'never',
        },
        subtractionDisplayRules: {
          carryBoxes: 'never',
          answerBoxes: 'always',
          placeValueColors: 'never',
          tenFrames: 'never', // ← Subtraction should NOT show ten-frames
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'whenRegrouping',
          borrowingHints: 'never',
        },
        interpolate: false,
        page: { wIn: 8.5, hIn: 11 },
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 },
      } as any // Cast to any to allow operator-specific rules

      const problems: WorksheetProblem[] = [
        { operator: 'add', a: 45, b: 27 }, // Addition with regrouping
        { operator: 'sub', minuend: 52, subtrahend: 18 }, // Subtraction with borrowing
      ]

      const typstPages = generateTypstSource(config, problems)
      const firstPage = typstPages[0]

      // Should contain both showTenFrames: true and showTenFrames: false
      expect(firstPage).toContain('showTenFrames: true') // Addition
      expect(firstPage).toContain('showTenFrames: false') // Subtraction

      // Verify operator assignment (Typst uses "+" and "−" display characters)
      expect(firstPage).toContain('operator: "+"')
      expect(firstPage).toContain('operator: "−"')
    })

    it('should apply subtractionDisplayRules to subtraction problems in mixed mode', () => {
      const config: WorksheetConfig = {
        version: 4,
        mode: 'mastery',
        problemsPerPage: 2,
        cols: 1,
        pages: 1,
        total: 2,
        rows: 2,
        orientation: 'portrait',
        name: 'Test Student',
        date: '2025-11-10',
        seed: 12345,
        fontSize: 12,
        digitRange: { min: 2, max: 2 },
        operator: 'mixed',
        pAnyStart: 1.0,
        pAllStart: 0,
        displayRules: {
          carryBoxes: 'never',
          answerBoxes: 'never',
          placeValueColors: 'never',
          tenFrames: 'never',
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'never',
          borrowingHints: 'never',
        },
        additionDisplayRules: {
          carryBoxes: 'never',
          answerBoxes: 'always',
          placeValueColors: 'never',
          tenFrames: 'never', // ← Addition: no ten-frames
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'never',
          borrowingHints: 'never',
        },
        subtractionDisplayRules: {
          carryBoxes: 'never',
          answerBoxes: 'always',
          placeValueColors: 'always',
          tenFrames: 'whenRegrouping', // ← Subtraction: show ten-frames when borrowing
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'whenRegrouping',
          borrowingHints: 'whenRegrouping',
        },
        interpolate: false,
        page: { wIn: 8.5, hIn: 11 },
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 },
      } as any

      const problems: WorksheetProblem[] = [
        { operator: 'sub', minuend: 52, subtrahend: 18 }, // Subtraction with borrowing
      ]

      const typstPages = generateTypstSource(config, problems)
      const firstPage = typstPages[0]

      // Subtraction with borrowing should show ten-frames
      expect(firstPage).toContain('showTenFrames: true')
      expect(firstPage).toContain('showBorrowNotation: true')
      expect(firstPage).toContain('showBorrowingHints: true')
    })

    it('should handle subtraction problems with operator "sub" correctly', () => {
      // This test verifies the fix for the Unicode operator bug
      const config: WorksheetConfig = {
        version: 4,
        mode: 'mastery',
        problemsPerPage: 2,
        cols: 1,
        pages: 1,
        total: 2,
        rows: 2,
        orientation: 'portrait',
        name: 'Test Student',
        date: '2025-11-10',
        seed: 12345,
        fontSize: 12,
        digitRange: { min: 2, max: 2 },
        operator: 'mixed',
        pAnyStart: 1.0,
        pAllStart: 0,
        displayRules: {
          carryBoxes: 'never',
          answerBoxes: 'always',
          placeValueColors: 'never',
          tenFrames: 'never',
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'never',
          borrowingHints: 'never',
        },
        additionDisplayRules: {
          carryBoxes: 'always',
          answerBoxes: 'always',
          placeValueColors: 'always',
          tenFrames: 'always',
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'never',
          borrowingHints: 'never',
        },
        subtractionDisplayRules: {
          carryBoxes: 'never',
          answerBoxes: 'always',
          placeValueColors: 'always',
          tenFrames: 'always', // ← Should show for subtraction
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'always',
          borrowingHints: 'always',
        },
        interpolate: false,
        page: { wIn: 8.5, hIn: 11 },
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 },
      } as any

      const problems: WorksheetProblem[] = [
        { operator: 'sub', minuend: 52, subtrahend: 18 }, // operator: 'sub' (alphanumeric)
        { operator: 'add', a: 45, b: 27 }, // operator: 'add' (alphanumeric)
      ]

      const typstPages = generateTypstSource(config, problems)
      const firstPage = typstPages[0]

      // Both problems should show scaffolding (not zero scaffolding bug)
      const tenFramesTrueMatches = firstPage.match(/showTenFrames: true/g)
      expect(tenFramesTrueMatches?.length).toBe(2) // Both problems

      // Verify operators are correctly set (Typst uses "+" and "−" display characters)
      expect(firstPage).toContain('operator: "−"') // Subtraction
      expect(firstPage).toContain('operator: "+"') // Addition
    })

    it('should fallback to default displayRules when operator-specific rules are missing', () => {
      const config: WorksheetConfig = {
        version: 4,
        mode: 'mastery',
        problemsPerPage: 2,
        cols: 1,
        pages: 1,
        total: 2,
        rows: 2,
        orientation: 'portrait',
        name: 'Test Student',
        date: '2025-11-10',
        seed: 12345,
        fontSize: 12,
        digitRange: { min: 2, max: 2 },
        operator: 'mixed',
        pAnyStart: 1.0,
        pAllStart: 0,
        // Only default rules, no operator-specific rules
        displayRules: {
          carryBoxes: 'whenRegrouping',
          answerBoxes: 'always',
          placeValueColors: 'always',
          tenFrames: 'whenRegrouping',
          problemNumbers: 'always',
          cellBorders: 'always',
          borrowNotation: 'whenRegrouping',
          borrowingHints: 'never',
        },
        interpolate: false,
        page: { wIn: 8.5, hIn: 11 },
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 },
      }

      const problems: WorksheetProblem[] = [
        { operator: 'add', a: 45, b: 27 }, // Has regrouping
        { operator: 'sub', minuend: 52, subtrahend: 18 }, // Has borrowing
      ]

      const typstPages = generateTypstSource(config, problems)
      const firstPage = typstPages[0]

      // Both should use default rules and show scaffolding
      const tenFramesTrueMatches = firstPage.match(/showTenFrames: true/g)
      expect(tenFramesTrueMatches?.length).toBe(2) // Both problems
    })
  })
})
