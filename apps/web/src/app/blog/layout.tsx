'use client'

import { AppNavBar } from '@/components/AppNavBar'

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNavBar />
      {children}
    </>
  )
}
