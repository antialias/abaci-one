# Plan: Abacus Vision as Docked Abacus Video Source

**Status:** In Progress
**Created:** 2026-01-01
**Last Updated:** 2026-01-01

## Overview

Transform abacus vision from a standalone modal into an alternate "source" for the docked abacus. When vision is enabled, the processed camera feed replaces the SVG abacus representation in the dock.

**Current Architecture:**

```
AbacusDock → MyAbacus (SVG) → value displayed
AbacusVisionBridge → Modal → onValueDetected callback
```

**Target Architecture:**

```
AbacusDock
  ├─ [vision disabled] → MyAbacus (SVG)
  └─ [vision enabled]  → VisionFeed (processed video) + value detection
                            ↓
                      Broadcasts to observers
```

---

## Key Requirements

1. **Vision hint on docks** - Camera icon visible on/near AbacusDock
2. **Persistent across docking** - Vision icon stays visible when abacus is docked
3. **Setup gating** - Clicking opens setup if no source/calibration configured
4. **Video replaces SVG** - When enabled, camera feed shows instead of SVG abacus
5. **Observer visibility** - Teachers/parents see student's video feed during observation

---

## Progress Tracker

- [ ] **Phase 1:** Vision State in MyAbacusContext
- [ ] **Phase 2:** Vision Indicator on AbacusDock
- [ ] **Phase 3:** Video Feed Replaces Docked Abacus
- [ ] **Phase 4:** Vision Setup Modal Refactor
- [ ] **Phase 5:** Broadcast Video Feed to Observers
- [ ] **Phase 6:** Polish & Edge Cases

---

## Phase 1: Vision State in MyAbacusContext

**Goal:** Add vision-related state to the abacus context so it's globally accessible.

**Files to modify:**

- `apps/web/src/contexts/MyAbacusContext.tsx`

**State to add:**

```typescript
interface VisionConfig {
  enabled: boolean
  cameraDeviceId: string | null
  calibration: CalibrationGrid | null
  remoteCameraSessionId: string | null  // For phone camera
}

// In context:
visionConfig: VisionConfig
setVisionEnabled: (enabled: boolean) => void
setVisionCalibration: (calibration: CalibrationGrid | null) => void
setVisionCamera: (deviceId: string | null) => void
isVisionSetupComplete: boolean  // Derived: has camera AND calibration
```

**Persistence:** Save to localStorage alongside existing abacus display config.

**Testable outcome:**

- Open browser console, check that vision config is in context
- Toggle vision state programmatically, see it persist across refresh

---

## Phase 2: Vision Indicator on AbacusDock

**Goal:** Show a camera icon near the dock that indicates vision status and opens setup.

**Files to modify:**

- `apps/web/src/components/AbacusDock.tsx` - Add vision indicator
- `apps/web/src/components/MyAbacus.tsx` - Show indicator when docked

**UI Design:**

```
┌─────────────────────────────────┐
│ [Docked Abacus]          [↗]   │  ← Undock button (existing)
│                                 │
│                          [📷]  │  ← Vision toggle (NEW)
│                                 │
└─────────────────────────────────┘
```

**Behavior:**

- Icon shows camera with status indicator:
  - 🔴 Red dot = not configured
  - 🟢 Green dot = configured and enabled
  - ⚪ No dot = configured but disabled
- Click opens VisionSetupModal (Phase 4)
- Visible in BOTH floating button AND docked states

**Testable outcome:**

- See camera icon on docked abacus
- Click icon, see setup modal open
- Icon shows different states based on config

---

## Phase 3: Video Feed Replaces Docked Abacus

**Goal:** When vision is enabled, render processed video instead of SVG abacus.

**Files to modify:**

- `apps/web/src/components/MyAbacus.tsx` - Conditional rendering
- Create: `apps/web/src/components/vision/DockedVisionFeed.tsx`

**DockedVisionFeed component:**

```typescript
interface DockedVisionFeedProps {
  width: number;
  height: number;
  onValueDetected: (value: number) => void;
}

// Renders:
// - Processed/cropped camera feed
// - Overlays detected column values
// - Small "disable vision" button
```

**MyAbacus docked mode change:**

```tsx
// In docked rendering section:
{isDocked && (
  visionConfig.enabled && isVisionSetupComplete ? (
    <DockedVisionFeed
      width={...}
      height={...}
      onValueDetected={setDockedValue}
    />
  ) : (
    <Abacus value={abacusValue} ... />
  )
)}
```

**Testable outcome:**

- Enable vision (manually set in console if needed)
- See video feed in dock instead of SVG abacus
- Detected values update the context

---

## Phase 4: Vision Setup Modal Refactor

**Goal:** Streamline the setup flow - AbacusVisionBridge becomes a setup wizard.

**Files to modify:**

- `apps/web/src/components/vision/AbacusVisionBridge.tsx` - Simplify to setup-only
- Create: `apps/web/src/components/vision/VisionSetupModal.tsx`

**Setup flow:**

```
[Open Modal]
    ↓
Is camera selected? ─No──→ [Select Camera Screen]
    │Yes                         ↓
    ↓                       Select device
Is calibrated? ─No───→ [Calibration Screen]
    │Yes                    ↓
    ↓                   Manual or ArUco
[Ready Screen]
    ├─ Preview of what vision sees
    ├─ [Enable Vision] button
    └─ [Reconfigure] button
```

**Quick-toggle behavior:**

- If fully configured: clicking vision icon toggles on/off immediately
- If not configured: opens setup modal
- Long-press or secondary click: always opens settings

**Testable outcome:**

- Complete setup flow from scratch
- Settings persist across refresh
- Quick toggle works when configured

---

## Phase 5: Broadcast Video Feed to Observers

**Goal:** Teachers/parents observing a session see the student's vision video feed.

**Files to modify:**

- `apps/web/src/hooks/useSessionBroadcast.ts` - Add vision frame broadcasting
- `apps/web/src/hooks/useSessionObserver.ts` - Receive vision frames
- `apps/web/src/components/classroom/SessionObserverView.tsx` - Display vision feed

**Broadcasting strategy:**

```typescript
// In useSessionBroadcast, when vision is enabled:
// Emit compressed frames at reduced rate (5 fps for bandwidth)

socket.emit("vision-frame", {
  sessionId,
  imageData: compressedJpegBase64,
  timestamp: Date.now(),
  detectedValue: currentValue,
});

// Also broadcast vision state:
socket.emit("practice-state", {
  ...existingState,
  visionEnabled: true,
  visionConfidence: confidence,
});
```

**Observer display:**

```typescript
// In SessionObserverView, when student has vision enabled:
// Show video feed instead of SVG abacus in the observation panel

{studentState.visionEnabled ? (
  <ObserverVisionFeed frames={receivedFrames} />
) : (
  <AbacusDock value={studentState.abacusValue} />
)}
```

**Testable outcome:**

- Student enables vision, starts practice
- Teacher opens observer modal
- Teacher sees student's camera feed (not SVG abacus)

---

## Phase 6: Polish & Edge Cases

**Goal:** Handle edge cases and improve UX.

**Items:**

1. **Connection loss handling** - Fall back to SVG if video stops
2. **Bandwidth management** - Adaptive quality based on connection
3. **Mobile optimization** - Vision setup works on phone screens
4. **Reconnection** - Re-establish vision feed after disconnect
5. **Multiple observers** - Efficient multicast of video frames

**Testable outcome:**

- Disconnect/reconnect scenarios work smoothly
- Mobile users can configure vision
- Multiple teachers can observe same student

---

## Implementation Order & Dependencies

```
Phase 1 (Foundation)
    ↓
Phase 2 (UI Integration)
    ↓
Phase 3 (Core Feature) ←── Requires Phase 1, 2
    ↓
Phase 4 (UX Refinement) ←── Can start in parallel with Phase 3
    ↓
Phase 5 (Observation) ←── Requires Phase 3
    ↓
Phase 6 (Polish) ←── After all features work
```

---

## Files Summary

### Modify

| File                                           | Changes                                       |
| ---------------------------------------------- | --------------------------------------------- |
| `contexts/MyAbacusContext.tsx`                 | Add vision state, persistence                 |
| `components/MyAbacus.tsx`                      | Vision indicator, conditional video rendering |
| `components/AbacusDock.tsx`                    | Pass through vision-related props             |
| `hooks/useSessionBroadcast.ts`                 | Emit vision frames                            |
| `hooks/useSessionObserver.ts`                  | Receive vision frames                         |
| `components/classroom/SessionObserverView.tsx` | Display vision feed                           |

### Create

| File                                       | Purpose                       |
| ------------------------------------------ | ----------------------------- |
| `components/vision/VisionSetupModal.tsx`   | Streamlined setup wizard      |
| `components/vision/DockedVisionFeed.tsx`   | Video display for docked mode |
| `components/vision/VisionIndicator.tsx`    | Camera icon with status       |
| `components/vision/ObserverVisionFeed.tsx` | Observer-side video display   |

---

## Testing Checkpoints

After each phase, manually verify:

- [ ] **Phase 1:** Console shows vision config in context, persists on refresh
- [ ] **Phase 2:** Camera icon visible on dock, opens modal on click
- [ ] **Phase 3:** Enable vision → video shows in dock instead of SVG
- [ ] **Phase 4:** Full setup flow works, quick toggle works when configured
- [ ] **Phase 5:** Observer sees student's video feed during session
- [ ] **Phase 6:** Edge cases handled gracefully
