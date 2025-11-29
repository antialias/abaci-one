# Pointer Lock UI Controls

## Critical Rule

**Any interactive UI element (buttons, checkboxes, links) within the pointer-locked map region MUST work in both:**

1. **Regular mode** - normal mouse cursor, standard click events
2. **Pointer lock mode** - fake cursor, custom hit detection via `usePointerLockButton` hook

## Why This Matters

When pointer lock is active:

- The real mouse cursor is hidden
- A fake cursor is rendered based on accumulated mouse movement
- Standard `onClick` events do NOT fire because the browser's click detection doesn't know where the fake cursor is
- We must manually check if the fake cursor position intersects with UI elements

## How to Implement

### 1. Use the `usePointerLockButton` Hook

```typescript
import {
  usePointerLockButton,
  usePointerLockButtonRegistry,
} from "./usePointerLockButton";

// Create a hook for your control
const myButton = usePointerLockButton({
  id: "my-button", // Unique identifier
  disabled: false, // Whether control is disabled
  active: true, // Whether control is visible/mounted
  pointerLocked, // From usePointerLock hook
  cursorPosition, // Current fake cursor position
  containerRef, // Container element ref
  onClick: handleClick, // Click handler
});
```

### 2. Register with Button Registry

```typescript
const buttonRegistry = usePointerLockButtonRegistry();

useEffect(() => {
  buttonRegistry.register("my-button", myButton.checkClick, handleClick);
  return () => buttonRegistry.unregister("my-button");
}, [buttonRegistry, myButton.checkClick, handleClick]);
```

### 3. Attach Ref and Hover Styles in JSX

```tsx
<button
  ref={myButton.refCallback}
  onClick={(e) => {
    e.stopPropagation();
    handleClick();
  }}
  style={{
    // Apply hover styles when fake cursor is over element
    ...(myButton.isHovered ? { backgroundColor: "#..." } : {}),
  }}
>
  Click Me
</button>
```

## Currently Implemented Controls

The following UI elements in MapRenderer have pointer lock support:

| Control              | ID                     | Description                             |
| -------------------- | ---------------------- | --------------------------------------- |
| Give Up button       | `give-up`              | Reveals the correct answer              |
| Hint button          | `hint`                 | Shows/hides the hint bubble             |
| Speak button         | `speak-hint`           | Reads hint aloud                        |
| Auto-hint checkbox   | `auto-hint-checkbox`   | Toggle auto-open hint on region advance |
| Auto-speak checkbox  | `auto-speak-checkbox`  | Toggle auto-speak on hint open          |
| With accent checkbox | `with-accent-checkbox` | Toggle regional accent for speech       |

## Checklist for Adding New Controls

When adding any new interactive element in the pointer-locked region:

- [ ] Create a `usePointerLockButton` hook for the element
- [ ] Create a `useCallback` handler if the onClick logic needs memoization
- [ ] Register the button with `buttonRegistry` in the useEffect
- [ ] Attach `refCallback` to the element
- [ ] Add hover styles that respond to `isHovered`
- [ ] Test in both regular and pointer lock modes
- [ ] Ensure `e.stopPropagation()` is called to prevent map interaction

## Common Gotchas

1. **Stale closures** - Make sure your onClick handlers use `useCallback` with proper dependencies
2. **Active state** - Set `active: false` when the control is not visible (prevents phantom clicks)
3. **Disabled state** - Set `disabled: true` to prevent hover/click while disabled
4. **Ref timing** - The `refCallback` updates bounds on each render; if the element moves, bounds update automatically
