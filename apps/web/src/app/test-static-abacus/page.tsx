/**
 * Test page for AbacusStatic - Server Component
 * This demonstrates that AbacusStatic works without "use client"
 */

import { AbacusStatic } from '@soroban/abacus-react'

export default function TestStaticAbacusPage() {
  const numbers = [1, 2, 3, 4, 5, 10, 25, 50, 100, 123, 456, 789]

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '10px' }}>AbacusStatic Test (Server Component)</h1>
      <p style={{ color: '#64748b', marginBottom: '30px' }}>
        This page is a React Server Component - no "use client" directive!
        All abacus displays below are rendered on the server with zero client-side JavaScript.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '20px',
        }}
      >
        {numbers.map((num) => (
          <div
            key={num}
            style={{
              padding: '20px',
              background: 'white',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AbacusStatic
              value={num}
              columns="auto"
              hideInactiveBeads
              compact
              scaleFactor={0.9}
            />
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#475569' }}>
              {num}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '40px', padding: '20px', background: '#f0fdf4', borderRadius: '8px' }}>
        <h2 style={{ marginTop: 0, color: '#166534' }}>✅ Success!</h2>
        <p style={{ color: '#15803d' }}>
          If you can see the abacus displays above, then AbacusStatic is working correctly
          in React Server Components. Check the page source - you'll see pure HTML/SVG with
          no client-side hydration markers!
        </p>
      </div>
    </div>
  )
}
