import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { GUEST_COOKIE_NAME, verifyGuestToken } from '@/lib/guest-token'

/**
 * NextAuth v5 configuration with guest session support
 *
 * Uses JWT strategy (stateless) with HttpOnly cookies.
 * Supports both guest users and future full authentication.
 */

export type Role = 'guest' | 'user'

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

declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role
    guestId?: string | null
  }
}

/**
 * Guest provider - allows treating guests as "authenticated"
 *
 * This creates a synthetic NextAuth session for guests, enabling
 * a single code path for both guest and authenticated users.
 */
const GuestProvider = Credentials({
  id: 'guest',
  name: 'Guest',
  credentials: {},
  async authorize() {
    // Create a synthetic user ID for the guest session
    return { id: `guest:${crypto.randomUUID()}`, name: 'Guest' } as any
  },
})

/**
 * NextAuth configuration with lazy initialization
 *
 * The function form allows access to the request object in callbacks,
 * which we need to read the guest cookie.
 */
export const { handlers, auth, signIn, signOut } = NextAuth((req) => ({
  // JWT strategy for stateless sessions (no database lookups)
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },

  // Providers - guest + future providers (GitHub, Google, etc.)
  providers: [
    GuestProvider,
    // Add more providers here as needed:
    // GitHub(),
    // Google(),
    // Email(),
  ],

  callbacks: {
    /**
     * JWT callback - shapes the token stored in the cookie
     *
     * Called when:
     * - User signs in (trigger: "signIn")
     * - Token is refreshed
     * - Session is accessed
     */
    async jwt({ token, user, account, trigger }) {
      // Handle guest sign-in
      if (trigger === 'signIn' && account?.provider === 'guest' && user) {
        token.sub = user.id
        token.role = 'guest'
      }

      // Handle upgrade from guest to full account
      if (trigger === 'signIn' && account && account.provider !== 'guest') {
        // Capture the guest ID from the cookie for data migration
        const guestCookie = req?.cookies.get(GUEST_COOKIE_NAME)?.value
        if (guestCookie) {
          try {
            const { sid } = await verifyGuestToken(guestCookie)
            token.guestId = sid // Store for merge/migration
          } catch {
            // Invalid guest token, ignore
          }
        }
        token.role = 'user'
      }

      return token
    },

    /**
     * Session callback - shapes what the client sees
     *
     * Called when:
     * - useSession() is called on client
     * - getSession() is called on server
     */
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }

      session.isGuest = token.role === 'guest'

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
     *
     * Return true to allow access, false to redirect to sign-in
     */
    authorized({ auth }) {
      // For now, allow all visitors (guests + authenticated)
      // Add role-based checks here later if needed
      return true
    },
  },

  // Pages configuration (optional customization)
  pages: {
    // signIn: '/auth/signin',
    // error: '/auth/error',
  },

  // Events for side effects (e.g., data migration on upgrade)
  events: {
    async signIn(_message) {
      // Future: Handle guest → user data migration here
      // const guestId = message.token?.guestId
      // if (guestId && message.user.id) {
      //   await mergeGuestDataIntoUser(guestId, message.user.id)
      // }
    },
  },
}))
