/**
 * QR Code generation utilities for worksheet PDF embedding
 *
 * Generates QR codes as SVG strings that can be embedded in Typst documents
 * using image.decode() with raw SVG strings.
 */

import QRCode from 'qrcode'

/**
 * Generate a QR code as an SVG string
 *
 * @param url - The URL to encode in the QR code
 * @param size - The size of the QR code in pixels (default 100)
 * @returns SVG string representing the QR code
 */
export async function generateQRCodeSVG(url: string, size = 100): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: 'svg',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M', // Medium error correction - good balance
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })

  return svg
}

/**
 * Generate a QR code as a base64-encoded SVG data URI
 * This format can be embedded directly in Typst using #image()
 *
 * @param url - The URL to encode in the QR code
 * @param size - The size of the QR code in pixels (default 100)
 * @returns Base64-encoded data URI string (e.g., "data:image/svg+xml;base64,...")
 */
export async function generateQRCodeBase64(url: string, size = 100): Promise<string> {
  const svg = await generateQRCodeSVG(url, size)
  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

/**
 * Generate the Typst code snippet for embedding a QR code
 * Places the QR code at the bottom-left corner of the page
 *
 * @param shareUrl - The share URL to encode
 * @param sizeInches - Size of the QR code in inches (default 0.5)
 * @returns Typst code string for placing the QR code
 */
export async function generateQRCodeTypst(shareUrl: string, sizeInches = 0.5): Promise<string> {
  const base64DataUri = await generateQRCodeBase64(shareUrl, 200) // Higher res for print

  // Position at bottom-left corner with small margin
  return `#place(bottom + left, dx: 0.25in, dy: -0.25in)[
  #image("${base64DataUri}", width: ${sizeInches}in, height: ${sizeInches}in)
]`
}
