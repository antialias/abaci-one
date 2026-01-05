# SummaryClient.tsx Refactoring Plan

## Current State

**File:** `src/app/practice/[studentId]/summary/SummaryClient.tsx`
**Lines:** 1047
**Responsibilities:** 7+ distinct concerns mixed together

## Problem Analysis

### State Sprawl (15+ useState calls)

```typescript
// Session state (keep in SummaryClient)
const [showStartPracticeModal, setShowStartPracticeModal] = useState(false)

// Photo viewer state (extract to usePhotoViewer)
const [viewerOpen, setViewerOpen] = useState(false)
const [viewerIndex, setViewerIndex] = useState(0)
const [viewerMode, setViewerMode] = useState<'view' | 'edit' | 'review'>('view')

// Photo upload state (extract to usePhotoManagement)
const [showCamera, setShowCamera] = useState(false)
const [dragOver, setDragOver] = useState(false)
const [isUploading, setIsUploading] = useState(false)
const [uploadError, setUploadError] = useState<string | null>(null)
const [deletingId, setDeletingId] = useState<string | null>(null)

// Document adjustment state (extract to usePhotoManagement)
const [fileQueue, setFileQueue] = useState<File[]>([])
const [uploadAdjustmentState, setUploadAdjustmentState] = useState<{...} | null>(null)
```

### Callback Sprawl (~15 callbacks)

**Photo Management (10 callbacks to extract):**
- `uploadPhotos`
- `processNextFile`
- `handleUploadAdjustmentConfirm`
- `handleUploadAdjustmentSkip`
- `handleUploadAdjustmentCancel`
- `handlePhotoEditConfirm`
- `handleFileSelect`
- `handleDrop`
- `handleDragOver/Leave`
- `handleCameraCapture`
- `deletePhoto`

**Photo Viewer (1 callback to extract):**
- `openViewer`

### Mutation State Derivation Pattern (repeated 6x)

```typescript
// This pattern appears 6 times with slight variations
parsingId={
  startParsing.isPending
    ? typeof startParsing.variables === 'string'
      ? startParsing.variables
      : ((startParsing.variables as { attachmentId: string } | undefined)?.attachmentId ?? null)
    : null
}
```

---

## Refactoring Strategy

### Phase 1: Extract Type Definitions

**Create:** `src/types/attachments.ts`

```typescript
import type { ParsingStatus } from '@/db/schema/practice-attachments'

export interface SessionAttachmentResponse {
  id: string
  url: string
  originalUrl: string | null
  corners: Array<{ x: number; y: number }> | null
  rotation: 0 | 90 | 180 | 270
  parsingStatus: string | null
  parsedAt: string | null
  parsingError: string | null
  rawParsingResult: object | null
  approvedResult: object | null
  confidenceScore: number | null
  needsReview: boolean
  sessionCreated: boolean
  createdSessionId: string | null
  reviewProgress: object | null
  llm: {
    provider: string | null
    model: string | null
    promptUsed: string | null
    rawResponse: string | null
    jsonSchema: string | null
    imageSource: string | null
    attempts: number | null
    usage: {
      promptTokens: number | null
      completionTokens: number | null
      totalTokens: number | null
    }
  } | null
}
```

### Phase 2: Extract usePhotoManagement Hook

**Create:** `src/hooks/usePhotoManagement.ts`

This hook consolidates all photo upload, deletion, and adjustment logic.

**State it manages:**
- `showCamera`
- `dragOver`
- `isUploading`
- `uploadError`
- `deletingId`
- `fileQueue`
- `uploadAdjustmentState`

**Callbacks it provides:**
- `uploadPhotos(photos, originals?, corners?, rotations?)`
- `deletePhoto(attachmentId)`
- `handleFileSelect(event)`
- `handleDrop(event)`
- `handleDragOver(event)`
- `handleDragLeave()`
- `openCamera()`
- `closeCamera()`
- `handleCameraCapture(cropped, original, corners, rotation)`
- `handleAdjustmentConfirm(cropped, corners, rotation)`
- `handleAdjustmentSkip()`
- `handleAdjustmentCancel()`

**Interface:**

```typescript
interface UsePhotoManagementOptions {
  studentId: string
  sessionId: string | undefined
  onError?: (message: string) => void
}

interface UsePhotoManagementReturn {
  // Camera state
  showCamera: boolean
  openCamera: () => void
  closeCamera: () => void
  handleCameraCapture: (cropped: File, original: File, corners: Corner[], rotation: Rotation) => void

  // Drag-drop state
  dragOver: boolean
  handleDrop: (e: React.DragEvent) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: () => void

  // File input
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void

  // Upload state
  isUploading: boolean
  uploadError: string | null

  // Delete state
  deletingId: string | null
  deletePhoto: (attachmentId: string) => Promise<void>

  // Document adjustment modal state
  adjustmentState: AdjustmentState | null
  handleAdjustmentConfirm: (cropped: File, corners: Corner[], rotation: Rotation) => Promise<void>
  handleAdjustmentSkip: () => Promise<void>
  handleAdjustmentCancel: () => void
  queueLength: number  // For showing "1 of N" in modal

  // OpenCV reference (needed by DocumentAdjuster)
  opencvRef: typeof cv | null
  detectQuadsInImage: (canvas: HTMLCanvasElement) => QuadResult
}
```

### Phase 3: Extract usePhotoViewer Hook

**Create:** `src/hooks/usePhotoViewer.ts`

Simpler hook for managing the photo viewer modal state.

```typescript
interface UsePhotoViewerReturn {
  isOpen: boolean
  index: number
  mode: 'view' | 'edit' | 'review'
  open: (index: number, mode?: 'view' | 'edit' | 'review') => void
  close: () => void
  setMode: (mode: 'view' | 'edit' | 'review') => void
}

export function usePhotoViewer(): UsePhotoViewerReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<'view' | 'edit' | 'review'>('view')

  const open = useCallback((idx: number, m: 'view' | 'edit' | 'review' = 'view') => {
    setIndex(idx)
    setMode(m)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  return { isOpen, index, mode, open, close, setMode }
}
```

### Phase 4: Extract Modal Components

**Create:** `src/components/practice/CameraModal.tsx`

```typescript
interface CameraModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (cropped: File, original: File, corners: Corner[], rotation: Rotation) => void
}
```

**Create:** `src/components/practice/DocumentAdjustmentModal.tsx`

```typescript
interface DocumentAdjustmentModalProps {
  state: AdjustmentState | null
  queueLength: number
  opencvRef: typeof cv | null
  detectQuadsInImage: (canvas: HTMLCanvasElement) => QuadResult
  onConfirm: (cropped: File, corners: Corner[], rotation: Rotation) => Promise<void>
  onSkip: () => Promise<void>
  onCancel: () => void
}
```

### Phase 5: Create Mutation State Helper

**Add to:** `src/hooks/useWorksheetParsing.ts`

```typescript
/**
 * Helper to extract the pending attachment ID from a mutation
 * Handles both string and object variable types
 */
export function getPendingAttachmentId(
  mutation: UseMutationResult<unknown, unknown, string | { attachmentId: string }, unknown>
): string | null {
  if (!mutation.isPending) return null
  const vars = mutation.variables
  if (typeof vars === 'string') return vars
  return (vars as { attachmentId: string } | undefined)?.attachmentId ?? null
}
```

Then in SummaryClient:

```typescript
// Before (repeated 6x):
parsingId={
  startParsing.isPending
    ? typeof startParsing.variables === 'string'
      ? startParsing.variables
      : ((startParsing.variables as { attachmentId: string } | undefined)?.attachmentId ?? null)
    : null
}

// After:
parsingId={getPendingAttachmentId(startParsing)}
```

---

## Refactored SummaryClient Structure

After all phases:

```typescript
// ~400-500 lines instead of 1047

export function SummaryClient({ studentId, player, session, ... }: SummaryClientProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { showSuccess, showError } = useToast()
  const router = useRouter()

  // Single UI state for this page
  const [showStartPracticeModal, setShowStartPracticeModal] = useState(false)

  // Consolidated hooks
  const photoManagement = usePhotoManagement({ studentId, sessionId: session?.id })
  const photoViewer = usePhotoViewer()
  const { data: sessionMode } = useSessionMode(studentId)
  const { data: playerAccess } = usePlayerAccess(studentId)

  // Query for attachments
  const { data: attachmentsData } = useQuery({ ... })

  // Worksheet parsing mutations (already extracted)
  const startParsing = useStartParsing(studentId, session?.id ?? '')
  const approveAndCreateSession = useApproveAndCreateSession(...)
  // ...other mutations

  // Derived data (unchanged)
  const skillMasteries = useMemo(() => ..., [problemHistory])
  const autoPauseInfo = useMemo(() => ..., [sessionResults])
  const problemsNeedingAttention = useMemo(() => ..., [session, autoPauseInfo])

  // Single callback for photo edit (delegates to mutation)
  const handlePhotoEditConfirm = useCallback(async (photoId, cropped, corners, rotation) => {
    // ... minimal wrapper around API call
  }, [studentId, session?.id, queryClient])

  return (
    <SessionModeBannerProvider ...>
      <PageWithNav>
        <PracticeSubNav ... />
        <main>
          {/* Main content grid - unchanged */}
          <OfflineWorkSection
            {...photoManagement.sectionProps}
            onOpenViewer={photoViewer.open}
            parsingId={getPendingAttachmentId(startParsing)}
            // ...other props
          />
          {/* ... */}
        </main>

        {/* Modals - now separate components */}
        <StartPracticeModal ... />
        <PhotoViewerEditor
          isOpen={photoViewer.isOpen}
          initialIndex={photoViewer.index}
          initialMode={photoViewer.mode}
          onClose={photoViewer.close}
          ...
        />
        <CameraModal
          isOpen={photoManagement.showCamera}
          onClose={photoManagement.closeCamera}
          onCapture={photoManagement.handleCameraCapture}
        />
        <DocumentAdjustmentModal
          state={photoManagement.adjustmentState}
          queueLength={photoManagement.queueLength}
          ...
        />
      </PageWithNav>
    </SessionModeBannerProvider>
  )
}
```

---

## Implementation Order

1. **Phase 1: Type extraction** (~15 min)
   - Create `src/types/attachments.ts`
   - Move `SessionAttachmentResponse` there
   - Update imports

2. **Phase 2: usePhotoManagement hook** (~1 hour)
   - Create hook file
   - Move all photo-related state and callbacks
   - Update SummaryClient to use hook
   - Test file uploads, camera, drag-drop

3. **Phase 3: usePhotoViewer hook** (~15 min)
   - Create simple hook
   - Update SummaryClient
   - Test viewer open/close

4. **Phase 4: Modal components** (~30 min)
   - Extract CameraModal
   - Extract DocumentAdjustmentModal
   - Update SummaryClient imports

5. **Phase 5: Mutation helper** (~15 min)
   - Add `getPendingAttachmentId` helper
   - Replace 6 occurrences of the pattern

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Lines in SummaryClient | 1047 | ~450 |
| useState calls | 15 | 2 |
| useCallback functions | 15 | 2-3 |
| Concerns mixed | 7 | 2-3 |
| Inline types | 1 | 0 |
| Modal JSX inline | 2 | 0 |

---

## Testing Checklist

After each phase, verify:

- [ ] File upload (drag-drop) works
- [ ] File upload (click to select) works
- [ ] Camera capture works
- [ ] Document adjustment modal works
- [ ] Photo viewer opens in correct mode
- [ ] Photo editing saves correctly
- [ ] Worksheet parsing triggers
- [ ] Approval flow works
- [ ] TypeScript passes (`npm run type-check`)
- [ ] No console errors
