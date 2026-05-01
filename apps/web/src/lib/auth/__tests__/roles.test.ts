import type { Mock } from 'vitest'
import { db } from '@/db'
import { _clearCache } from '../admin-emails'
import { isUserAdmin, resolveUserRole } from '../roles'

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn((left, right) => ({ left, right })),
  }
})

vi.mock('@/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
  schema: {
    users: {
      id: 'users.id',
    },
  },
}))

const findUser = db.query.users.findFirst as unknown as Mock
const originalAdminEmails = process.env.ADMIN_EMAILS

describe('resolveUserRole', () => {
  beforeEach(() => {
    findUser.mockReset()
    process.env.ADMIN_EMAILS = ''
    _clearCache()
  })

  afterAll(() => {
    process.env.ADMIN_EMAILS = originalAdminEmails
    _clearCache()
  })

  it('returns guest when there is no authenticated user id', async () => {
    await expect(resolveUserRole({ email: 'hallock@gmail.com' })).resolves.toBe('guest')
    expect(findUser).not.toHaveBeenCalled()
  })

  it('honors ADMIN_EMAILS as a bootstrap admin override', async () => {
    process.env.ADMIN_EMAILS = 'hallock@gmail.com'
    _clearCache()

    await expect(resolveUserRole({ userId: 'user-1', email: 'HALLOCK@gmail.com' })).resolves.toBe(
      'admin'
    )
    expect(findUser).not.toHaveBeenCalled()
  })

  it('uses the database role as the authoritative admin source', async () => {
    findUser.mockResolvedValue({ role: 'admin' })

    await expect(resolveUserRole({ userId: 'user-1', email: 'hallock@gmail.com' })).resolves.toBe(
      'admin'
    )
  })

  it('returns user for authenticated non-admins', async () => {
    findUser.mockResolvedValue({ role: 'user' })

    await expect(resolveUserRole({ userId: 'user-1', email: 'parent@example.com' })).resolves.toBe(
      'user'
    )
  })

  it('fails closed to a regular user when the role lookup errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    findUser.mockRejectedValue(new Error('database unavailable'))

    await expect(resolveUserRole({ userId: 'user-1', email: 'parent@example.com' })).resolves.toBe(
      'user'
    )

    errorSpy.mockRestore()
  })

  it('reports admin status from the shared resolver', async () => {
    findUser.mockResolvedValue({ role: 'admin' })

    await expect(isUserAdmin({ userId: 'user-1', email: 'admin@example.com' })).resolves.toBe(true)
  })
})
