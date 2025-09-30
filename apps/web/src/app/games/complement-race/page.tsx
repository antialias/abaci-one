'use client'

import Link from 'next/link'
import { PageWithNav } from '@/components/PageWithNav'

export default function ComplementRacePage() {
  return (
    <PageWithNav navTitle="Speed Complement Race" navEmoji="🏁">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        padding: '20px',
        gap: '32px'
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '600px'
        }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Speed Complement Race
          </h1>
          <p style={{
            fontSize: '18px',
            color: '#6b7280',
            marginBottom: '8px'
          }}>
            Master complement pairs by racing against AI opponents!
          </p>
          <p style={{
            fontSize: '14px',
            color: '#9ca3af'
          }}>
            Choose your challenge below:
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          width: '100%',
          maxWidth: '1000px'
        }}>
          {/* Practice Mode */}
          <Link href="/games/complement-race/practice" style={{
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #8db978 0%, #6a9354 100%)',
            borderRadius: '16px',
            padding: '32px 24px',
            color: 'white',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            display: 'block'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏁</div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Practice Mode</h2>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>Race to 20 correct answers. Perfect for building speed and accuracy!</p>
          </Link>

          {/* Steam Sprint */}
          <Link href="/games/complement-race/sprint" style={{
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            borderRadius: '16px',
            padding: '32px 24px',
            color: 'white',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            display: 'block'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚂</div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Steam Sprint</h2>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>Keep your train moving for 60 seconds! Momentum-based challenge with passengers.</p>
          </Link>

          {/* Survival Mode */}
          <Link href="/games/complement-race/survival" style={{
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            borderRadius: '16px',
            padding: '32px 24px',
            color: 'white',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            display: 'block'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔄</div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Survival Mode</h2>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>Endless circular race! See how many laps you can complete before the AI catches up.</p>
          </Link>
        </div>
      </div>
    </PageWithNav>
  )
}