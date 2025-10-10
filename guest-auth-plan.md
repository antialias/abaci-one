for apps/web I would like to get away from using local storage for persisting avatar emojis / names / isActive and persisting this on a per guest session basis in a database. i want to use drizzle as orm and also for schema migrations. for instances where server components are impractical, I want to use tanstack query to interact with the api and for caching / invalidations and also mutations. i want to use nextauth + jwt for stateless and self contained sessions below I have pasted a generic guide that you can use as a pattern. i want to implement this step by step, testing thoroughly at high resolution checkpoints to ensure that at every step along the path we have a rock solid base. have a deep look at the source and propose a plan. keep in mind that this is a greenfield project with no users. we are aiming for excellent implementation and do not have to worry at all about preserving existign data or
backwards compatibility

=== generic guide for implementing nextauth + jwt for guest session manageement with a clean path for upgrade to full user account ===

below is a guic guide for impda

- **Stateless** on the server (no DB writes just to identify a visitor).
- **Self‑contained** in the browser (HttpOnly cookies only — **no localStorage**).
- **Easy upgrade** from “guest” → full NextAuth user.

It uses **two layers of identity**:

1. a tiny **guest token** (JWT) in an HttpOnly cookie you control;
2. a normal **NextAuth session** (JWT strategy). On upgrade, the guest ID is carried into the NextAuth token so you can merge state.

---

## Why this works

- NextAuth’s default **session strategy is `"jwt"`**, stored in a cookie as an **encrypted JWE**; this is stateless and requires no DB lookups. ([Auth.js][1])
- JWT cookies are size‑limited (~4 KB), so we store **only a small guest ID** and timestamps, not carts/settings. (If you need more than a few kilobytes, persist to your backend at upgrade time.) ([NextAuth][2])
- With **lazy initialization**, NextAuth v5 lets you access the request inside your config (e.g., to read the guest cookie during callbacks). ([Auth.js][1])
- Middleware can **create/rotate HttpOnly cookies** at the edge before your app runs. ([Next.js][3])

---

## The pattern (Next.js App Router + NextAuth v5)

### 0) Install & set secrets

```sh
npm i next-auth@beta jose
# .env
AUTH_SECRET=your-strong-random-secret
```

> Auth.js v5 accepts `AUTH_SECRET` (you can even rotate by passing an array of secrets). ([Auth.js][1])

---

### 1) A tiny, signed “guest token” cookie

Create `lib/guest-token.ts`:

```ts
// lib/guest-token.ts
import { SignJWT, jwtVerify } from "jose";

const GUEST_COOKIE = "__Host-guest"; // secure + path=/, no Domain
export const GUEST_COOKIE_NAME = GUEST_COOKIE;

function getKey() {
  const secret = process.env.AUTH_SECRET!;
  return new TextEncoder().encode(secret);
}

export async function createGuestToken(
  sid: string,
  maxAgeSec = 60 * 60 * 24 * 30,
) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ typ: "guest", sid, iat: now })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + maxAgeSec)
    .sign(getKey());
}

export async function verifyGuestToken(token: string) {
  const { payload } = await jwtVerify(token, getKey());
  if (payload.typ !== "guest" || typeof payload.sid !== "string")
    throw new Error("bad guest token");
  return {
    sid: payload.sid as string,
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
}
```

> We keep this payload tiny (just a stable **sid**) to respect cookie size limits. ([NextAuth][2])

---

### 2) Middleware: ensure every visitor gets a guest token

Create `middleware.ts` (Edge‑compatible):

```ts
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createGuestToken, GUEST_COOKIE_NAME } from "./lib/guest-token";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const existing = req.cookies.get(GUEST_COOKIE_NAME)?.value;

  if (!existing) {
    const sid = crypto.randomUUID();
    const token = await createGuestToken(sid);
    res.cookies.set({
      name: GUEST_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/", // required for "__Host-" prefix
    });
  }

  return res;
}

// Run on all HTML/app routes; skip static assets as you prefer.
export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
```

> Reading/setting cookies in Middleware is supported; it runs before your route code. ([Next.js][3])

---

### 3) NextAuth v5 config: carry guest → session

Create `auth.ts` (v5 “lazy init” so you can read the request/cookies):

```ts
// auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
// Add your real providers, e.g. GitHub/Google/Email
// import GitHub from "next-auth/providers/github";
import { verifyGuestToken, GUEST_COOKIE_NAME } from "@/lib/guest-token";

export type Role = "guest" | "user";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    isGuest?: boolean;
    guestId?: string | null;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    guestId?: string | null; // previous guest sid for migrations
  }
}

// This provider lets you treat guests as "signed-in" if you want a single code path.
// If you prefer to keep guests unauthenticated, you can omit this provider and just use the cookie.
const GuestProvider = Credentials({
  id: "guest",
  name: "Guest",
  credentials: {},
  async authorize() {
    // Create a synthetic user ID. We still rely on the guest cookie as the stable ID.
    return { id: `guest:${crypto.randomUUID()}`, name: "Guest" } as any;
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth((req) => ({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  // Include GuestProvider if you want `useSession()` to be "authenticated" for guests too.
  providers: [GuestProvider /*, GitHub(), Google(), Email() ... */],
  callbacks: {
    // 1) When a user signs in (guest or real), shape the token
    async jwt({ token, user, account, trigger }) {
      if (trigger === "signIn" && account?.provider === "guest" && user) {
        token.sub = user.id;
        token.role = "guest";
        // We’ll expose the actual guest sid through the cookie → session below
      }

      // On upgrade to a real account, capture the guest sid for migration
      if (trigger === "signIn" && account && account.provider !== "guest") {
        const raw = req?.cookies.get(GUEST_COOKIE_NAME)?.value;
        if (raw) {
          try {
            const { sid } = await verifyGuestToken(raw);
            token.guestId = sid; // carry through to session for merge step
          } catch {}
        }
        token.role = "user";
      }
      return token;
    },

    // 2) What the client gets via useSession()/getSession()
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      session.isGuest = token.role === "guest";

      // Expose the stable guest sid from the cookie (if present)
      const raw = req?.cookies.get(GUEST_COOKIE_NAME)?.value;
      session.guestId = null;
      if (raw) {
        try {
          const { sid } = await verifyGuestToken(raw);
          session.guestId = sid;
        } catch {}
      }
      return session;
    },

    // 3) Optional: gate admin sections, etc., in middleware via `authorized`
    authorized({ auth }) {
      // Example: allow all visitors through; you can add role checks here.
      return true;
    },
  },

  // Cookie + JWT behavior (JWT/JWE cookie by default)
  // - default JWE encryption; uses AUTH_SECRET
  // - default cookie maxAge/rotation handled by NextAuth
}));
```

**Notes**

- NextAuth encrypts the JWT session cookie (JWE) using your `AUTH_SECRET`; JWT is the default session strategy. ([Auth.js][1])
- We **read the guest cookie inside callbacks** thanks to v5 lazy initialization (`NextAuth(req => ({ ... }))`). ([Auth.js][1])
- If you don’t want guests to appear “authenticated” in `useSession()`, **remove the `GuestProvider`**. You’ll still have `session === null` for guests _but_ you can read the `guestId` via a tiny helper (below).

---

### 4) Unified “viewer” helper (server)

If you prefer not to include the `GuestProvider`, use this on the server:

```ts
// lib/viewer.ts
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { verifyGuestToken, GUEST_COOKIE_NAME } from "@/lib/guest-token";

export async function getViewer() {
  const session = await auth(); // NextAuth session or null
  if (session) return { kind: "user" as const, session };

  const raw = cookies().get(GUEST_COOKIE_NAME)?.value;
  if (!raw) return { kind: "unknown" as const };

  const { sid } = await verifyGuestToken(raw);
  return { kind: "guest" as const, guestId: sid };
}
```

---

### 5) The upgrade path

When the guest authenticates with any real provider:

1. **JWT callback** (above) copies the `guestId` from the cookie into the token.
2. Handle the actual merge in an **event** or the first request after sign‑in:

```ts
// in auth.ts (inside NextAuth config)
events: {
  async signIn(msg) {
    // For credentials providers, msg.user is the raw user.
    // For OAuth/email, you'll have an adapter user in msg.user (if using an adapter)
    // If you're JWT-only, you can read the guest cookie again here.
    // Example (pseudocode):
    // const guestId = ...read from cookie or msg...
    // await mergeGuestDataIntoUser(guestId, msg.user.id)
  },
},
```

Events are the right hook for one‑time merge/audit work. ([Auth.js][1])

**What to merge?**

- Browser‑only state (e.g., a cart in another cookie/IndexedDB) → POST it to your API immediately after login, keyed by `session.guestId`.
- Server‑side, tie any anonymous trail you kept (e.g., telemetry keyed by `guestId`) to the new `userId`.

---

## Client usage examples

- **Guest‑aware UI** (works both with and without `GuestProvider`):

```tsx
"use client";
import { useSession } from "next-auth/react";

export function UserBadge() {
  const { data } = useSession();
  if (data?.isGuest)
    return <>Browsing as guest • id {data.guestId?.slice(0, 8)}…</>;
  if (data?.user?.id) return <>Signed in • {data.user.name ?? data.user.id}</>;
  return <>Loading…</>;
}
```

---

## Security & pitfalls

- **Keep the guest token tiny.** Cookies have practical limits; NextAuth does cookie chunking, but you still pay in bandwidth; don’t stuff carts/preferences into JWTs. ([NextAuth][2])
- Use the `__Host-` prefix + `Secure` + `HttpOnly` + `SameSite=Lax` to harden your cookie (as shown).
- **Don’t rely on cookie names** for NextAuth’s own session; use the framework helpers (`auth()`, `getSession()`, `getToken()`), since cookie names can differ across versions/configs. NextAuth stores the session token in its **Session Token cookie** (JWE) and lets you customize names if needed. ([NextAuth][4])
- **Role‑guard your APIs**: treat `session.isGuest`/`token.role === "guest"` as read‑only access.

---

## Variants you can choose

**A) “Guest as real session”** (single code path)

- Keep `GuestProvider` in `providers`. On first visit, call `await signIn("guest", { redirect: false })` client‑side to mint the NextAuth cookie (still no localStorage).
- Everything reads from `useSession()`; check `session.isGuest`.
- Upgrade with any provider; the `jwt` callback carries `guestId` across.

**B) “Guest as separate cookie” (leaner)**

- Omit `GuestProvider`.
- Use `getViewer()` server‑side (or a small `/api/viewer` endpoint) to get either `{ kind: "guest", guestId }` or a full session.
- Upgrade flow is the same; NextAuth’s callbacks can still read the guest cookie at sign‑in time.

Both variants remain **stateless** and **browser‑contained** (HttpOnly cookies only). NextAuth’s JWT cookies are **encrypted by default** and rotated/extended by its helpers. ([Auth.js][1])

---

## What you get

- Stable **guest identity** from first pixel paint (middleware sets the cookie).
- A clean, **reliable upgrade path**: guest → user without losing context.
- No localStorage; everything is **HttpOnly** cookies + NextAuth JWT.

If you want, tell me whether you’d prefer Variant A or B for your app (and which auth providers you’ll use). I can tailor the config and add a tiny client hook for fetching `viewer` on the client without exposing tokens.

[1]: https://authjs.dev/reference/nextjs "Auth.js | Nextjs"
[2]: https://next-auth.js.org/faq "Frequently Asked Questions | NextAuth.js"
[3]: https://nextjs.org/docs/app/guides/authentication?utm_source=chatgpt.com "Guides: Authentication"
[4]: https://next-auth.js.org/configuration/options?utm_source=chatgpt.com "Options | NextAuth.js"
