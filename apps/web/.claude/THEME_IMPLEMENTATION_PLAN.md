# Light/Dark Theme Implementation Plan

## Status: Phase 1 Complete ✅

**Last Updated:** 2025-01-07

## Overview

This document outlines the complete plan for implementing auto-switching light/dark themes across the entire Abaci.One website. The implementation follows a page-by-page approach to allow incremental testing and rollout.

---

## Phase 1: Foundation ✅ COMPLETE

**Goal:** Set up the infrastructure needed for theming across the entire app.

### Completed Tasks

- [x] Add semantic color tokens to Panda CSS config
  - `bg.canvas`, `bg.surface`, `bg.subtle`, `bg.muted`
  - `text.primary`, `text.secondary`, `text.muted`, `text.inverse`
  - `border.default`, `border.muted`, `border.emphasis`
  - `accent.default`, `accent.emphasis`, `accent.muted`, `accent.subtle`
  - `interactive.hover`, `interactive.active`

- [x] Create ThemeProvider with system preference detection
  - Detects `prefers-color-scheme` media query
  - Supports `light`, `dark`, `system` modes
  - Persists to localStorage
  - Applies `data-theme` attribute to document root

- [x] Update global styles for theme support
  - Added `color-scheme` CSS property
  - Configured `data-theme` selectors

- [x] Create theme toggle component
  - Simple button with ☀️/🌙 icons
  - Added to navigation bar
  - Uses semantic tokens as proof-of-concept

- [x] Regenerate Panda CSS with new tokens
  - `pnpm panda codegen` executed successfully

### Files Modified

- `panda.config.ts` - Added semantic tokens and conditions
- `src/contexts/ThemeContext.tsx` - NEW
- `src/components/ThemeToggle.tsx` - NEW
- `src/components/ClientProviders.tsx` - Added ThemeProvider
- `src/components/AppNavBar.tsx` - Added ThemeToggle
- `src/app/globals.css` - Added color-scheme property

### Testing Notes

**Current State:** Only the theme toggle button uses semantic tokens. Rest of site still hardcoded to dark colors.

**What to Test:**
- Theme toggle button appears in nav bar (top-right)
- Clicking toggles between light/dark
- Theme persists on page reload
- Button styling changes with theme (bg, border, text colors)
- System preference is detected on first visit

---

## Phase 2: Core Pages (Week 1-2)

**Goal:** Convert high-traffic, simple pages to use semantic tokens.

### 2.1: Homepage (`src/app/page.tsx`)

**Complexity:** MEDIUM - Gradients and hero section need careful adjustment

**Current Issues:**
- Background: `rgba(15, 23, 42, 1)` hardcoded
- Hero gradient: Dark purple/blue hardcoded
- Skill cards: Dark backgrounds with light borders
- Game cards: `rgba(30, 41, 59, 1)` backgrounds

**Changes Needed:**
```typescript
// Hero section background
bg: 'bg.canvas'  // instead of rgba(15, 23, 42, 1)

// Hero gradient overlay
background: 'linear-gradient(135deg,
  token(colors.accent.subtle) 0%,
  token(colors.bg.canvas) 100%)'

// Skill cards
bg: 'bg.surface'
borderColor: 'border.default'
color: 'text.primary'

// Headings
color: 'text.primary'  // instead of white/#f1f5f9
```

**Lines to Change:**
- Line 45-50: Main container background
- Line 88-95: Hero gradient
- Line 182-190: Skill cards
- Line 282-290: Game cards
- Line 156: Main heading color

**Testing Checklist:**
- [ ] Hero gradient looks good in both modes
- [ ] Skill cards have proper contrast
- [ ] Game preview cards are readable
- [ ] Hover states work in both themes
- [ ] Text hierarchy is maintained

---

### 2.2: Blog Index (`src/app/blog/page.tsx`)

**Complexity:** LOW - Straightforward color replacements

**Current Issues:**
- Background: `gray.900` (`#111827`)
- Card backgrounds: `rgba(30, 41, 59, 0.6)`
- Text colors: Hardcoded light grays
- Borders: `rgba(75, 85, 99, 0.5)`

**Changes Needed:**
```typescript
// Main container
bg: 'bg.canvas'

// Blog cards
bg: 'bg.surface'
borderColor: 'border.default'

// Title
color: 'text.primary'

// Description
color: 'text.secondary'

// Meta text (date, author)
color: 'text.muted'

// Tags
bg: 'accent.muted'
color: 'accent.emphasis'
```

**Lines to Change:**
- Line 31: Container background
- Line 55-65: Card styling
- Line 82: Title color
- Line 94: Description color
- Line 107-115: Tag styling

**Testing Checklist:**
- [ ] Card backgrounds visible in both modes
- [ ] Text readable with proper contrast
- [ ] Hover states clear
- [ ] Tags stand out appropriately

---

### 2.3: Blog Post Page (`src/app/blog/[slug]/page.tsx`)

**Complexity:** HIGH - Complex markdown styling with 10+ nested selectors

**Current Issues:**
- Background pattern: Assumes dark background
- Markdown content: 100+ lines of nested CSS (h1, h2, p, code, tables, blockquotes, etc.)
- Code blocks: Dark background required
- Inline SVGs: Use CSS custom properties (already done ✅)

**Changes Needed:**

```typescript
// Main container
bg: 'bg.canvas'

// Article content wrapper
color: 'text.primary'

// Headings
'& h1': { color: 'text.primary' }
'& h2': { color: 'accent.emphasis' }
'& h3': { color: 'accent.default' }

// Paragraphs
'& p': { color: 'text.primary' }

// Links
'& a': {
  color: 'accent.default',
  _hover: { color: 'accent.emphasis' }
}

// Code blocks
'& pre': {
  bg: 'bg.muted',
  borderColor: 'border.emphasis',
  color: 'text.primary'
}

// Inline code
'& code': {
  bg: 'bg.subtle',
  color: 'accent.emphasis',
  borderColor: 'border.default'
}

// Blockquotes
'& blockquote': {
  borderColor: 'accent.default',
  bg: 'accent.subtle',
  color: 'text.secondary'
}

// Tables
'& th': {
  bg: 'accent.muted',
  color: 'accent.emphasis',
  borderColor: 'accent.default'
}

'& td': {
  borderColor: 'border.default',
  color: 'text.secondary'
}

'& tr:hover td': {
  bg: 'interactive.hover'
}
```

**Lines to Change:**
- Line 78-82: Main container background
- Line 86-96: Background pattern (may need two versions)
- Line 217-357: ALL markdown content styles

**Special Considerations:**
- Background pattern might need `opacity` adjustment for light mode
- Code syntax highlighting might need separate light/dark themes
- SVG custom properties already work (done in earlier work) ✅

**Testing Checklist:**
- [ ] All heading levels readable
- [ ] Links have proper contrast
- [ ] Code blocks readable in both modes
- [ ] Tables properly styled
- [ ] Blockquotes stand out but aren't jarring
- [ ] Inline SVGs (ten-frames) still work
- [ ] Background pattern doesn't interfere

---

### 2.4: Guide Page (`src/app/guide/page.tsx`)

**Complexity:** LOW - Already has light styling, needs refactoring for consistency

**Current Issues:**
- Uses isolated light mode styling
- Doesn't use semantic tokens
- Needs integration with theme system

**Changes Needed:**
```typescript
// Convert existing light styles to semantic tokens
bg: 'bg.canvas'  // instead of white
color: 'text.primary'  // instead of gray.900

// Section backgrounds
bg: 'bg.surface'

// Borders
borderColor: 'border.default'
```

**Lines to Change:**
- Line 28: Main background
- Line 45-50: Section cards
- Line 72: Text colors

**Testing Checklist:**
- [ ] Maintains current light mode appearance
- [ ] Works in dark mode too
- [ ] Consistent with other pages

---

### 2.5: Games Listing (`src/app/games/page.tsx`)

**Complexity:** LOW - Similar to blog index

**Current Issues:**
- Background: Dark hardcoded
- Game cards: Dark backgrounds
- Text: Light grays hardcoded

**Changes Needed:**
```typescript
bg: 'bg.canvas'

// Game cards
bg: 'bg.surface'
borderColor: 'border.default'

// Card hover
bg: 'interactive.hover'
```

**Lines to Change:**
- Line 35: Main background
- Line 58-65: Game card styling
- Line 88: Title colors

**Testing Checklist:**
- [ ] Cards visible in both modes
- [ ] Hover states work
- [ ] Game thumbnails look good

---

## Phase 3: Complex Content (Week 2-3)

**Goal:** Handle arcade games, SVGs, and complex interactive components.

### 3.1: Arcade Games

**Affected Files (5+ games):**
- `src/arcade-games/complement-race/`
- `src/arcade-games/card-sorting/`
- `src/arcade-games/memory-quiz/`
- `src/arcade-games/matching-pairs/`
- `src/arcade-games/rithmomachia/`

**Common Issues:**
- Inline SVGs with hardcoded colors (#7cb342, #d97757, #6366f1, etc.)
- Game board backgrounds assume dark theme
- Score displays, timers hardcoded
- Each game has 10+ color references

**Strategy:**

1. **Create game-specific theme tokens** (extend Panda config):
```typescript
semanticTokens: {
  colors: {
    'game.background': {
      value: { base: '#f8fafc', _dark: '#1e293b' }
    },
    'game.surface': {
      value: { base: '#ffffff', _dark: '#334155' }
    },
    'game.success': {
      value: { base: '#22c55e', _dark: '#4ade80' }
    },
    'game.error': {
      value: { base: '#ef4444', _dark: '#f87171' }
    },
    'game.warning': {
      value: { base: '#f59e0b', _dark: '#fbbf24' }
    }
  }
}
```

2. **Handle SVGs:**
   - Option A: Convert to inline React components using `currentColor`
   - Option B: Create dual SVG versions (light/dark)
   - Option C: Use CSS filters to invert colors

3. **Game-by-Game Conversion:**
   - Start with simplest (Memory Quiz, Card Sorting)
   - Then Complement Race (most complex)
   - Finally Rithmomachia (largest, but well-structured)

**Per-Game Checklist Template:**
- [ ] Convert background colors
- [ ] Update text colors
- [ ] Fix SVG colors
- [ ] Test game board visibility
- [ ] Verify score/timer readability
- [ ] Check button states
- [ ] Test animations don't break

---

### 3.2: Navigation Components

**Affected Files:**
- `src/components/AppNavBar.tsx` (partially done ✅)
- `src/components/nav/*.tsx` (dropdowns, modals)

**Current Issues:**
- Dropdowns use hardcoded dark backgrounds
- Room creation modal dark themed
- Player indicators hardcoded colors

**Changes Needed:**
```typescript
// Dropdown menus
bg: 'bg.surface'
borderColor: 'border.default'

// Modal overlays
bg: 'rgba(0, 0, 0, 0.5)'  // Keep semi-transparent overlay
// Modal content
bg: 'bg.canvas'

// Player status indicators
// Need semantic tokens: online/offline/away colors
```

**Files to Update:**
- `CreateRoomModal.tsx`
- `JoinRoomModal.tsx`
- `RoomInfo.tsx`
- `NetworkPlayerIndicator.tsx`
- `AbacusDisplayDropdown.tsx`
- `LanguageSelector.tsx`

---

### 3.3: External SVG Strategy

**Problem:** Blog ten-frame examples use external SVG files loaded via `<img>` tags. CSS variables don't pass through.

**Current Solution:** Hardcoded light colors (white text, etc.) for dark background.

**Future Options:**

**Option 1: Dual SVG Versions** (Recommended)
```typescript
// Generate both versions
generateTenFrameExamples.ts produces:
- with-ten-frames-light.svg
- with-ten-frames-dark.svg

// In markdown, use theme-aware img src
<img src={`/blog/ten-frame-examples/${filename}-${resolvedTheme}.svg`} />
```

**Option 2: Inline SVGs in Markdown**
- Embed SVG code directly (larger file size)
- CSS variables work
- More maintainable

**Option 3: Dynamic SVG Loading**
- Use React component to load and theme SVGs
- Requires converting blog posts to MDX

**Decision:** Start with Option 1 (dual versions) for blog examples.

---

## Phase 4: Polish & Testing (Week 3)

**Goal:** Ensure quality, accessibility, and performance.

### 4.1: Accessibility Audit

**WCAG AA Requirements:**
- Contrast ratio ≥ 4.5:1 for normal text
- Contrast ratio ≥ 3:1 for large text (18pt+)
- Contrast ratio ≥ 3:1 for UI components

**Testing Tools:**
- Chrome DevTools Lighthouse
- axe DevTools
- WebAIM Contrast Checker

**Critical Areas:**
- Purple accent on light backgrounds (may need darker shade)
- Gold/amber accents (check contrast)
- Game board elements (must be distinguishable)

**Token Adjustments Needed:**
```typescript
// If contrast fails, adjust:
'accent.default': {
  value: {
    base: '#6d28d9',  // Darker purple for light mode
    _dark: '#a78bfa',
  }
}
```

---

### 4.2: Cross-Browser Testing

**Browsers to Test:**
- Chrome/Edge (Chromium)
- Firefox
- Safari (macOS + iOS)
- Mobile browsers

**Known Issues:**
- Safari has different `prefers-color-scheme` behavior
- Firefox may handle `color-scheme` differently
- Mobile browsers: test on actual devices

**Test Matrix:**
| Browser | Light Mode | Dark Mode | System Auto |
|---------|-----------|-----------|-------------|
| Chrome  | ⬜ | ⬜ | ⬜ |
| Firefox | ⬜ | ⬜ | ⬜ |
| Safari  | ⬜ | ⬜ | ⬜ |
| iOS Safari | ⬜ | ⬜ | ⬜ |
| Android Chrome | ⬜ | ⬜ | ⬜ |

---

### 4.3: Performance Optimization

**Considerations:**

1. **Initial Render Flash Prevention:**
```typescript
// Add script to <head> to set theme before render
<script dangerouslySetInnerHTML={{
  __html: `
    (function() {
      const theme = localStorage.getItem('theme') || 'system';
      const resolvedTheme = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      document.documentElement.setAttribute('data-theme', resolvedTheme);
      document.documentElement.classList.add(resolvedTheme);
    })();
  `
}} />
```

2. **CSS Variable Performance:**
- Semantic tokens compile to CSS vars
- Modern browsers handle this efficiently
- No measurable perf impact expected

3. **SVG Loading:**
- Dual SVG versions add minimal overhead
- Consider lazy loading for below-fold content

---

### 4.4: Enhanced Theme Toggle (Optional)

**Current:** Simple button with emoji

**Enhanced Version:**
- Three-state toggle (Light / System / Dark)
- Animated transition
- Keyboard accessible
- Show current system preference

**Design:**
```
┌─────────────────────────┐
│ ☀️  Light    System  🌙 Dark │
│    ●─────────────○          │
└─────────────────────────┘
```

**Implementation:**
```typescript
<SegmentedControl>
  <Option value="light">☀️ Light</Option>
  <Option value="system">🖥️ System</Option>
  <Option value="dark">🌙 Dark</Option>
</SegmentedControl>
```

---

## Token Reference

### Complete Semantic Token List

```typescript
// Backgrounds
bg.canvas      // Main page background
bg.surface     // Card/panel backgrounds
bg.subtle      // Subtle backgrounds (hover states)
bg.muted       // Muted backgrounds (disabled states)

// Text
text.primary   // Main text color
text.secondary // Secondary/helper text
text.muted     // Muted text (metadata, captions)
text.inverse   // Text on colored backgrounds

// Borders
border.default  // Standard borders
border.muted    // Subtle borders
border.emphasis // Emphasized borders

// Accents (Purple theme)
accent.default  // Primary accent color
accent.emphasis // Stronger accent (hover, active)
accent.muted    // Very subtle accent (backgrounds)
accent.subtle   // Subtle accent (highlights)

// Interactive
interactive.hover  // Hover state backgrounds
interactive.active // Active/pressed state backgrounds
```

### Usage Examples

```typescript
// Card component
<div className={css({
  bg: 'bg.surface',
  borderWidth: '1px',
  borderColor: 'border.default',
  borderRadius: '0.5rem',
  p: '1rem',
  _hover: {
    bg: 'interactive.hover',
    borderColor: 'border.emphasis',
  }
})}>
  <h3 className={css({ color: 'text.primary' })}>
    Title
  </h3>
  <p className={css({ color: 'text.secondary' })}>
    Description text
  </p>
</div>
```

---

## Migration Checklist

Use this checklist when converting each page:

### Before Starting
- [ ] Read page code, note all hardcoded colors
- [ ] Identify special cases (gradients, SVGs, animations)
- [ ] Check for any inline styles or !important overrides

### During Conversion
- [ ] Replace background colors with `bg.*` tokens
- [ ] Replace text colors with `text.*` tokens
- [ ] Replace border colors with `border.*` tokens
- [ ] Update hover states to use `interactive.*` tokens
- [ ] Convert accent colors to `accent.*` tokens
- [ ] Test in light mode
- [ ] Test in dark mode
- [ ] Test system auto-switch

### After Conversion
- [ ] Run `npm run pre-commit` (type-check, format, lint)
- [ ] Visual regression test (compare before/after screenshots)
- [ ] Verify no console errors
- [ ] Check accessibility contrast ratios
- [ ] Test on mobile viewport
- [ ] Commit with descriptive message

---

## Known Issues & Workarounds

### Issue 1: Panda CSS Token Syntax

**Problem:** Tokens in conditions need specific syntax.

**Wrong:**
```typescript
color: theme === 'dark' ? 'text.primary' : 'gray.900'
```

**Right:**
```typescript
color: 'text.primary'  // Token handles both modes
```

---

### Issue 2: Gradients with Tokens

**Problem:** CSS gradients can't directly use semantic tokens in string templates.

**Workaround:**
```typescript
// Use token() function
background: `linear-gradient(135deg,
  token(colors.accent.subtle),
  token(colors.bg.canvas))`

// Or use CSS variables
background: 'linear-gradient(135deg,
  var(--colors-accent-subtle),
  var(--colors-bg-canvas))'
```

---

### Issue 3: Third-Party Components

**Problem:** Some components (Radix UI, etc.) have their own theming.

**Strategy:**
- Use CSS variables to style Radix components
- Override with Panda tokens where possible
- Some components may need separate light/dark styling

---

## Testing Instructions

### For Each Converted Page:

1. **Visual Test:**
   - Open page in light mode
   - Take screenshot
   - Switch to dark mode
   - Take screenshot
   - Compare: all content should be readable

2. **Interaction Test:**
   - Test all buttons, links, forms
   - Verify hover states
   - Check focus indicators
   - Test animations

3. **Responsive Test:**
   - Test on mobile (375px width)
   - Test on tablet (768px width)
   - Test on desktop (1440px width)

4. **Browser Test:**
   - Test in Chrome
   - Test in Firefox
   - Test in Safari (if available)

5. **Accessibility Test:**
   - Run Lighthouse audit
   - Check contrast ratios
   - Test keyboard navigation

---

## Progress Tracking

### Pages Converted to Semantic Tokens

- [ ] Homepage (`src/app/page.tsx`)
- [ ] Blog Index (`src/app/blog/page.tsx`)
- [ ] Blog Post (`src/app/blog/[slug]/page.tsx`)
- [ ] Guide Page (`src/app/guide/page.tsx`)
- [ ] Games Listing (`src/app/games/page.tsx`)
- [ ] Join Page (`src/app/join/[code]/page.tsx`)

### Components Converted

- [x] ThemeToggle ✅
- [x] AppNavBar (partial - toggle only) ✅
- [ ] CreateRoomModal
- [ ] JoinRoomModal
- [ ] RoomInfo
- [ ] AbacusDisplayDropdown
- [ ] LanguageSelector
- [ ] NetworkPlayerIndicator
- [ ] Tutorial components

### Arcade Games Converted

- [ ] Complement Race
- [ ] Card Sorting
- [ ] Memory Quiz
- [ ] Matching Pairs
- [ ] Rithmomachia

---

## Rollback Plan

If major issues arise:

1. **Quick Rollback:**
```bash
git revert <commit-hash>
```

2. **Feature Flag (Future):**
```typescript
// Add environment variable
NEXT_PUBLIC_ENABLE_THEME_SWITCHING=true

// In ThemeProvider
if (!process.env.NEXT_PUBLIC_ENABLE_THEME_SWITCHING) {
  return children; // Skip theming
}
```

3. **Gradual Rollout:**
- Deploy with theme system disabled by default
- Enable per-page using URL param: `?theme=light`
- Monitor for issues
- Enable globally when stable

---

## Future Enhancements

### Post-Launch Improvements

1. **Theme Customization:**
   - Allow users to customize accent colors
   - Save preferred color schemes per-game
   - Export/import theme preferences

2. **Automatic Theme Scheduling:**
   - Auto-switch based on time of day
   - Sunrise/sunset detection

3. **High Contrast Mode:**
   - Extra high contrast tokens for accessibility
   - Separate from light/dark modes

4. **Theme Preview:**
   - Live preview before applying
   - A/B test different color schemes

---

## Resources

### Documentation
- [Panda CSS Themes](https://panda-css.com/docs/theming/tokens)
- [Next.js Dark Mode](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts#with-tailwind-css)
- [WCAG Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

### Tools
- [Coolors Contrast Checker](https://coolors.co/contrast-checker)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Chrome DevTools Color Picker](https://developer.chrome.com/docs/devtools/accessibility/contrast/)

---

## Notes

- Implementation started: 2025-01-07
- Target completion: 3 weeks from start
- Priority: User-facing pages first, admin/debug pages last
- Breaking changes: None expected (additive only)
