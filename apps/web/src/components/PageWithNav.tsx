'use client'

import React from 'react'
import { AppNavBar } from './AppNavBar'

interface PageWithNavProps {
  navTitle?: string
  navEmoji?: string
  children: React.ReactNode
}

export function PageWithNav({ navTitle, navEmoji, children }: PageWithNavProps) {
  // Create nav content if title is provided
  const navContent = navTitle ? (
    <h1 style={{
      fontSize: '18px',
      fontWeight: 'bold',
      background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
      backgroundClip: 'text',
      color: 'transparent',
      margin: 0
    }}>
      {navEmoji && `${navEmoji} `}{navTitle}
    </h1>
  ) : null

  return (
    <>
      <AppNavBar navSlot={navContent} />
      {children}
    </>
  )
}