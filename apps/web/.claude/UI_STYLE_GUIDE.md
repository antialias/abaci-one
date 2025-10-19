# UI Style Guide

## Confirmations and Dialogs

**NEVER use native browser dialogs:**
- ❌ `alert()`
- ❌ `confirm()`
- ❌ `prompt()`

**ALWAYS use inline React-based confirmations:**
- Show confirmation UI in-place using React state
- Provide Cancel and Confirm buttons
- Use descriptive warning messages with appropriate emoji (⚠️)
- Follow the Panda CSS styling system
- Match the visual style of the surrounding UI

### Pattern: Inline Confirmation

```typescript
const [confirming, setConfirming] = useState(false)

{!confirming ? (
  <button onClick={() => setConfirming(true)}>
    Delete Item
  </button>
) : (
  <div>
    <div style={{ /* warning styling */ }}>
      ⚠️ Are you sure you want to delete this item?
    </div>
    <div style={{ /* description styling */ }}>
      This action cannot be undone.
    </div>
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={() => setConfirming(false)}>
        Cancel
      </button>
      <button onClick={handleDelete}>
        Confirm Delete
      </button>
    </div>
  </div>
)}
```

### Real Examples

See `/src/components/nav/ModerationPanel.tsx` for production examples:
- Transfer ownership confirmation (lines 1793-1929)
- Unban user confirmation (shows inline warning with Cancel/Confirm)

### Why This Pattern?

1. **Consistency**: Native dialogs look different across browsers and platforms
2. **Control**: We can style, position, and enhance confirmations to match our design
3. **Accessibility**: We can add proper ARIA attributes and keyboard navigation
4. **UX**: Users stay in context rather than being interrupted by modal dialogs
5. **Testing**: Inline confirmations are easier to test than native browser dialogs

### Migration Checklist

When replacing native dialogs:
- [ ] Add state variable for confirmation (e.g., `const [confirming, setConfirming] = useState(false)`)
- [ ] Remove the `confirm()` or `alert()` call from the handler
- [ ] Replace the original UI with conditional rendering
- [ ] Show initial state with primary action button
- [ ] Show confirmation state with warning message + Cancel/Confirm buttons
- [ ] Ensure Cancel button resets state: `onClick={() => setConfirming(false)}`
- [ ] Ensure Confirm button performs action and resets state
- [ ] Add loading states if the action is async
- [ ] Style to match surrounding UI using Panda CSS

## Styling System

This project uses **Panda CSS**, not Tailwind CSS.

- ❌ Never use Tailwind utility classes (e.g., `className="bg-blue-500"`)
- ✅ Always use Panda CSS `css()` function
- ✅ Use Panda's token system (defined in `panda.config.ts`)

See `.claude/CLAUDE.md` for complete Panda CSS documentation.

## Emoji Usage

Emojis are used liberally throughout the UI for visual communication:
- 👑 Host/owner status
- ⏳ Waiting states
- ⚠️ Warnings and confirmations
- ✅ Success states
- ❌ Error states
- 👀 Spectating mode
- 🎮 Gaming context

Use emojis to enhance clarity, not replace text.
