import { and, eq, isNull } from 'drizzle-orm'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Nodemailer from 'next-auth/providers/nodemailer'
import { db, schema } from '@/db'
import { GUEST_COOKIE_NAME, verifyGuestToken } from '@/lib/guest-token'
import { abacisAdapter } from '@/lib/auth/adapter'
import { isAdminEmail } from '@/lib/auth/admin-emails'
import { mergeGuestIntoUser } from '@/lib/auth/mergeGuestIntoUser'
import { upgradeGuestToUser } from '@/lib/auth/upgradeGuestToUser'

/**
 * NextAuth v5 configuration with Google OAuth + email magic links
 *
 * Uses JWT strategy (stateless) with HttpOnly cookies.
 * Supports guest users (via custom cookie) and authenticated users.
 * Handles seamless guest-to-account upgrade on sign-in.
 */

export type Role = 'guest' | 'user' | 'admin'

// Extend NextAuth types to include our custom fields
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
    isGuest?: boolean
    guestId?: string | null
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    role?: Role
    guestId?: string | null
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth((req) => ({
  adapter: abacisAdapter,

  // JWT strategy for stateless sessions
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },

  providers: [
    Google,
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM || 'Abaci One <hallock@gmail.com>',
    }),
  ],

  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },

  callbacks: {
    /**
     * JWT callback - shapes the token stored in the cookie
     *
     * Handles:
     * - New sign-in with existing guest session → upgrade guest to full account
     * - Returning user sign-in on new device → merge guest data into existing account
     * - Brand new user sign-in (no guest session) → adapter creates user
     */
    async jwt({ token, user, account, trigger }) {
      if (trigger === 'signIn' && account && user) {
        // Read the guest cookie from the current request
        const guestCookie = req?.cookies.get(GUEST_COOKIE_NAME)?.value
        let guestId: string | null = null

        if (guestCookie) {
          try {
            const verified = await verifyGuestToken(guestCookie)
            guestId = verified.sid
          } catch {
            // Invalid guest token, ignore
          }
        }

        // Check if this provider+account already has a linked user
        const existingAccount = await db.query.authAccounts.findFirst({
          where: and(
            eq(schema.authAccounts.provider, account.provider),
            eq(schema.authAccounts.providerAccountId, account.providerAccountId ?? '')
          ),
        })

        if (existingAccount) {
          // Returning user (already has an account linked)
          if (guestId) {
            // They had a guest session on this device — merge guest data
            // Non-fatal: if merge fails, sign-in still succeeds (guest data is lost)
            try {
              const guestUser = await db.query.users.findFirst({
                where: eq(schema.users.guestId, guestId),
              })
              if (guestUser && guestUser.id !== existingAccount.userId) {
                await mergeGuestIntoUser(guestUser.id, existingAccount.userId)
              }
            } catch (err) {
              console.error('[auth] guest merge failed (non-fatal, sign-in continues):', err)
            }
          }
          token.sub = existingAccount.userId
          token.role = 'user'

          // Heal: ensure upgraded_at is set for returning OAuth users
          db.update(schema.users)
            .set({ upgradedAt: new Date() })
            .where(and(
              eq(schema.users.id, existingAccount.userId),
              isNull(schema.users.upgradedAt)
            ))
            .catch((err: unknown) =>
              console.error('[auth] Failed to heal upgraded_at:', err)
            )
        } else if (guestId) {
          // New sign-in with existing guest session → upgrade the guest
          // Non-fatal: if upgrade fails, adapter-created user is used instead
          try {
            const upgradedUserId = await upgradeGuestToUser({
              guestId,
              email: user.email ?? '',
              name: user.name,
              image: user.image,
              provider: account.provider,
              providerAccountId: account.providerAccountId ?? user.email ?? '',
              providerType: account.type,
            })

            if (upgradedUserId) {
              token.sub = upgradedUserId
            } else {
              token.sub = user.id
            }
          } catch (err) {
            console.error('[auth] guest upgrade failed (non-fatal, sign-in continues):', err)
            token.sub = user.id
          }
          token.role = 'user'
        } else {
          // Brand new user (no guest session) — adapter already created user
          token.sub = user.id
          token.role = 'user'
        }

        token.guestId = guestId

        // Auto-promote admins based on ADMIN_EMAILS env var
        const email = user.email ?? token.email
        if (isAdminEmail(email)) {
          token.role = 'admin'
          // Sync admin role to DB (non-fatal)
          if (token.sub) {
            db.update(schema.users)
              .set({ role: 'admin' })
              .where(eq(schema.users.id, token.sub))
              .catch((err: unknown) =>
                console.error('[auth] Failed to sync admin role to DB:', err)
              )
          }
        }
      }

      return token
    },

    /**
     * Session callback - shapes what the client sees
     */
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }

      session.isGuest = token.role === 'guest' || !token.role

      // Expose the stable guest ID from the cookie
      const guestCookie = req?.cookies.get(GUEST_COOKIE_NAME)?.value
      session.guestId = null
      if (guestCookie) {
        try {
          const { sid } = await verifyGuestToken(guestCookie)
          session.guestId = sid
        } catch {
          // Invalid guest token, ignore
        }
      }

      return session
    },

    /**
     * Authorized callback - used in middleware for route protection
     */
    authorized({ auth }) {
      // Allow all visitors (guests + authenticated)
      return true
    },
  },
}))
