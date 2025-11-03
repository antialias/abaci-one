#!/usr/bin/env tsx

/**
 * Generate icon.svg and og-image.svg from AbacusReact component
 *
 * This script renders AbacusReact server-side to produce the exact same
 * SVG output as the interactive client-side version (without animations).
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { AbacusReact } from '@soroban/abacus-react'

// Generate the favicon (icon.svg) - single column showing value 5
function generateFavicon(): string {
  const iconSvg = renderToStaticMarkup(
    <AbacusReact
      value={5}
      columns={1}
      scaleFactor={1.0}
      animated={false}
      interactive={false}
      showNumbers={false}
      customStyles={{
        heavenBeads: { fill: '#fbbf24' },
        earthBeads: { fill: '#fbbf24' },
        columnPosts: {
          fill: '#7c2d12',
          stroke: '#92400e',
          strokeWidth: 2,
        },
        reckoningBar: {
          fill: '#92400e',
          stroke: '#92400e',
          strokeWidth: 3,
        },
      }}
    />
  )

  // Wrap in SVG with proper viewBox for favicon sizing
  return `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Background circle for better visibility -->
  <circle cx="50" cy="50" r="48" fill="#fef3c7"/>

  <!-- Abacus from @soroban/abacus-react -->
  <g transform="translate(32, 8) scale(0.36)">
    ${iconSvg}
  </g>
</svg>
`
}

// Generate the Open Graph image (og-image.svg)
function generateOGImage(): string {
  const abacusSvg = renderToStaticMarkup(
    <AbacusReact
      value={123}
      columns={3}
      scaleFactor={1.8}
      animated={false}
      interactive={false}
      showNumbers={false}
      customStyles={{
        heavenBeads: { fill: '#fbbf24' },
        earthBeads: { fill: '#fbbf24' },
        columnPosts: {
          fill: '#7c2d12',
          stroke: '#92400e',
          strokeWidth: 2,
        },
        reckoningBar: {
          fill: '#92400e',
          stroke: '#92400e',
          strokeWidth: 3,
        },
      }}
    />
  )

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <!-- Gradient background -->
  <defs>
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fef3c7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#fcd34d;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg-gradient)"/>

  <!-- Left side - Abacus from @soroban/abacus-react -->
  <g transform="translate(80, 100) scale(0.9)">
    ${abacusSvg}
  </g>

  <!-- Right side - Text content -->
  <g transform="translate(550, 180)">
    <!-- Main title -->
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="#7c2d12">
      Abaci.One
    </text>

    <!-- Subtitle -->
    <text x="0" y="80" font-family="Arial, sans-serif" font-size="36" font-weight="600" fill="#92400e">
      Learn Soroban Through Play
    </text>

    <!-- Features -->
    <text x="0" y="150" font-family="Arial, sans-serif" font-size="28" fill="#78350f">
      • Interactive Games
    </text>
    <text x="0" y="190" font-family="Arial, sans-serif" font-size="28" fill="#78350f">
      • Tutorials
    </text>
    <text x="0" y="230" font-family="Arial, sans-serif" font-size="28" fill="#78350f">
      • Practice Tools
    </text>
  </g>

  <!-- Bottom accent line -->
  <rect x="0" y="610" width="1200" height="20" fill="#92400e" opacity="0.3"/>
</svg>
`
}

// Main execution
const appDir = __dirname.replace('/scripts', '')

try {
  console.log('Generating favicon from AbacusReact...')
  const faviconSvg = generateFavicon()
  writeFileSync(join(appDir, 'src', 'app', 'icon.svg'), faviconSvg)
  console.log('✓ Generated src/app/icon.svg')

  console.log('Generating Open Graph image from AbacusReact...')
  const ogImageSvg = generateOGImage()
  writeFileSync(join(appDir, 'public', 'og-image.svg'), ogImageSvg)
  console.log('✓ Generated public/og-image.svg')

  console.log('\n✅ All icons generated successfully!')
} catch (error) {
  console.error('❌ Error generating icons:', error)
  process.exit(1)
}
