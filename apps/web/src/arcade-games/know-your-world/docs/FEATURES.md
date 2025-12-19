# Know Your World - Feature Inventory

This document provides a complete inventory of all features in Know Your World, with references to implementing files and test coverage.

## Feature Categories

1. [Game Modes](#game-modes)
2. [Maps & Regions](#maps--regions)
3. [Precision Controls](#precision-controls)
4. [Assistance Features](#assistance-features)
5. [Multiplayer](#multiplayer)
6. [Audio & Speech](#audio--speech)
7. [Visual Feedback](#visual-feedback)
8. [Accessibility](#accessibility)

---

## Game Modes

### Cooperative Mode

Players work together to find all regions. Any player can click.

| Aspect             | Details                            |
| ------------------ | ---------------------------------- |
| **Implementation** | `Validator.ts:handleClickRegion()` |
| **UI**             | All players share score            |
| **Give Up**        | Requires vote from all sessions    |
| **Tests**          | `Validator.test.ts`                |

### Race Mode

All players compete simultaneously. First click wins the point.

| Aspect             | Details                            |
| ------------------ | ---------------------------------- |
| **Implementation** | `Validator.ts:handleClickRegion()` |
| **Scoring**        | Player who clicks first gets point |
| **Tests**          | `Validator.test.ts`                |

### Turn-Based Mode

Players take turns finding regions.

| Aspect             | Details                                                          |
| ------------------ | ---------------------------------------------------------------- |
| **Implementation** | `Validator.ts:handleClickRegion()`, `Validator.ts:advanceTurn()` |
| **Turn Logic**     | Round-robin through `activePlayers`                              |
| **UI**             | Shows whose turn, disables input for others                      |
| **Tests**          | `Validator.test.ts`                                              |

---

## Maps & Regions

### World Map (256 regions)

| Aspect               | Details                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| **Source**           | `@svg-maps/world`                                                       |
| **Configuration**    | `maps.ts:WORLD_MAP`                                                     |
| **Continents**       | Africa, Asia, Europe, North America, South America, Oceania, Antarctica |
| **Continent Filter** | `continents.ts`, `ContinentSelector.tsx`                                |

### USA Map (51 regions)

| Aspect            | Details           |
| ----------------- | ----------------- |
| **Source**        | `@svg-maps/usa`   |
| **Configuration** | `maps.ts:USA_MAP` |
| **Includes**      | 50 states + DC    |

### Region Size Filtering

Filter regions by size to adjust difficulty:

| Size     | Description            | Implementation            |
| -------- | ---------------------- | ------------------------- |
| `huge`   | Major countries/states | `maps.ts:SIZE_THRESHOLDS` |
| `large`  | Large regions          | `maps.ts:SIZE_THRESHOLDS` |
| `medium` | Medium regions         | `maps.ts:SIZE_THRESHOLDS` |
| `small`  | Small regions          | `maps.ts:SIZE_THRESHOLDS` |
| `tiny`   | Sub-pixel regions      | `maps.ts:SIZE_THRESHOLDS` |

**Files**:

- `maps.ts:getFilteredMapData()`
- `maps.ts:getFilteredMapDataBySizes()`
- `utils/regionSizeUtils.ts`
- `SetupPhase.tsx` (UI)

### Region Detection

Hit testing to determine which region the cursor is over:

| Aspect             | Details                                |
| ------------------ | -------------------------------------- |
| **Primary Method** | Bounding box check + `isPointInFill()` |
| **Hook**           | `hooks/useRegionDetection.ts`          |
| **Usage**          | `MapRenderer.tsx:detectRegion()`       |
| **Tests**          | None (needs coverage)                  |

---

## Precision Controls

### Magnifier System

Zoomed overlay for crowded/tiny regions:

| Aspect            | Details                                       |
| ----------------- | --------------------------------------------- |
| **Hook**          | `hooks/useMagnifierZoom.ts`                   |
| **Algorithm**     | `utils/adaptiveZoomSearch.ts`                 |
| **Dimensions**    | `utils/magnifierDimensions.ts`                |
| **Rendering**     | `MapRenderer.tsx` (magnifier overlay section) |
| **Documentation** | `docs/MAGNIFIER_ARCHITECTURE.md`              |
| **Tests**         | `utils/__tests__/adaptiveZoomSearch.test.ts`  |

Features:

- Adaptive zoom (8x-60x) based on region density
- Spring animations for smooth transitions
- Crosshairs showing exact click point
- Dashed outline on main map showing magnified area

### Pointer Lock (Precision Mode)

Locks cursor for pixel-precise control:

| Aspect         | Details                                      |
| -------------- | -------------------------------------------- |
| **Hook**       | `hooks/usePointerLock.ts`                    |
| **Activation** | Click when magnifier shows threshold message |
| **Cursor**     | Hidden, replaced with crosshair              |
| **Exit**       | Press Escape or click outside map            |

### Cursor Dampening

Slows cursor movement over tiny regions:

| Aspect             | Details                                                                           |
| ------------------ | --------------------------------------------------------------------------------- |
| **Implementation** | `MapRenderer.tsx:handlePointerMove()`                                             |
| **Calculation**    | `utils/screenPixelRatio.ts`                                                       |
| **Capping**        | `utils/zoomCapping.ts`                                                            |
| **Documentation**  | `docs/PRECISION_CONTROLS.md`                                                      |
| **Tests**          | `utils/__tests__/screenPixelRatio.test.ts`, `utils/__tests__/zoomCapping.test.ts` |

### Mobile Touch Support

Touch-based interaction for mobile devices:

| Aspect             | Details                                          |
| ------------------ | ------------------------------------------------ |
| **Detection**      | `hooks/useDeviceCapabilities.ts`                 |
| **Magnifier**      | Drag to position, tap to select                  |
| **Implementation** | `MapRenderer.tsx:handleMapTouchStart/Move/End()` |

---

## Assistance Features

### Assistance Levels

| Level      | Hot/Cold | Hints      | Learning Mode   | Give Up |
| ---------- | -------- | ---------- | --------------- | ------- |
| `learning` | Yes      | Yes + Auto | Yes (type name) | Yes     |
| `guided`   | Yes      | Yes        | No              | Yes     |
| `helpful`  | Yes      | On request | No              | Yes     |
| `standard` | No       | On request | No              | Yes     |
| `none`     | No       | No         | No              | No      |

**Files**:

- `types.ts:AssistanceLevel`
- `utils/guidanceVisibility.ts`
- `Validator.ts:shouldShowFeature()`
- **Tests**: `utils/__tests__/guidanceVisibility.test.ts`

### Hot/Cold Feedback

Audio feedback based on cursor distance to target:

| Aspect            | Details                           |
| ----------------- | --------------------------------- |
| **Hook**          | `hooks/useHotColdFeedback.ts`     |
| **Phrases**       | `utils/hotColdPhrases.ts`         |
| **Speech**        | `utils/speechSynthesis.ts`        |
| **Visualization** | Crosshair rotation, emoji display |

Feedback types:

- `found_it` - Over target region
- `on_fire` / `hot` / `warmer` - Getting closer
- `cold` / `colder` / `freezing` - Getting farther
- `overshot` - Was close, now moving away
- `stuck` - Erratic searching

### Hints

Text hints about the target region:

| Aspect        | Details                              |
| ------------- | ------------------------------------ |
| **Hook**      | `hooks/useRegionHint.ts`             |
| **Content**   | `messages.ts:HINTS`                  |
| **Cycling**   | Shows different hint on each request |
| **Auto-hint** | Triggered after struggle detection   |

### Learning Mode

Type the region name letter by letter:

| Aspect            | Details                                           |
| ----------------- | ------------------------------------------------- |
| **UI**            | `GameInfoPanel.tsx` (letter confirmation section) |
| **Keyboard**      | `components/SimpleLetterKeyboard.tsx`             |
| **Validation**    | `Validator.ts:handleConfirmLetter()`              |
| **Normalization** | Handles accents, case insensitivity               |

### Give Up

Skip current region and reveal its location:

| Aspect             | Details                                           |
| ------------------ | ------------------------------------------------- |
| **Voting**         | Cooperative mode requires all sessions            |
| **Animation**      | Zoom to region, pulse highlight                   |
| **Re-asking**      | Region added back to queue (learning/guided only) |
| **Implementation** | `Validator.ts:handleGiveUp()`                     |
| **Documentation**  | `docs/implementation/give-up.md`                  |

---

## Multiplayer

### Real-time Cursor Sharing

See other players' cursors in real-time:

| Aspect        | Details                                   |
| ------------- | ----------------------------------------- |
| **Provider**  | `Provider.tsx:sendCursorUpdate()`         |
| **Socket**    | `useArcadeSession.ts:sendCursorUpdate()`  |
| **Rendering** | `MapRenderer.tsx` (remote cursor section) |
| **Data**      | SVG coordinates + hovered region ID       |

### Cooperative Give Up Voting

All players must vote to give up in cooperative mode:

| Aspect    | Details                              |
| --------- | ------------------------------------ |
| **State** | `types.ts:giveUpVotes[]`             |
| **UI**    | `GameInfoPanel.tsx` (vote indicator) |
| **Logic** | `Validator.ts:handleGiveUp()`        |

### Player Identification

| Aspect            | Details                      |
| ----------------- | ---------------------------- |
| **Metadata**      | `types.ts:playerMetadata`    |
| **Display**       | Emoji + color per player     |
| **Found regions** | Filled with player's pattern |

---

## Audio & Speech

### Region Name Speech

Speak the target region name:

| Aspect        | Details                                  |
| ------------- | ---------------------------------------- |
| **Hook**      | `hooks/useSpeakHint.ts`                  |
| **Engine**    | `utils/speechSynthesis.ts`               |
| **Languages** | Auto-detects from locale                 |
| **Accents**   | Optional regional accent based on region |

### Hot/Cold Audio

Voice feedback for hot/cold distance:

| Aspect        | Details                                    |
| ------------- | ------------------------------------------ |
| **Hook**      | `hooks/useHotColdFeedback.ts`              |
| **Phrases**   | `utils/hotColdPhrases.ts`                  |
| **Cooldowns** | Prevents spam (1.2s general, 3s same type) |

### Celebration Sounds

Audio on finding a region:

| Aspect             | Details                                             |
| ------------------ | --------------------------------------------------- |
| **Hook**           | `hooks/useCelebrationSound.ts`                      |
| **Types**          | Lightning (fast), Standard, Hard-earned (struggled) |
| **Classification** | `utils/celebration.ts`                              |

### Background Music

Dynamic music that responds to gameplay:

| Aspect            | Details                                                      |
| ----------------- | ------------------------------------------------------------ |
| **Context**       | `music/MusicContext.tsx`                                     |
| **Engine**        | `music/useMusicEngine.ts`                                    |
| **Presets**       | `music/presets/hyperLocal.ts` (region-based)                 |
| **UI**            | `music/MusicControlPanel.tsx`, `music/MusicControlModal.tsx` |
| **Documentation** | `docs/implementation/background-music.md`                    |

---

## Visual Feedback

### Celebration Overlay

Animation when finding a region:

| Aspect            | Details                                 |
| ----------------- | --------------------------------------- |
| **Component**     | `components/CelebrationOverlay.tsx`     |
| **Types**         | Lightning (fast), Standard, Hard-earned |
| **Confetti**      | `components/Confetti.tsx`               |
| **Documentation** | `docs/implementation/celebration.md`    |

### Label Positioning

Smart label placement using D3 force simulation:

| Aspect             | Details                                               |
| ------------------ | ----------------------------------------------------- |
| **Library**        | `d3-force`                                            |
| **Implementation** | `MapRenderer.tsx` (label positioning section)         |
| **Features**       | Collision avoidance, arrow pointers for small regions |

### Excluded Region Visualization

Gray labels for regions not in current game:

| Aspect             | Details                              |
| ------------------ | ------------------------------------ |
| **Implementation** | `MapRenderer.tsx:excludedRegions`    |
| **Purpose**        | Shows which regions are filtered out |

### Give Up Reveal Animation

Zoom and highlight when giving up:

| Aspect             | Details                                |
| ------------------ | -------------------------------------- |
| **Implementation** | `MapRenderer.tsx:giveUpReveal`         |
| **Animation**      | Spring zoom to region, pulse highlight |

### Debug Overlays

Visual debugging (enabled via `?debug=1`):

| Overlay        | Purpose                     |
| -------------- | --------------------------- |
| Bounding boxes | Region detection areas      |
| Safe zones     | Magnifier positioning       |
| Zoom info      | Current magnification level |
| Hot/cold panel | Enable conditions           |

---

## Accessibility

### Screen Reader Support

| Feature              | Implementation     |
| -------------------- | ------------------ |
| Region announcements | Speech synthesis   |
| Letter confirmation  | Keyboard input     |
| Status updates       | ARIA labels (TODO) |

### Keyboard Navigation

| Feature      | Implementation             |
| ------------ | -------------------------- |
| Letter input | `SimpleLetterKeyboard.tsx` |
| Give up      | Button in GameInfoPanel    |
| Hints        | Button in GameInfoPanel    |

### Touch Accessibility

| Feature             | Implementation         |
| ------------------- | ---------------------- |
| Magnifier           | Drag gesture           |
| Region selection    | Tap on magnifier       |
| Large touch targets | Mobile-specific sizing |

---

## Test Coverage Summary

| Area          | Coverage | Files                                |
| ------------- | -------- | ------------------------------------ |
| Validator     | Good     | `Validator.test.ts` (349 lines)      |
| Utils         | Good     | 4 test files (851 lines)             |
| GameInfoPanel | Partial  | `GameInfoPanel.test.tsx` (271 lines) |
| PlayingPhase  | Partial  | `PlayingPhase.test.tsx` (250 lines)  |
| MapRenderer   | None     | Needs tests                          |
| Hooks         | None     | Needs tests                          |

---

## Configuration Options

### Game Config (persisted)

```typescript
interface KnowYourWorldConfig {
  selectedMap: "world" | "usa";
  gameMode: "cooperative" | "race" | "turn-based";
  includeSizes: RegionSize[];
  assistanceLevel: AssistanceLevel;
  selectedContinent: ContinentId | "all"; // world map only
}
```

### Runtime Options

| Option           | Type    | Default | Description                     |
| ---------------- | ------- | ------- | ------------------------------- |
| `hotColdEnabled` | boolean | varies  | User toggle for hot/cold        |
| `autoSpeak`      | boolean | false   | Auto-speak region names         |
| `withAccent`     | boolean | false   | Use regional accents            |
| `autoHint`       | boolean | varies  | Auto-show hints when struggling |

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
- [PATTERNS.md](./PATTERNS.md) - Code patterns
- [MAGNIFIER_ARCHITECTURE.md](./MAGNIFIER_ARCHITECTURE.md) - Zoom system
- [PRECISION_CONTROLS.md](./PRECISION_CONTROLS.md) - Cursor dampening
- [implementation/](./implementation/) - Implementation details
