/**
 * @vitest-environment node
 *
 * Tests for Training Data Deletion utilities
 *
 * Tests deletion of column classifier and boundary detector samples,
 * tombstone recording, and input validation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fs/promises before importing the module under test
vi.mock('fs/promises', () => ({
  default: {
    unlink: vi.fn(),
    appendFile: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
  },
}))

import fs from 'fs/promises'
import {
  deleteColumnClassifierSample,
  deleteBoundaryDetectorSample,
  readTombstone,
} from '../trainingDataDeletion'

describe('Training Data Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('deleteColumnClassifierSample', () => {
    it('should delete file and record to tombstone on success', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined)
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.appendFile).mockResolvedValue(undefined)

      const result = await deleteColumnClassifierSample(3, 'test_image.png')

      expect(result.success).toBe(true)
      expect(result.deleted).toBe(true)
      expect(result.tombstoneRecorded).toBe(true)
      expect(result.error).toBeUndefined()

      // Verify unlink was called with correct path
      expect(fs.unlink).toHaveBeenCalledTimes(1)
      const unlinkPath = vi.mocked(fs.unlink).mock.calls[0][0] as string
      expect(unlinkPath).toContain('collected')
      expect(unlinkPath).toContain('3')
      expect(unlinkPath).toContain('test_image.png')

      // Verify tombstone was recorded
      expect(fs.appendFile).toHaveBeenCalledTimes(1)
      const appendArgs = vi.mocked(fs.appendFile).mock.calls[0]
      expect(appendArgs[0]).toContain('.deleted')
      expect(appendArgs[1]).toBe('3/test_image.png\n')
    })

    it('should record to tombstone even if file does not exist locally', async () => {
      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException
      enoentError.code = 'ENOENT'
      vi.mocked(fs.unlink).mockRejectedValue(enoentError)
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.appendFile).mockResolvedValue(undefined)

      const result = await deleteColumnClassifierSample(5, 'missing_image.png')

      expect(result.success).toBe(true)
      expect(result.deleted).toBe(false) // File wasn't deleted (didn't exist)
      expect(result.tombstoneRecorded).toBe(true) // But tombstone was recorded

      // Tombstone should still be recorded
      expect(fs.appendFile).toHaveBeenCalledTimes(1)
      const appendArgs = vi.mocked(fs.appendFile).mock.calls[0]
      expect(appendArgs[1]).toBe('5/missing_image.png\n')
    })

    it('should return warning if tombstone write fails', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined)
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.appendFile).mockRejectedValue(new Error('Disk full'))

      const result = await deleteColumnClassifierSample(7, 'test.png')

      expect(result.success).toBe(true)
      expect(result.deleted).toBe(true)
      expect(result.tombstoneRecorded).toBe(false)
      expect(result.error).toContain('Warning')
    })

    it('should reject invalid digit', async () => {
      const result1 = await deleteColumnClassifierSample(-1, 'test.png')
      expect(result1.success).toBe(false)
      expect(result1.error).toBe('Invalid digit')

      const result2 = await deleteColumnClassifierSample(10, 'test.png')
      expect(result2.success).toBe(false)
      expect(result2.error).toBe('Invalid digit')

      const result3 = await deleteColumnClassifierSample(3.5, 'test.png')
      expect(result3.success).toBe(false)
      expect(result3.error).toBe('Invalid digit')

      // No file operations should have been attempted
      expect(fs.unlink).not.toHaveBeenCalled()
    })

    it('should reject invalid filename', async () => {
      const result1 = await deleteColumnClassifierSample(3, '../etc/passwd')
      expect(result1.success).toBe(false)
      expect(result1.error).toBe('Invalid filename')

      const result2 = await deleteColumnClassifierSample(3, 'path/to/file.png')
      expect(result2.success).toBe(false)
      expect(result2.error).toBe('Invalid filename')

      const result3 = await deleteColumnClassifierSample(3, 'test.jpg')
      expect(result3.success).toBe(false)
      expect(result3.error).toBe('Filename must end with .png')

      const result4 = await deleteColumnClassifierSample(3, '')
      expect(result4.success).toBe(false)
      expect(result4.error).toBe('Invalid filename')

      expect(fs.unlink).not.toHaveBeenCalled()
    })

    it('should fail if unlink fails with non-ENOENT error', async () => {
      const permissionError = new Error('EACCES') as NodeJS.ErrnoException
      permissionError.code = 'EACCES'
      vi.mocked(fs.unlink).mockRejectedValue(permissionError)

      const result = await deleteColumnClassifierSample(3, 'test.png')

      expect(result.success).toBe(false)
      expect(result.deleted).toBe(false)
      expect(result.error).toContain('Failed to delete file')
    })
  })

  describe('deleteBoundaryDetectorSample', () => {
    it('should delete PNG file and record to tombstone', async () => {
      // PNG exists, JPG and JSON don't
      vi.mocked(fs.unlink)
        .mockResolvedValueOnce(undefined) // PNG delete succeeds
        .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) // JPG doesn't exist
        .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) // JSON doesn't exist
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.appendFile).mockResolvedValue(undefined)

      const result = await deleteBoundaryDetectorSample('default', '1234567890_abc123')

      expect(result.success).toBe(true)
      expect(result.deleted).toBe(true)
      expect(result.tombstoneRecorded).toBe(true)

      // Should record PNG to tombstone (since that's what existed)
      const appendArgs = vi.mocked(fs.appendFile).mock.calls[0]
      expect(appendArgs[1]).toBe('default/1234567890_abc123.png\n')
    })

    it('should delete JPG file and record to tombstone', async () => {
      // PNG doesn't exist, JPG exists
      vi.mocked(fs.unlink)
        .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) // PNG doesn't exist
        .mockResolvedValueOnce(undefined) // JPG delete succeeds
        .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) // JSON doesn't exist
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.appendFile).mockResolvedValue(undefined)

      const result = await deleteBoundaryDetectorSample('passive-practice-remote', '9876543210_xyz')

      expect(result.success).toBe(true)
      expect(result.deleted).toBe(true)
      expect(result.tombstoneRecorded).toBe(true)

      // Should record JPG to tombstone
      const appendArgs = vi.mocked(fs.appendFile).mock.calls[0]
      expect(appendArgs[1]).toBe('passive-practice-remote/9876543210_xyz.jpg\n')
    })

    it('should delete all related files (PNG, JPG, JSON)', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined) // All deletes succeed
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.appendFile).mockResolvedValue(undefined)

      const result = await deleteBoundaryDetectorSample('default', 'test_frame')

      expect(result.success).toBe(true)
      expect(result.deleted).toBe(true)

      // Should have tried to delete PNG, JPG, and JSON
      expect(fs.unlink).toHaveBeenCalledTimes(3)
      const calls = vi.mocked(fs.unlink).mock.calls.map((c) => c[0] as string)
      expect(calls.some((p) => p.endsWith('.png'))).toBe(true)
      expect(calls.some((p) => p.endsWith('.jpg'))).toBe(true)
      expect(calls.some((p) => p.endsWith('.json'))).toBe(true)
    })

    it('should reject invalid deviceId', async () => {
      const result1 = await deleteBoundaryDetectorSample('../etc', 'test')
      expect(result1.success).toBe(false)
      expect(result1.error).toBe('Invalid deviceId')

      const result2 = await deleteBoundaryDetectorSample('path/to/device', 'test')
      expect(result2.success).toBe(false)
      expect(result2.error).toBe('Invalid deviceId')

      const result3 = await deleteBoundaryDetectorSample('', 'test')
      expect(result3.success).toBe(false)
      expect(result3.error).toBe('Invalid deviceId')

      expect(fs.unlink).not.toHaveBeenCalled()
    })

    it('should reject invalid baseName', async () => {
      const result1 = await deleteBoundaryDetectorSample('default', '../passwd')
      expect(result1.success).toBe(false)
      expect(result1.error).toBe('Invalid baseName')

      const result2 = await deleteBoundaryDetectorSample('default', 'path/to/file')
      expect(result2.success).toBe(false)
      expect(result2.error).toBe('Invalid baseName')

      const result3 = await deleteBoundaryDetectorSample('default', '')
      expect(result3.success).toBe(false)
      expect(result3.error).toBe('Invalid baseName')

      expect(fs.unlink).not.toHaveBeenCalled()
    })

    it('should return not deleted if no files exist', async () => {
      const enoentError = Object.assign(new Error('ENOENT'), {
        code: 'ENOENT',
      })
      vi.mocked(fs.unlink).mockRejectedValue(enoentError)
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.appendFile).mockResolvedValue(undefined)

      const result = await deleteBoundaryDetectorSample('default', 'nonexistent')

      expect(result.success).toBe(true)
      expect(result.deleted).toBe(false) // Nothing was actually deleted
      expect(result.tombstoneRecorded).toBe(true) // But still recorded to tombstone
    })
  })

  describe('readTombstone', () => {
    it('should read and parse tombstone file for column-classifier', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('3/image1.png\n5/image2.png\n7/image3.png\n')

      const result = await readTombstone('column-classifier')

      expect(result.size).toBe(3)
      expect(result.has('3/image1.png')).toBe(true)
      expect(result.has('5/image2.png')).toBe(true)
      expect(result.has('7/image3.png')).toBe(true)
    })

    it('should read and parse tombstone file for boundary-detector', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        'default/frame1.png\npassive-practice-remote/frame2.jpg\n'
      )

      const result = await readTombstone('boundary-detector')

      expect(result.size).toBe(2)
      expect(result.has('default/frame1.png')).toBe(true)
      expect(result.has('passive-practice-remote/frame2.jpg')).toBe(true)
    })

    it('should return empty set if tombstone file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      )

      const result = await readTombstone('column-classifier')

      expect(result.size).toBe(0)
    })

    it('should handle empty tombstone file', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('')

      const result = await readTombstone('boundary-detector')

      expect(result.size).toBe(0)
    })

    it('should filter out empty lines', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('3/image1.png\n\n\n5/image2.png\n   \n')

      const result = await readTombstone('column-classifier')

      expect(result.size).toBe(2)
      expect(result.has('3/image1.png')).toBe(true)
      expect(result.has('5/image2.png')).toBe(true)
    })
  })
})
