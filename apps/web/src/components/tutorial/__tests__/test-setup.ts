import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
})) as any

// Mock ResizeObserver for components that use it
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
})) as any

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock canvas context for any canvas-based components
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Array(4) })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Array(4) })),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
})) as any

// Mock setTimeout and setInterval for more predictable testing
vi.useFakeTimers()

// Add custom matchers for tutorial-specific assertions
expect.extend({
  toHaveCorrectStartValue(received, expected) {
    const pass = received === expected
    if (pass) {
      return {
        message: () => `Expected abacus not to have start value ${expected}, but it did`,
        pass: true,
      }
    } else {
      return {
        message: () => `Expected abacus to have start value ${expected}, but got ${received}`,
        pass: false,
      }
    }
  },

  toAdvanceMultiStep(received) {
    const pass = received > 0
    if (pass) {
      return {
        message: () => `Expected multi-step not to advance, but it advanced to step ${received}`,
        pass: true,
      }
    } else {
      return {
        message: () => `Expected multi-step to advance, but it remained at step ${received}`,
        pass: false,
      }
    }
  },
})

// Mock the unified step generator for consistent test results
vi.mock('../../../utils/unifiedStepGenerator', () => ({
  generateUnifiedInstructionSequence: vi.fn((startValue: number, targetValue: number) => ({
    steps: [
      {
        stepIndex: 0,
        expectedValue: startValue + Math.ceil((targetValue - startValue) / 2),
        englishInstruction: `Change value to ${startValue + Math.ceil((targetValue - startValue) / 2)}`,
        mathematicalTerm: `${Math.ceil((targetValue - startValue) / 2)}`,
        termPosition: { startIndex: 0, endIndex: 2 },
      },
      {
        stepIndex: 1,
        expectedValue: targetValue,
        englishInstruction: `Change value to ${targetValue}`,
        mathematicalTerm: `${targetValue}`,
        termPosition: { startIndex: 4, endIndex: 6 },
      },
    ],
    fullDecomposition: `${startValue} + ${targetValue - startValue} = ${targetValue}`,
  })),
}))

// Type declarations for custom matchers
declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      toHaveCorrectStartValue(expected: number): T
      toAdvanceMultiStep(): T
    }
  }
}
