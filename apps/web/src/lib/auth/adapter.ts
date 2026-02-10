import { createId } from '@paralleldrive/cuid2'
import { and, eq } from 'drizzle-orm'
import type { Adapter, AdapterAccount, AdapterUser } from 'next-auth/adapters'
import { db, schema } from '@/db'

/**
 * Custom NextAuth adapter backed by our Drizzle schema.
 *
 * Only implements the methods needed for OAuth + email magic links
 * with JWT sessions. Session-related methods throw since we use
 * stateless JWT sessions, not database sessions.
 */
export const abacisAdapter: Adapter = {
  async createUser(user) {
    const guestId = `synthetic:${crypto.randomUUID()}`
    const [created] = await db
      .insert(schema.users)
      .values({
        guestId,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
      })
      .returning()
    return toAdapterUser(created)
  },

  async getUser(id) {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, id),
    })
    return user ? toAdapterUser(user) : null
  },

  async getUserByEmail(email) {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    })
    return user ? toAdapterUser(user) : null
  },

  async getUserByAccount({ provider, providerAccountId }) {
    const account = await db.query.authAccounts.findFirst({
      where: and(
        eq(schema.authAccounts.provider, provider),
        eq(schema.authAccounts.providerAccountId, providerAccountId)
      ),
    })
    if (!account) return null

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, account.userId),
    })
    return user ? toAdapterUser(user) : null
  },

  async updateUser(user) {
    if (!user.id) throw new Error('updateUser requires user.id')
    const [updated] = await db
      .update(schema.users)
      .set({
        name: user.name ?? undefined,
        email: user.email ?? undefined,
        image: user.image ?? undefined,
      })
      .where(eq(schema.users.id, user.id))
      .returning()
    return toAdapterUser(updated)
  },

  async linkAccount(account: AdapterAccount) {
    await db.insert(schema.authAccounts).values({
      id: createId(),
      userId: account.userId,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      type: account.type,
    })
  },

  async createVerificationToken(token) {
    const [created] = await db
      .insert(schema.verificationTokens)
      .values({
        identifier: token.identifier,
        token: token.token,
        expires: token.expires,
      })
      .returning()
    return {
      identifier: created.identifier,
      token: created.token,
      expires: created.expires,
    }
  },

  async useVerificationToken({ identifier, token }) {
    const row = await db.query.verificationTokens.findFirst({
      where: and(
        eq(schema.verificationTokens.identifier, identifier),
        eq(schema.verificationTokens.token, token)
      ),
    })
    if (!row) return null

    await db
      .delete(schema.verificationTokens)
      .where(
        and(
          eq(schema.verificationTokens.identifier, identifier),
          eq(schema.verificationTokens.token, token)
        )
      )

    return {
      identifier: row.identifier,
      token: row.token,
      expires: row.expires,
    }
  },

  // --- Session methods: not used with JWT strategy ---
  async createSession() {
    throw new Error('createSession not implemented — using JWT strategy')
  },
  async getSessionAndUser() {
    throw new Error('getSessionAndUser not implemented — using JWT strategy')
  },
  async updateSession() {
    throw new Error('updateSession not implemented — using JWT strategy')
  },
  async deleteSession() {
    throw new Error('deleteSession not implemented — using JWT strategy')
  },
  async deleteUser() {
    throw new Error('deleteUser not implemented')
  },
  async unlinkAccount() {
    throw new Error('unlinkAccount not implemented')
  },
}

/**
 * Convert our DB user to NextAuth's AdapterUser format
 */
function toAdapterUser(user: typeof schema.users.$inferSelect): AdapterUser {
  return {
    id: user.id,
    email: user.email ?? '',
    emailVerified: user.upgradedAt ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
  }
}
