import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { createClassroom, getTeacherClassroom } from '@/lib/classroom/classroom-manager'
import { createTask } from '@/lib/task-manager'
import type { SeedStudentsEvent } from '@/lib/tasks/events'
import { getDbUserId } from '@/lib/viewer'
import {
  TEST_PROFILES,
  filterProfiles,
  getProfileInfoList,
  createTestStudentWithTuning,
  type ProfileCategory,
} from '@/lib/seed'

/**
 * GET /api/debug/seed-students
 *
 * Returns the list of available seed profiles for the UI.
 * This avoids shipping ~2000 lines of profile data as client JS.
 */
export const GET = withAuth(async () => {
  return NextResponse.json({
    profiles: getProfileInfoList(),
    categories: ['bkt', 'session', 'edge'] as ProfileCategory[],
  })
}, { role: 'admin' })

/**
 * POST /api/debug/seed-students
 *
 * Starts a background task to seed test students.
 * Accepts optional filters: { profiles?: string[], categories?: string[] }
 */
export const POST = withAuth(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}))
    const profileNames = (body.profiles ?? []) as string[]
    const categories = (body.categories ?? []) as ProfileCategory[]

    // Filter profiles
    const profilesToSeed = filterProfiles(TEST_PROFILES, {
      names: profileNames,
      categories,
    })

    if (profilesToSeed.length === 0) {
      return NextResponse.json(
        { error: 'No profiles match the specified filters' },
        { status: 400 }
      )
    }

    // Get current user
    const userId = await getDbUserId()

    // Look up user record
    let user = await db.query.users.findFirst({
      where: eq(schema.users.guestId, userId),
    })

    if (!user) {
      const [newUser] = await db.insert(schema.users).values({ guestId: userId }).returning()
      user = newUser
    }

    // Ensure classroom exists
    let classroom = await getTeacherClassroom(user.id)

    if (!classroom) {
      const result = await createClassroom({
        teacherId: user.id,
        name: 'Test Classroom',
      })
      if (result.success && result.classroom) {
        classroom = result.classroom
      } else {
        return NextResponse.json(
          { error: `Failed to create classroom: ${result.error}` },
          { status: 500 }
        )
      }
    }

    const classroomId = classroom.id
    const classroomCode = classroom.code

    // Create background task
    const profileNameList = profilesToSeed.map((p) => p.name)

    interface StudentResult {
      name: string
      status: 'completed' | 'failed'
      playerId?: string
      classifications?: { weak: number; developing: number; strong: number }
      error?: string
    }

    const taskId = await createTask<
      { profiles: string[]; categories: string[] },
      {
        seededCount: number
        failedCount: number
        classroomCode: string
        students: StudentResult[]
      },
      SeedStudentsEvent
    >(
      'seed-students',
      { profiles: profileNames, categories },
      async (handle) => {
        handle.emit({
          type: 'seed_started',
          profileCount: profilesToSeed.length,
          profileNames: profileNameList,
        })

        let seededCount = 0
        let failedCount = 0
        const students: StudentResult[] = []

        for (let i = 0; i < profilesToSeed.length; i++) {
          if (handle.isCancelled()) break

          const profile = profilesToSeed[i]

          handle.emit({
            type: 'student_started',
            name: profile.name,
            index: i,
            total: profilesToSeed.length,
          })

          handle.setProgress(
            Math.round((i / profilesToSeed.length) * 100),
            `Seeding ${profile.name} (${i + 1}/${profilesToSeed.length})`
          )

          try {
            const result = await createTestStudentWithTuning(profile, userId, classroomId, 3)

            const classifications = {
              weak: result.classifications.weak ?? 0,
              developing: result.classifications.developing ?? 0,
              strong: result.classifications.strong ?? 0,
            }

            handle.emit({
              type: 'student_completed',
              name: profile.name,
              playerId: result.playerId,
              classifications,
            })

            students.push({
              name: profile.name,
              status: 'completed',
              playerId: result.playerId,
              classifications,
            })

            seededCount++
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err)
            console.error(`[seed-students] Failed to seed ${profile.name}:`, err)

            handle.emit({
              type: 'student_failed',
              name: profile.name,
              error: errorMessage,
            })

            students.push({
              name: profile.name,
              status: 'failed',
              error: errorMessage,
            })

            failedCount++
          }
        }

        handle.emit({
          type: 'seed_complete',
          seededCount,
          failedCount,
          classroomCode,
        })

        handle.complete({ seededCount, failedCount, classroomCode, students })
      },
      userId
    )

    return NextResponse.json({ taskId, profileCount: profilesToSeed.length })
  } catch (error) {
    console.error('[seed-students] Failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start seeding' },
      { status: 500 }
    )
  }
}, { role: 'admin' })
