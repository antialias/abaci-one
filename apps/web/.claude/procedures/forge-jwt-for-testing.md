# Forging a NextAuth v5 JWT for Manual Browser Testing

Use this procedure when you need to authenticate as a specific user in the Chrome MCP browser for manual testing, without going through the real OAuth sign-in flow.

## How It Works

NextAuth v5 uses **stateless JWT sessions** stored as encrypted HttpOnly cookies. The cookie name is `authjs.session-token`. The encryption uses:

- **Algorithm**: `A256CBC-HS512` (NOT A256GCM)
- **Key derivation**: HKDF with SHA-256
- **Secret**: `AUTH_SECRET` from `.env.local`
- **Salt**: The cookie name itself (`authjs.session-token`)
- **HKDF info string**: `Auth.js Generated Encryption Key (authjs.session-token)` — the salt is included in parentheses

This was determined by reading the NextAuth v5 source at `node_modules/@auth/core/src/jwt.ts`.

## Step 1: Mint the JWT

Run this from the `apps/web` directory:

```bash
AUTH_SECRET=$(grep '^AUTH_SECRET=' .env.local | cut -d= -f2-) node -e "
const { hkdf } = require('@panva/hkdf');
const { EncryptJWT } = require('jose');

async function mint() {
  const secret = process.env.AUTH_SECRET;
  const salt = 'authjs.session-token';
  const info = 'Auth.js Generated Encryption Key (' + salt + ')';
  const key = await hkdf('sha256', secret, salt, info, 64);

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    name: 'Test User',
    email: 'hallock@gmail.com',        // Change to desired email
    picture: null,
    sub: 'g1c8pkb2fa4qiv5qc46m4js9',   // Change to desired users.id
    iat: now,
    exp: now + 86400,
  };

  const token = await new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .encrypt(new Uint8Array(key));

  console.log(token);
}
mint().catch(e => console.error(e));
"
```

### Key payload fields

| Field | Purpose | Example |
|-------|---------|---------|
| `sub` | Must match `users.id` in DB if routes look up the user | `g1c8pkb2fa4qiv5qc46m4js9` |
| `email` | Used by `isAdminEmail()` for admin checks | `hallock@gmail.com` |
| `name` | Display name in the UI | `Test User` |
| `exp` | Expiration (seconds since epoch) | `now + 86400` (24h) |

### For admin testing

Use the real admin user's `id` and an email listed in `ADMIN_EMAILS` env var. The admin user in the local DB is:
- **id**: `g1c8pkb2fa4qiv5qc46m4js9`
- **email**: `hallock@gmail.com`

### For non-admin testing

Use a fake user id and an email NOT in `ADMIN_EMAILS`:
- **sub**: `fake-nonadmin-user-id`
- **email**: `nonadmin@example.com`

## Step 2: Set the Cookie in Chrome MCP

Using the Chrome DevTools MCP `evaluate_script` tool:

```javascript
() => {
  document.cookie = 'authjs.session-token=<PASTE_TOKEN_HERE>; path=/; max-age=86400';
  return 'cookie set';
}
```

## Step 3: Verify Authentication

Navigate to a page or fetch an API endpoint:

```javascript
async () => {
  const resp = await fetch('/api/admin/tasks');
  return { status: resp.status, statusText: resp.statusText };
}
```

Or navigate to `http://localhost:3000/admin` and take a snapshot.

## Step 4: Clear the Session (Reset to Unauthenticated)

```javascript
() => {
  document.cookie = 'authjs.session-token=; path=/; max-age=0';
  return 'cookie cleared';
}
```

## Common Pitfalls

1. **Wrong algorithm**: A256GCM (32-byte key) will silently produce an invalid token. Must use A256CBC-HS512 (64-byte key).
2. **Wrong HKDF info string**: Must include the salt in parentheses: `Auth.js Generated Encryption Key (authjs.session-token)`. Without it, the derived key is wrong.
3. **Sourcing .env.local with bash `source`**: The file may have multiline values that break bash parsing. Use `grep` to extract `AUTH_SECRET` instead.
4. **HttpOnly cookies**: The `authjs.session-token` cookie is NOT HttpOnly in local dev (no HTTPS), so `document.cookie` works. In production (HTTPS), the cookie is `__Secure-authjs.session-token` and is HttpOnly — this approach won't work there.
5. **`sub` vs `user.id`**: NextAuth maps `sub` in the JWT to `session.user.id`. If a route does `session.user.id` to look up DB records, `sub` must match a real `users.id`.

## Dependencies

Both packages are already in the project's dependency tree (used by `@auth/core`):
- `@panva/hkdf` — HKDF key derivation
- `jose` — JWE encryption
