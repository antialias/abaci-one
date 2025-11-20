# Arcade Error Handling System

## Overview

Comprehensive error handling system for arcade games to ensure users always see meaningful error messages instead of silent failures.

## Components

### 1. ErrorToast (`src/components/ErrorToast.tsx`)

User-facing error notification component:
- Prominent red toast in bottom-right corner
- Auto-dismisses after 10 seconds
- Collapsible technical details
- Mobile-responsive

**Usage:**
```typescript
<ErrorToast
  message="Game session error"
  details="Error: Failed to fetch session..."
  onDismiss={() => clearError(errorId)}
/>
```

### 2. ArcadeErrorBoundary (`src/components/ArcadeErrorBoundary.tsx`)

React error boundary for catching React errors:
- Catches component render errors
- Shows user-friendly fallback UI
- Provides "Try Again" and "Return to Lobby" buttons
- Collapsible stack trace for debugging

**Usage:**
```typescript
<ArcadeErrorBoundary>
  <GameComponent />
</ArcadeErrorBoundary>
```

### 3. ArcadeErrorContext (`src/contexts/ArcadeErrorContext.tsx`)

Global error management context:
- Manages error state across the app
- Renders error toasts
- Auto-cleans up old errors

**Usage:**
```typescript
// Wrap your app/page
<ArcadeErrorProvider>
  {children}
</ArcadeErrorProvider>

// Use in components
const { addError, clearError } = useArcadeError()
addError('Something went wrong', 'Technical details...')
```

### 4. Enhanced useArcadeSocket Hook

Socket hook now automatically shows error toasts for:
- **Connection errors**: Failed to connect to server
- **Disconnections**: Connection lost
- **Session errors**: Failed to load/update session
- **Move rejections**: Invalid moves (non-version-conflict)
- **No active session**: Session not found

Can suppress toasts with `suppressErrorToasts: true` option.

## Error Categories

### Network/Connection Errors
- **Connection error**: Failed to connect to game server
- **Disconnection**: Connection lost, attempting to reconnect

### Session Errors
- **Session error**: Failed to load or update game session
- **No active session**: No game session found

### Game State Errors
- **Move rejected**: Invalid move submitted
- **Version conflict**: Concurrent update detected (silent, not shown to user)

### React Errors
- **Component errors**: Caught by ErrorBoundary, shows fallback UI

## Integration Guide

### For New Arcade Games

1. **Wrap your game page with error providers:**
```typescript
// src/app/arcade/your-game/page.tsx
import { ArcadeErrorProvider } from '@/contexts/ArcadeErrorContext'
import { ArcadeErrorBoundary } from '@/components/ArcadeErrorBoundary'

export default function YourGamePage() {
  return (
    <ArcadeErrorProvider>
      <ArcadeErrorBoundary>
        <YourGameProvider>
          <YourGameComponent />
        </YourGameProvider>
      </ArcadeErrorBoundary>
    </ArcadeErrorProvider>
  )
}
```

2. **Use error context in your components:**
```typescript
import { useArcadeError } from '@/contexts/ArcadeErrorContext'

function YourComponent() {
  const { addError } = useArcadeError()

  try {
    // Your code
  } catch (error) {
    addError(
      'User-friendly message',
      `Technical details: ${error.message}`
    )
  }
}
```

3. **Socket hook is automatic:**
The `useArcadeSocket` hook already shows errors by default. No changes needed unless you want to suppress them.

## Best Practices

### DO:
- ✅ Use `addError()` for runtime errors
- ✅ Provide user-friendly primary messages
- ✅ Include technical details in the `details` parameter
- ✅ Wrap arcade pages with both ErrorProvider and ErrorBoundary
- ✅ Let socket errors show automatically (they're handled)

### DON'T:
- ❌ Don't just log errors to console
- ❌ Don't show raw error messages to users
- ❌ Don't swallow errors silently
- ❌ Don't use `alert()` for errors
- ❌ Don't forget to wrap new arcade games

## TODO

- [ ] Wrap all arcade game pages with error providers
- [ ] Add error recovery strategies (retry buttons)
- [ ] Add error reporting/telemetry
- [ ] Test all error scenarios
- [ ] Document error codes/types

## Testing Errors

To test error handling:

1. **Connection errors**: Disconnect network, try to join game
2. **Session errors**: Use invalid room ID
3. **Move rejection**: Submit invalid move
4. **React errors**: Throw error in component render

## Example: Know Your World

The know-your-world game had a "Failed to fetch session" error that was only logged to console. With the new system:

**Before:**
- Error logged to console
- User sees nothing, buttons don't work
- No way to know what's wrong

**After:**
- Error toast appears: "Game session error"
- Technical details available (collapsible)
- User can refresh or return to lobby
- Clear actionable feedback

## Migration

Existing arcade games need to be updated to wrap with error providers. Priority order:

1. ✅ useArcadeSocket hook (done)
2. ✅ Error components created (done)
3. ⏳ Wrap arcade game pages
4. ⏳ Test error scenarios
5. ⏳ Add recovery strategies
