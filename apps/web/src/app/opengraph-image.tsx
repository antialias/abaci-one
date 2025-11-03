import { ImageResponse } from 'next/og'
import { renderToStaticMarkup } from 'react-dom/server'
import { AbacusReact } from '@soroban/abacus-react'

// Route segment config
export const runtime = 'edge'

// Image metadata
export const alt = 'Abaci.One - Interactive Soroban Learning Platform'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Extract just the SVG element content from rendered output
function extractSvgContent(markup: string): string {
  const svgMatch = markup.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)
  if (!svgMatch) {
    throw new Error('No SVG element found in rendered output')
  }
  return svgMatch[1]
}

// Image generation
// Note: Now using AbacusReact server-side rendering, same as icon.svg and og-image.svg
export default async function Image() {
  // Render AbacusReact server-side
  const abacusMarkup = renderToStaticMarkup(
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

  // Extract SVG content
  const svgContent = extractSvgContent(abacusMarkup)

  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '80px',
      }}
    >
      {/* Left side - Abacus from @soroban/abacus-react (server-side rendered) */}
      <div
        style={{
          display: 'flex',
          width: '40%',
        }}
        dangerouslySetInnerHTML={{
          __html: `<svg width="135" height="216" viewBox="0 0 135 216">${svgContent}</svg>`,
        }}
      />

      {/* Right side - Text content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '55%',
          gap: '30px',
        }}
      >
        <h1
          style={{
            fontSize: '80px',
            fontWeight: 'bold',
            color: '#7c2d12',
            margin: 0,
            lineHeight: 1,
          }}
        >
          Abaci.One
        </h1>

        <p
          style={{
            fontSize: '40px',
            fontWeight: 600,
            color: '#92400e',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Learn Soroban Through Play
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            fontSize: '32px',
            color: '#78350f',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>• Interactive Games</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>• Tutorials</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>• Practice Tools</div>
        </div>
      </div>
    </div>,
    {
      ...size,
    }
  )
}
