'use client'

import { AppNavBar } from '@/components/AppNavBar'

export default function ForTeachersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNavBar />
      {children}
    </>
  )
}
