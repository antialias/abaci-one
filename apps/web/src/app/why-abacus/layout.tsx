'use client'

import { AppNavBar } from '@/components/AppNavBar'

export default function WhyAbacusLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNavBar />
      {children}
    </>
  )
}
