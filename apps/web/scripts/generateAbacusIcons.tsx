#!/usr/bin/env tsx

/**
 * Generate icon.svg and og-image.svg from AbacusReact component
 *
 * This script renders AbacusReact server-side to produce the exact same
 * SVG output as the interactive client-side version (without animations).
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { AbacusReact } from '@soroban/abacus-react'

// Extract just the SVG element content from rendered output
function extractSvgContent(markup: string): string {
  // Find the opening <svg and closing </svg> tags
  const svgMatch = markup.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)
  if (!svgMatch) {
    throw new Error('No SVG element found in rendered output')
  }
  return svgMatch[1] // Return just the inner content
}

// Generate the favicon (icon.svg) - single column showing value 5
function generateFavicon(): string {
  const abacusMarkup = renderToStaticMarkup(
    <AbacusReact
      value={5}
      columns={1}
      scaleFactor={1.0}
      animated={false}
      interactive={false}
      showNumbers={false}
      customStyles={{
        heavenBeads: { fill: '#7c2d12', stroke: '#451a03', strokeWidth: 1 },
        earthBeads: { fill: '#7c2d12', stroke: '#451a03', strokeWidth: 1 },
        columnPosts: {
          fill: '#451a03',
          stroke: '#292524',
          strokeWidth: 2,
        },
        reckoningBar: {
          fill: '#292524',
          stroke: '#292524',
          strokeWidth: 3,
        },
      }}
    />
  )

  // Extract just the SVG content (without div wrapper)
  let svgContent = extractSvgContent(abacusMarkup)

  // Remove !important from CSS (production code policy)
  svgContent = svgContent.replace(/\s*!important/g, '')

  // Wrap in SVG with proper viewBox for favicon sizing
  // AbacusReact with 1 column + scaleFactor 1.0 = ~25×120px
  // Scale 0.7 = ~17.5×84px, centered in 100×100
  return `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Background circle for better visibility -->
  <circle cx="50" cy="50" r="48" fill="#fef3c7"/>

  <!-- Abacus from @soroban/abacus-react -->
  <g transform="translate(41, 8) scale(0.7)">
    ${svgContent}
  </g>
</svg>
`
}

// Generate the Open Graph image (og-image.svg)
function generateOGImage(): string {
  const abacusMarkup = renderToStaticMarkup(
    <AbacusReact
      value={1234}
      columns={4}
      scaleFactor={3.5}
      animated={false}
      interactive={false}
      showNumbers={false}
      customStyles={{
        columnPosts: {
          fill: 'rgb(255, 255, 255)',
          stroke: 'rgb(200, 200, 200)',
          strokeWidth: 2,
        },
        reckoningBar: {
          fill: 'rgb(255, 255, 255)',
          stroke: 'rgb(200, 200, 200)',
          strokeWidth: 3,
        },
        columns: {
          0: {
            // Ones place (rightmost) - Blue
            heavenBeads: { fill: '#60a5fa', stroke: '#3b82f6', strokeWidth: 1 },
            earthBeads: { fill: '#60a5fa', stroke: '#3b82f6', strokeWidth: 1 },
          },
          1: {
            // Tens place - Green
            heavenBeads: { fill: '#4ade80', stroke: '#22c55e', strokeWidth: 1 },
            earthBeads: { fill: '#4ade80', stroke: '#22c55e', strokeWidth: 1 },
          },
          2: {
            // Hundreds place - Yellow/Gold
            heavenBeads: { fill: '#fbbf24', stroke: '#f59e0b', strokeWidth: 1 },
            earthBeads: { fill: '#fbbf24', stroke: '#f59e0b', strokeWidth: 1 },
          },
          3: {
            // Thousands place (leftmost) - Purple
            heavenBeads: { fill: '#c084fc', stroke: '#a855f7', strokeWidth: 1 },
            earthBeads: { fill: '#c084fc', stroke: '#a855f7', strokeWidth: 1 },
          },
        },
      }}
    />
  )

  // Extract just the SVG content (without div wrapper)
  let svgContent = extractSvgContent(abacusMarkup)

  // Remove !important from CSS (production code policy)
  svgContent = svgContent.replace(/\s*!important/g, '')

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark background like homepage -->
  <rect width="1200" height="630" fill="#111827"/>

  <!-- Subtle dot pattern background -->
  <defs>
    <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="rgba(255, 255, 255, 0.15)" />
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#dots)" opacity="0.1"/>

  <!-- Left decorative elements - Diamond shapes and math operators -->
  <g opacity="0.4">
    <!-- Purple diamond (thousands) -->
    <polygon points="150,120 180,150 150,180 120,150" fill="#c084fc" />
    <!-- Gold diamond (hundreds) -->
    <polygon points="150,220 180,250 150,280 120,250" fill="#fbbf24" />
    <!-- Green diamond (tens) -->
    <polygon points="150,320 180,350 150,380 120,350" fill="#4ade80" />
    <!-- Blue diamond (ones) -->
    <polygon points="150,420 180,450 150,480 120,450" fill="#60a5fa" />
  </g>

  <!-- Left math operators -->
  <g opacity="0.35" fill="rgba(255, 255, 255, 0.8)">
    <text x="80" y="100" font-family="Arial, sans-serif" font-size="42" font-weight="300">+</text>
    <text x="240" y="190" font-family="Arial, sans-serif" font-size="42" font-weight="300">×</text>
    <text x="70" y="290" font-family="Arial, sans-serif" font-size="42" font-weight="300">=</text>
    <text x="250" y="390" font-family="Arial, sans-serif" font-size="42" font-weight="300">−</text>
  </g>

  <!-- Right decorative elements - Diamond shapes and math operators -->
  <g opacity="0.4">
    <!-- Purple diamond (thousands) -->
    <polygon points="1050,120 1080,150 1050,180 1020,150" fill="#c084fc" />
    <!-- Gold diamond (hundreds) -->
    <polygon points="1050,220 1080,250 1050,280 1020,250" fill="#fbbf24" />
    <!-- Green diamond (tens) -->
    <polygon points="1050,320 1080,350 1050,380 1020,350" fill="#4ade80" />
    <!-- Blue diamond (ones) -->
    <polygon points="1050,420 1080,450 1050,480 1020,450" fill="#60a5fa" />
  </g>

  <!-- Right math operators -->
  <g opacity="0.35" fill="rgba(255, 255, 255, 0.8)">
    <text x="940" y="160" font-family="Arial, sans-serif" font-size="42" font-weight="300">÷</text>
    <text x="1110" y="270" font-family="Arial, sans-serif" font-size="42" font-weight="300">+</text>
    <text x="920" y="360" font-family="Arial, sans-serif" font-size="42" font-weight="300">×</text>
    <text x="1120" y="480" font-family="Arial, sans-serif" font-size="42" font-weight="300">=</text>
  </g>

  <!-- Huge centered abacus from @soroban/abacus-react -->
  <!-- AbacusReact 4 columns @ scale 3.5: width ~350px, height ~420px -->
  <!-- Center horizontally: (1200-350)/2 = 425px -->
  <!-- Center vertically in upper portion: abacus middle at ~225px, so start at 225-210 = 15px -->
  <g transform="translate(425, 15)">
    ${svgContent}
  </g>

  <!-- Title at bottom, horizontally and vertically centered in lower portion -->
  <!-- Position at y=520 for vertical centering in bottom half -->
  <text x="600" y="520" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="url(#title-gradient)" text-anchor="middle">
    Abaci One
  </text>

  <!-- Gold gradient for title -->
  <defs>
    <linearGradient id="title-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#f59e0b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#fbbf24;stop-opacity:1" />
    </linearGradient>
  </defs>
</svg>
`
}

// Main execution
const appDir = __dirname.replace('/scripts', '')

try {
  console.log('Generating Open Graph image from AbacusReact...')
  const ogImageSvg = generateOGImage()
  writeFileSync(join(appDir, 'public', 'og-image.svg'), ogImageSvg)
  console.log('✓ Generated public/og-image.svg')

  console.log('\n✅ Icon generated successfully!')
  console.log('\nNote: Day-of-month favicons are generated on-demand by src/app/icon/route.tsx')
  console.log('which calls scripts/generateDayIcon.tsx as a subprocess.')
} catch (error) {
  console.error('❌ Error generating icons:', error)
  process.exit(1)
}
