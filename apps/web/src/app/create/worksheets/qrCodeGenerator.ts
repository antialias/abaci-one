/**
 * QR Code generation utilities for worksheet PDF embedding
 *
 * Generates QR codes as SVG strings that can be embedded in Typst documents
 * using image.decode() with raw SVG strings.
 */

import QRCode from 'qrcode'

/**
 * Generate a ± (plus-minus) operator icon SVG for the QR code center
 * This matches the OperatorIcon React component's visual style
 *
 * @param size - Size of the icon in pixels
 * @returns SVG string of the ± symbol
 */
function generateOperatorIcon(size: number): string {
  const s = size
  // Use a bold, clean ± symbol centered in the icon
  // The symbol is drawn with thick strokes for good visibility
  const strokeWidth = s * 0.12
  const centerX = s / 2
  const centerY = s / 2

  // Position the + part higher and the - part lower
  const plusCenterY = centerY - s * 0.15
  const minusCenterY = centerY + s * 0.25
  const barLength = s * 0.5

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect x="0" y="0" width="${s}" height="${s}" fill="white"/>
    <!-- Plus sign (horizontal bar) -->
    <line x1="${centerX - barLength / 2}" y1="${plusCenterY}" x2="${centerX + barLength / 2}" y2="${plusCenterY}" stroke="#4F46E5" stroke-width="${strokeWidth}" stroke-linecap="round"/>
    <!-- Plus sign (vertical bar) -->
    <line x1="${centerX}" y1="${plusCenterY - barLength / 2}" x2="${centerX}" y2="${plusCenterY + barLength / 2}" stroke="#4F46E5" stroke-width="${strokeWidth}" stroke-linecap="round"/>
    <!-- Minus sign -->
    <line x1="${centerX - barLength / 2}" y1="${minusCenterY}" x2="${centerX + barLength / 2}" y2="${minusCenterY}" stroke="#4F46E5" stroke-width="${strokeWidth}" stroke-linecap="round"/>
  </svg>`
}

/**
 * Generate a QR code as an SVG string with an optional center logo
 *
 * @param url - The URL to encode in the QR code
 * @param size - The size of the QR code in pixels (default 100)
 * @param withLogo - Whether to add an abacus logo in the center (default true)
 * @returns SVG string representing the QR code
 */
export async function generateQRCodeSVG(url: string, size = 100, withLogo = true): Promise<string> {
  // Use high error correction when adding a logo (can recover ~30% of data)
  const errorCorrectionLevel = withLogo ? 'H' : 'M'

  const svg = await QRCode.toString(url, {
    type: 'svg',
    width: size,
    margin: 1,
    errorCorrectionLevel,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })

  if (!withLogo) {
    return svg
  }

  // Add ± operator logo to the center of the QR code
  // Logo should cover ~15-20% of the QR code area for best scannability
  const logoSize = Math.round(size * 0.22)
  const logoOffset = Math.round((size - logoSize) / 2)

  // Parse the SVG and insert the logo
  // The QR code SVG has a white background, so we add the logo on top
  const logoSvg = generateOperatorIcon(logoSize)

  // Extract just the content of the logo SVG (without the outer svg tags)
  const logoContent = logoSvg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')

  // Insert logo into QR code SVG (before closing </svg> tag)
  const svgWithLogo = svg.replace(
    '</svg>',
    `<g transform="translate(${logoOffset}, ${logoOffset})">${logoContent}</g></svg>`
  )

  return svgWithLogo
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
