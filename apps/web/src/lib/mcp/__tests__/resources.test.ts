import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { listResources, readResource } from '../resources'
import fs from 'fs'

// Mock fs module
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}))

describe('MCP Resources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('listResources', () => {
    it('returns all registered resources', () => {
      const result = listResources()

      expect(result).toHaveProperty('resources')
      expect(Array.isArray(result.resources)).toBe(true)
      expect(result.resources.length).toBe(5) // 5 worksheet docs

      // Check structure of first resource
      const firstResource = result.resources[0]
      expect(firstResource).toHaveProperty('uri')
      expect(firstResource).toHaveProperty('name')
      expect(firstResource).toHaveProperty('description')
      expect(firstResource).toHaveProperty('mimeType')
    })

    it('includes all expected documentation resources', () => {
      const result = listResources()
      const uris = result.resources.map((r) => r.uri)

      expect(uris).toContain('docs://worksheet/regrouping')
      expect(uris).toContain('docs://worksheet/scaffolding')
      expect(uris).toContain('docs://worksheet/difficulty-profiles')
      expect(uris).toContain('docs://worksheet/digit-range')
      expect(uris).toContain('docs://worksheet/operators')
    })

    it('all resources have text/markdown mimeType', () => {
      const result = listResources()

      for (const resource of result.resources) {
        expect(resource.mimeType).toBe('text/markdown')
      }
    })

    it('all resources have non-empty descriptions', () => {
      const result = listResources()

      for (const resource of result.resources) {
        expect(resource.description.length).toBeGreaterThan(0)
      }
    })
  })

  describe('readResource', () => {
    it('returns content for a valid resource URI', () => {
      const mockContent = '# Regrouping\n\nThis is test content.'
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent)

      const result = readResource('docs://worksheet/regrouping')

      expect('contents' in result).toBe(true)
      if ('contents' in result) {
        expect(result.contents.length).toBe(1)
        expect(result.contents[0].uri).toBe('docs://worksheet/regrouping')
        expect(result.contents[0].mimeType).toBe('text/markdown')
        expect(result.contents[0].text).toBe(mockContent)
      }
    })

    it('returns error for unknown resource URI', () => {
      const result = readResource('docs://worksheet/nonexistent')

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toContain('Resource not found')
      }
    })

    it('returns error for invalid URI format', () => {
      const result = readResource('invalid://uri/format')

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toContain('Resource not found')
      }
    })

    it('returns error for directory traversal attempts', () => {
      const result = readResource('docs://worksheet/../../../etc/passwd')

      expect('error' in result).toBe(true)
      if ('error' in result) {
        // Should fail at the registry check since it's not a registered resource
        expect(result.error).toContain('Resource not found')
      }
    })

    it('returns error when file read fails', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: file not found')
      })

      const result = readResource('docs://worksheet/regrouping')

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toContain('Failed to read resource')
      }
    })

    it('correctly reads all registered resources', () => {
      const mockContent = '# Test Content'
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent)

      const { resources } = listResources()

      for (const resource of resources) {
        const result = readResource(resource.uri)

        expect('contents' in result).toBe(true)
        if ('contents' in result) {
          expect(result.contents[0].uri).toBe(resource.uri)
        }
      }
    })

    it('passes correct file path to fs.readFileSync', () => {
      const mockContent = '# Test'
      vi.mocked(fs.readFileSync).mockReturnValue(mockContent)

      readResource('docs://worksheet/scaffolding')

      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('docs/mcp/worksheet/scaffolding.md'),
        'utf-8'
      )
    })
  })
})
