import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: function play() {
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  },
})

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: function pause() {
    this.dispatchEvent(new Event('pause'))
  },
})

Element.prototype.scrollIntoView = () => undefined
