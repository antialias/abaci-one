import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'

/**
 * Upgrade a guest user to a full account.
 *
 * Updates the existing guest user row with email, name, image, and upgradedAt.
 * Links the OAuth/email provider in auth_accounts.
 *
 * @returns The upgraded user's database ID
 */
export async function upgradeGuestToUser(opts: {
  guestId: string
  email: string
  name?: string | null
  image?: string | null
  provider: string
  providerAccountId: string
  providerType: string
}): Promise<string | null> {
  const guestUser = await db.query.users.findFirst({
    where: eq(schema.users.guestId, opts.guestId),
  })

  if (!guestUser) {
    console.warn(`[auth] upgradeGuestToUser: no user found for guestId=${opts.guestId}`)
    return null
  }

  // Update the guest user row with account info
  await db
    .update(schema.users)
    .set({
      email: opts.email,
      name: opts.name ?? guestUser.name,
      image: opts.image ?? guestUser.image,
      upgradedAt: new Date(),
    })
    .where(eq(schema.users.id, guestUser.id))

  // Link the provider
  await db.insert(schema.authAccounts).values({
    id: createId(),
    userId: guestUser.id,
    provider: opts.provider,
    providerAccountId: opts.providerAccountId,
    type: opts.providerType,
  })

  console.log(
    `[auth] upgraded guest ${guestUser.id} to full account via ${opts.provider} (${opts.email})`
  )

  return guestUser.id
}
