import '@testing-library/jest-dom'

// Mock canvas Image constructor to prevent jsdom errors when rendering
// images with data URIs (e.g., data:image/jpeg;base64,...)
// This works by patching HTMLImageElement.prototype before jsdom uses it
// Guard for node environment where HTMLImageElement doesn't exist
if (typeof HTMLImageElement !== 'undefined') {
  const originalSetAttribute = HTMLImageElement.prototype.setAttribute
  HTMLImageElement.prototype.setAttribute = function (name: string, value: string) {
    if (name === 'src' && value.startsWith('data:image/')) {
      // Store the value but don't trigger jsdom's image loading
      Object.defineProperty(this, 'src', {
        value,
        writable: true,
        configurable: true,
      })
      return
    }
    return originalSetAttribute.call(this, name, value)
  }
}
