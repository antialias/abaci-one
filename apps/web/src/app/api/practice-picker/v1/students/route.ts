import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getPracticePickerV1Data } from '@/lib/practice-picker/server'

/** GET /api/practice-picker/v1/students */
export const GET = withAuth(async () => {
  try {
    return NextResponse.json(await getPracticePickerV1Data())
  } catch (error) {
    console.error('Failed to fetch practice picker v1 students:', error)
    return NextResponse.json({ error: 'Failed to fetch practice students' }, { status: 500 })
  }
})
