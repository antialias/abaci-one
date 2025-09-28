# Development Standards - Soroban Abacus Web App

## 🚨 Critical Rules - DO NOT BREAK THESE

### Navigation Standards

#### ✅ ALWAYS Use Next.js Router for Navigation
```typescript
// ✅ CORRECT - Use Next.js router
import { useRouter } from 'next/navigation'

const router = useRouter()
router.push('/target-route')
```

#### ❌ NEVER Use window.location.href
```typescript
// ❌ WRONG - Causes page reloads, breaks state, kills fullscreen
window.location.href = '/target-route'
```

**Why this matters:**
- `window.location.href` causes full page reloads
- Page reloads break React state, exit fullscreen mode, and hurt performance
- Next.js router provides client-side navigation that preserves state
- **This is literally the main reason we use Next.js!**

### Fullscreen State Management

#### ✅ Let Client-Side Navigation Preserve Fullscreen
- Users enter fullscreen manually (respects browser security)
- Navigation preserves fullscreen automatically via client-side routing
- No need for complex restoration logic

#### ❌ Never Try to Auto-Enter Fullscreen
```typescript
// ❌ WRONG - Violates browser security, causes errors
useEffect(() => {
  enterFullscreen() // Browser blocks this without user gesture
}, [])
```

**Why this fails:**
- Browser security requires user gestures for fullscreen
- Automatic fullscreen attempts cause "Permissions check failed" errors
- Client-side navigation makes this unnecessary anyway

## Code Review Checklist

Before any PR/commit, verify:

- [ ] All navigation uses `useRouter().push()` instead of `window.location.href`
- [ ] No automatic fullscreen entry in useEffect hooks
- [ ] No complex fullscreen restoration prompts (should be unnecessary)
- [ ] Import `useRouter` from `next/navigation` (not `next/router`)

## Common Anti-Patterns to Avoid

### 1. The "Quick Fix" Trap
```typescript
// Don't do this even if "it works"
const handleClick = () => {
  window.location.href = '/somewhere' // ❌ Lazy
}

// Do this instead
const handleClick = () => {
  router.push('/somewhere') // ✅ Proper
}
```

### 2. The "Copy-Paste" Mistake
- If you see `window.location.href` in existing code, **fix it**, don't copy it
- One bad pattern can infect the entire codebase

### 3. The "State Preservation" Hack
```typescript
// Don't try to manually preserve state across page reloads
sessionStorage.setItem('someState', value) // ❌ Unnecessary hack

// Just use proper navigation and state persists automatically
router.push('/route') // ✅ State preserved
```

## Performance Benefits

Using proper Next.js navigation provides:
- **Instant navigation** (no page reload)
- **Prefetching** of linked routes
- **Preserved React state** across routes
- **Better Core Web Vitals** scores
- **Maintained fullscreen** and other browser states

## Migration Guide

If you find `window.location.href` in the codebase:

1. Add `useRouter` import:
   ```typescript
   import { useRouter } from 'next/navigation'
   ```

2. Get router instance in component:
   ```typescript
   const router = useRouter()
   ```

3. Replace the navigation:
   ```typescript
   // Before
   window.location.href = '/path'

   // After
   router.push('/path')
   ```

4. Test that state is preserved across navigation

## Exception Cases

The **ONLY** time you should use `window.location.href` is for:
- External links (different domains)
- Full page refreshes (rare, must be justified)
- Server-side redirects (outside React components)

For everything else: **Use the router!**

---

**Remember:** We chose Next.js for its routing capabilities. Using `window.location.href` is like buying a car and pushing it everywhere instead of using the engine. 🚗➡️🦶

*Last updated: When we fixed the fullscreen persistence issue by actually using Next.js properly*