import { describe, expect, it } from 'vitest'
import { explainError } from '../db-errors'

describe('explainError', () => {
  it('translates an FK violation on user_id into a stale-session message', () => {
    // Shape mirrors a real DrizzleQueryError -> LibsqlError -> SqliteError chain
    // captured from a failed seed-students run.
    const err = Object.assign(new Error('Failed query: insert into "players" ("id", "user_id", ...) values (?, ?, ...)'), {
      query: 'insert into "players" ("id", "user_id", "name") values (?, ?, ?)',
      params: ['p1', 'stale-user-id', 'Test'],
      cause: Object.assign(new Error('SQLITE_CONSTRAINT_FOREIGNKEY: FOREIGN KEY constraint failed'), {
        code: 'SQLITE_CONSTRAINT_FOREIGNKEY',
        cause: Object.assign(new Error('FOREIGN KEY constraint failed'), {
          code: 'SQLITE_CONSTRAINT_FOREIGNKEY',
          rawCode: 787,
        }),
      }),
    })

    const result = explainError(err)
    expect(result).toMatch(/session is stale/i)
    expect(result).toMatch(/sign out and sign back in/i)
  })

  it('falls back to a generic FK message when the column is not user_id', () => {
    const err = Object.assign(new Error('Failed query: insert into "child_thing" (parent_id) values (?)'), {
      query: 'insert into "child_thing" (parent_id) values (?)',
      cause: { code: 'SQLITE_CONSTRAINT_FOREIGNKEY', message: 'FOREIGN KEY constraint failed' },
    })
    expect(explainError(err)).toMatch(/Foreign key violation/i)
    expect(explainError(err)).not.toMatch(/session is stale/i)
  })

  it('translates a unique-constraint violation', () => {
    const err = Object.assign(new Error('Failed query: insert into "users" ("email")'), {
      cause: {
        code: 'SQLITE_CONSTRAINT_UNIQUE',
        message: 'UNIQUE constraint failed: users.email',
      },
    })
    expect(explainError(err)).toMatch(/Unique constraint violation/i)
    expect(explainError(err)).toMatch(/users\.email/)
  })

  it('falls back to top message + root cause when no recognizer matches', () => {
    const err = Object.assign(new Error('Top-level message'), {
      cause: { message: 'something deep' },
    })
    expect(explainError(err)).toBe('Top-level message\nRoot cause: something deep')
  })

  it('returns the top message when the cause adds nothing', () => {
    const err = new Error('Just a plain error')
    expect(explainError(err)).toBe('Just a plain error')
  })

  it('handles non-Error values gracefully', () => {
    expect(explainError('string error')).toBe('string error')
    expect(explainError(null)).toBe('null')
  })

  it('does not infinite-loop on a circular cause chain', () => {
    const err: { message: string; cause?: unknown } = { message: 'top' }
    err.cause = err
    expect(() => explainError(err)).not.toThrow()
  })
})
