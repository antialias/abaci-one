# PlayingGuideModal - Complete Feature Specification

## Overview
Interactive, draggable, resizable modal for Rithmomachia game guide with i18n support and bust-out functionality.

## File Location
`src/arcade-games/rithmomachia/components/PlayingGuideModal.tsx`

## Dependencies
```typescript
import { useEffect, useState, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { css } from '../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import { useAbacusSettings } from '@/hooks/useAbacusSettings'
import { PieceRenderer } from './PieceRenderer'
import { RithmomachiaBoard, type ExamplePiece } from './RithmomachiaBoard'
import type { PieceType, Color } from '../types'
import '../i18n/config' // Initialize i18n
```

## Props Interface
```typescript
interface PlayingGuideModalProps {
  isOpen: boolean           // Controls visibility
  onClose: () => void      // Called when modal closes
  standalone?: boolean     // True when opened in popup window (full-screen mode)
}
```

## State Management

### Required State
```typescript
const { t, i18n } = useTranslation()
const { data: abacusSettings } = useAbacusSettings()
const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false

const [activeSection, setActiveSection] = useState<Section>('overview')
const [position, setPosition] = useState({ x: 0, y: 0 })
const [size, setSize] = useState({ width: 450, height: 600 })
const [isDragging, setIsDragging] = useState(false)
const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
const [isResizing, setIsResizing] = useState(false)
const [resizeDirection, setResizeDirection] = useState<string>('')
const [isHovered, setIsHovered] = useState(false)
const modalRef = useRef<HTMLDivElement>(null)
```

### Section Type
```typescript
type Section = 'overview' | 'pieces' | 'capture' | 'strategy' | 'harmony' | 'victory'
```

## Core Features

### 1. Radix Dialog Wrapper
**When NOT standalone:**
- Wrap entire modal in `<Dialog.Root open={isOpen} onOpenChange={onClose}>`
- Use `<Dialog.Portal>` for portal rendering
- Use `<Dialog.Overlay>` with backdrop styling
- Use `<Dialog.Content>` as container for draggable/resizable content

**Styling:**
- Overlay: semi-transparent black (`rgba(0, 0, 0, 0.5)`)
- Content: no default positioning (we control via position state)
- Z-index: Must be above game board - use `Z_INDEX.GAME.GUIDE_MODAL` or 15000+

**When standalone:**
- Skip Dialog wrapper entirely
- Render full-screen fixed container

### 2. Draggable Functionality

**Requirements:**
- Click and drag from header to move modal
- Disabled on mobile (`window.innerWidth < 768`)
- Cursor changes to 'move' when hovering header
- Position state tracks x, y coordinates

**Implementation:**
```typescript
const handleMouseDown = (e: React.MouseEvent) => {
  if (window.innerWidth < 768) return
  setIsDragging(true)
  setDragStart({
    x: e.clientX - position.x,
    y: e.clientY - position.y,
  })
}
```

**Effects:**
- Global `mousemove` listener updates position while dragging
- Global `mouseup` listener stops dragging
- Cleanup listeners on unmount

### 3. Resizable Functionality

**Requirements:**
- 8 resize handles: N, S, E, W, NE, NW, SE, SW
- Handles visible only on hover (when `isHovered === true`)
- Disabled on mobile
- Min size: 450x600
- Max size: 90vw x 80vh

**Handle Positions & Cursors:**
- N (top): `cursor: 'ns-resize'`
- S (bottom): `cursor: 'ns-resize'`
- E (right): `cursor: 'ew-resize'`
- W (left): `cursor: 'ew-resize'`
- NE (top-right): `cursor: 'nesw-resize'`
- NW (top-left): `cursor: 'nwse-resize'`
- SE (bottom-right): `cursor: 'nwse-resize'`
- SW (bottom-left): `cursor: 'nesw-resize'`

**Handle Styling:**
- Width/height: 8px (invisible hit area)
- Visible border when hovered: 2px solid blue
- Positioned absolutely at edges/corners

**Implementation:**
```typescript
const handleResizeStart = (e: React.MouseEvent, direction: string) => {
  if (window.innerWidth < 768) return
  e.stopPropagation()
  setIsResizing(true)
  setResizeDirection(direction)
  setDragStart({ x: e.clientX, y: e.clientY })
}
```

### 4. Bust-Out Button

**Location:** Header, right side (before close button)

**Icon:** ↗ or external link icon

**Functionality:**
```typescript
const handleBustOut = () => {
  const url = window.location.origin + '/arcade/rithmomachia/guide'
  const features = 'width=600,height=800,menubar=no,toolbar=no,location=no,status=no'
  window.open(url, 'RithmomachiaGuide', features)
}
```

**Visibility:** Only show if NOT already standalone

**Route:** Must have a route at `/arcade/rithmomachia/guide` that renders:
```tsx
<PlayingGuideModal isOpen={true} onClose={() => window.close()} standalone={true} />
```

### 5. Internationalization

**Setup:**
- i18n config file: `src/arcade-games/rithmomachia/i18n/config.ts`
- Translation files in: `src/arcade-games/rithmomachia/i18n/locales/`
- Languages: en.json, de.json (minimum)

**Usage:**
- All text uses `t('guide.section.key')` format
- Language switcher in header with buttons for each language

**Header Language Switcher:**
```tsx
<div className={css({ display: 'flex', gap: '8px' })}>
  {['en', 'de'].map((lang) => (
    <button
      key={lang}
      onClick={() => i18n.changeLanguage(lang)}
      className={css({
        px: '8px',
        py: '4px',
        fontSize: '12px',
        fontWeight: i18n.language === lang ? 'bold' : 'normal',
        bg: i18n.language === lang ? '#3b82f6' : '#e5e7eb',
        color: i18n.language === lang ? 'white' : '#374151',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      })}
    >
      {lang.toUpperCase()}
    </button>
  ))}
</div>
```

### 6. Centering on Mount

**Effect:**
```typescript
useEffect(() => {
  if (isOpen && modalRef.current && !standalone) {
    const rect = modalRef.current.getBoundingClientRect()
    setPosition({
      x: (window.innerWidth - rect.width) / 2,
      y: Math.max(50, (window.innerHeight - rect.height) / 2),
    })
  }
}, [isOpen, standalone])
```

**Standalone Mode:**
- If standalone, don't center - use full viewport
- Position: fixed, top: 0, left: 0, width: 100vw, height: 100vh

## Layout Structure

```
<Dialog.Root> (if not standalone)
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content asChild>
      <div ref={modalRef} style={{ position: absolute, top: position.y, left: position.x }}>
        {/* Resize handles (8 total, only if hovered and not mobile) */}

        <div> {/* Main container */}
          {/* Header */}
          <div onMouseDown={handleMouseDown} style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
            <h2>{t('guide.title')}</h2>
            <div> {/* Language switcher */}
            <button onClick={handleBustOut}> {/* Bust-out (if not standalone) */}
            <button onClick={onClose}> {/* Close X */}
          </div>

          {/* Navigation tabs */}
          <div> {/* Section buttons: Overview, Pieces, Capture, Strategy, Harmony, Victory */}

          {/* Content area - scrollable */}
          <div style={{ overflow: 'auto', maxHeight: size.height - headerHeight }}>
            {activeSection === 'overview' && <OverviewSection />}
            {activeSection === 'pieces' && <PiecesSection useNativeAbacusNumbers={useNativeAbacusNumbers} />}
            {activeSection === 'capture' && <CaptureSection />}
            {/* ... etc */}
          </div>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

## Styling Requirements

### Main Container
- Background: `#ffffff`
- Border radius: `12px`
- Box shadow: `0 20px 60px rgba(0, 0, 0, 0.3)`
- Border: `1px solid #e5e7eb`
- Position: `absolute` (controlled by position state)
- Width/height: from size state

### Header
- Background: `#f9fafb`
- Border bottom: `1px solid #e5e7eb`
- Padding: `16px`
- Display: flex, justify-between, align-items: center
- Cursor: `move` on desktop (when not standalone)
- Prevent text selection while dragging

### Navigation Tabs
- Display: flex, gap: `8px`
- Padding: `12px 16px`
- Background: `#ffffff`
- Border bottom: `1px solid #e5e7eb`

### Tab Buttons
- Active: bold, blue background, white text
- Inactive: normal weight, gray background, dark text
- Padding: `8px 16px`
- Border radius: `6px`
- Cursor: pointer
- Transition: all 0.2s

### Content Area
- Padding: `24px`
- Overflow: auto
- Max height: calculated (size.height - header - tabs)
- Color: `#374151`
- Line height: `1.6`

### Resize Handles
- Position: absolute
- Width/height: 8px
- Background: transparent
- Border: visible on hover (2px solid `#3b82f6`)
- Z-index: 1 (above content)

## Content Sections

### PiecesSection Component
**Must have its own useAbacusSettings hook:**
```typescript
function PiecesSection() {
  const { data: abacusSettings } = useAbacusSettings()
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false

  // ... piece rendering with useNativeAbacusNumbers prop
}
```

### All RithmomachiaBoard Uses
- Must pass `useNativeAbacusNumbers={useNativeAbacusNumbers}` prop
- Boards show game positions with pieces

### All PieceRenderer Uses
- Must pass `useNativeAbacusNumbers={useNativeAbacusNumbers}` prop
- Renders individual piece icons in pieces section

## Translation Keys (Minimum Required)

```json
{
  "guide": {
    "title": "Rithmomachia Playing Guide",
    "overview": {
      "title": "Overview",
      "content": "..."
    },
    "pieces": {
      "title": "Your Pieces",
      "circle": "Circle",
      "triangle": "Triangle",
      "square": "Square",
      "pyramid": "Pyramid"
    },
    "capture": {
      "title": "Capture Rules",
      "equality": "Equality",
      "multiple": "Multiple",
      "ratio": "Ratio",
      "sum": "Sum",
      "difference": "Difference",
      "product": "Product"
    },
    "strategy": {
      "title": "Strategy Tips"
    },
    "harmony": {
      "title": "Harmony (Progressions)"
    },
    "victory": {
      "title": "Victory Conditions"
    }
  }
}
```

## Error Prevention

1. **Z-Index Issue:** Must be higher than game board (use `Z_INDEX.GAME.GUIDE_MODAL` or 15000+)
2. **Lost Work:** Never use `git checkout --` on working files without confirming stash/commit first
3. **Dialog Overlay:** Must render with high z-index to cover game
4. **Mobile:** Disable drag/resize on mobile, make responsive
5. **Standalone Route:** Must exist at `/arcade/rithmomachia/guide`

## Testing Checklist

- [ ] Modal opens and closes correctly
- [ ] Dragging works on desktop
- [ ] Resizing works on desktop (all 8 handles)
- [ ] Drag/resize disabled on mobile
- [ ] Language switcher changes content
- [ ] Bust-out button opens new window
- [ ] New window renders standalone mode correctly
- [ ] Modal appears above game board
- [ ] Close button works
- [ ] All sections render correctly
- [ ] Native abacus numbers toggle respected
- [ ] Translations load for all languages
- [ ] Modal centers on first open
- [ ] Position/size persists while open
- [ ] Cleanup happens on unmount

## Implementation Priority

1. Basic Dialog structure with standalone mode
2. Header with title, close, bust-out
3. Language switcher and i18n setup
4. Navigation tabs
5. Content sections (start with existing content)
6. Dragging functionality
7. Resizing functionality
8. Native abacus numbers integration
9. Translation files
10. Standalone route page
