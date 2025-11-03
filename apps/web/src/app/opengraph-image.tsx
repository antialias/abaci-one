import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image metadata
export const alt = 'Abaci.One - Interactive Soroban Learning Platform'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Image generation
// Note: Using simplified abacus HTML/CSS representation instead of StaticAbacus
// because ImageResponse has limited JSX support (no custom components)
export default async function Image() {
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
      {/* Left side - Simplified abacus visualization (HTML/CSS)
          Can't use StaticAbacus here because ImageResponse only supports
          basic HTML elements, not custom React components */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40%',
        }}
      >
        {/* Simple abacus representation with 3 columns */}
        <div
          style={{
            display: 'flex',
            gap: '30px',
          }}
        >
          {/* Column 1 */}
          <div
            style={{
              width: '80px',
              height: '400px',
              background: '#7c2d12',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: '20px 0',
              position: 'relative',
            }}
          >
            {/* Reckoning bar */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '-10px',
                right: '-10px',
                height: '12px',
                background: '#92400e',
                borderRadius: '4px',
              }}
            />
            {/* Beads - simplified representation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '36px',
                    height: '36px',
                    background: '#fbbf24',
                    borderRadius: '50%',
                    border: '3px solid #92400e',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Column 2 */}
          <div
            style={{
              width: '80px',
              height: '400px',
              background: '#7c2d12',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: '20px 0',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '-10px',
                right: '-10px',
                height: '12px',
                background: '#92400e',
                borderRadius: '4px',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '36px',
                    height: '36px',
                    background: '#fbbf24',
                    borderRadius: '50%',
                    border: '3px solid #92400e',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Column 3 */}
          <div
            style={{
              width: '80px',
              height: '400px',
              background: '#7c2d12',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: '20px 0',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '-10px',
                right: '-10px',
                height: '12px',
                background: '#92400e',
                borderRadius: '4px',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '36px',
                    height: '36px',
                    background: '#fbbf24',
                    borderRadius: '50%',
                    border: '3px solid #92400e',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

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
