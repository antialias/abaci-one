# Worksheet Grading UX/UI Plan

## Overview

This document describes the complete user experience and interface design for AI-powered worksheet grading with camera upload and QR code scanning.

## User Roles

1. **Teacher (Desktop)** - Creates/grades worksheets on computer
2. **Teacher (Mobile)** - Uses smartphone as camera for batch upload
3. **Student** - Sees grading results and progression feedback (future phase)

## User Journey Map

### Journey 1: Teacher Uploads Single Worksheet (Desktop)

```
1. [Teacher] Opens worksheet generator page
2. [Teacher] Clicks "Upload Completed Worksheet" button
3. [System] Shows upload modal with 3 options
4. [Teacher] Chooses upload method:
   - Option A: Drag & drop image file
   - Option B: Click to browse files
   - Option C: Use webcam to capture photo
5. [System] Uploads image → shows "Grading..." spinner
6. [System] GPT-5 analyzes worksheet (30-60 seconds)
7. [Teacher] Sees results page with:
   - Score (17/20 = 85%)
   - Problem-by-problem breakdown
   - Error pattern analysis
   - Progression recommendation
   - "Generate Practice Worksheet" button
```

**Time**: 1-2 minutes per worksheet

### Journey 2: Teacher Batch Uploads with Phone (QR Code)

```
1. [Teacher] Opens worksheet generator on desktop
2. [Teacher] Clicks "Upload Completed Worksheet"
3. [Teacher] Selects "Scan with Phone" tab
4. [System] Generates QR code instantly
5. [Teacher] Scans QR with smartphone camera
6. [Phone] Opens camera page immediately (no navigation)
7. [Teacher] Takes photo of worksheet #1 → auto-uploads
8. [System] Shows "Uploaded 1/5" on desktop in real-time
9. [Teacher] Takes photo of worksheet #2 → auto-uploads
10. [System] Shows "Uploaded 2/5"
11. ... repeats for all 5 worksheets
12. [Teacher] Returns to desktop
13. [System] Shows all 5 worksheets grading in parallel
14. [Teacher] Views results for each student
```

**Time**: 2-3 minutes for 5 worksheets

### Journey 3: Viewing Results

```
1. [Teacher] Clicks on graded worksheet
2. [System] Shows results page:
   - Header: Score card with percentage
   - Section 1: AI Feedback summary
   - Section 2: Problem-by-problem grid
   - Section 3: Error patterns (visual tags)
   - Section 4: Progression recommendation
   - Footer: Action buttons
3. [Teacher] Clicks "Generate Practice Worksheet"
4. [System] Pre-fills worksheet config for recommended step
5. [Teacher] Generates PDF → prints for student
```

## UI Components Breakdown

### 1. Upload Modal (`UploadWorksheetModal`)

**Layout**: Modal dialog, 600px wide, centered

**3 Tabs**:

- 📁 File Upload
- 📷 Camera Capture
- 📱 Scan with Phone

#### Tab 1: File Upload

```
┌─────────────────────────────────────────┐
│  Upload Completed Worksheet        [X]  │
├─────────────────────────────────────────┤
│ [File] [Camera] [QR Code]               │
├─────────────────────────────────────────┤
│                                         │
│   ┌───────────────────────────────┐   │
│   │                               │   │
│   │   Drop worksheet image here   │   │
│   │         or click to browse    │   │
│   │                               │   │
│   │   Supports: JPG, PNG, HEIC    │   │
│   │   Max size: 10MB              │   │
│   │                               │   │
│   └───────────────────────────────┘   │
│                                         │
│   [Choose File]                         │
│                                         │
└─────────────────────────────────────────┘
```

**States**:

- Empty: Dashed border, upload icon
- Hover: Blue highlight
- Drag-over: Solid blue border
- File selected: Show preview thumbnail
- Uploading: Progress bar
- Error: Red border with error message

#### Tab 2: Camera Capture

```
┌─────────────────────────────────────────┐
│  Upload Completed Worksheet        [X]  │
├─────────────────────────────────────────┤
│ [File] [Camera] [QR Code]               │
├─────────────────────────────────────────┤
│                                         │
│   ┌───────────────────────────────┐   │
│   │                               │   │
│   │   [Live camera feed video]    │   │
│   │                               │   │
│   │                               │   │
│   └───────────────────────────────┘   │
│                                         │
│        [⚫ Capture Photo]                │
│                                         │
│   💡 Position worksheet flat           │
│      Ensure good lighting              │
│                                         │
└─────────────────────────────────────────┘
```

**Features**:

- Auto-request camera permission on tab switch
- Show preview of captured image before upload
- Retake button if image is blurry
- Auto-crop suggestions (future)

#### Tab 3: Scan with Phone

```
┌─────────────────────────────────────────┐
│  Upload Completed Worksheet        [X]  │
├─────────────────────────────────────────┤
│ [File] [Camera] [QR Code]               │
├─────────────────────────────────────────┤
│                                         │
│   Scan this code with your phone:      │
│                                         │
│         ┌─────────────┐                │
│         │             │                │
│         │  [QR Code]  │                │
│         │             │                │
│         └─────────────┘                │
│                                         │
│   Worksheets uploaded: 3                │
│   ┌───────────────────────────────┐   │
│   │ ✓ Worksheet 1 - Grading...    │   │
│   │ ✓ Worksheet 2 - Grading...    │   │
│   │ ✓ Worksheet 3 - Grading...    │   │
│   └───────────────────────────────┘   │
│                                         │
│   [View Results]                        │
│                                         │
└─────────────────────────────────────────┘
```

**Features**:

- QR code generates on tab open
- Real-time list updates as photos upload
- Each item shows grading status
- Click item to view results
- Session expires in 1 hour

### 2. Smartphone Camera Page (`/upload/[sessionId]/camera`)

**Mobile-optimized, full-screen**

```
┌─────────────────────┐
│ Upload Worksheets   │
├─────────────────────┤
│                     │
│  Photos: 3          │
│                     │
│ ┌─────────────────┐ │
│ │                 │ │
│ │  [Camera feed]  │ │
│ │                 │ │
│ │                 │ │
│ │                 │ │
│ │                 │ │
│ └─────────────────┘ │
│                     │
│   [⚫ Capture]       │
│                     │
│ ✓ Uploaded!         │
│ Tap to take another │
│                     │
└─────────────────────┘
```

**Features**:

- Auto-open camera on page load
- Big capture button (easy to tap)
- Success animation after upload
- Upload count badge
- Back camera by default
- Auto-focus and auto-exposure
- Portrait orientation lock

**States**:

- Loading: "Opening camera..."
- Ready: "Tap to capture"
- Capturing: Brief flash animation
- Uploading: Spinner overlay
- Success: Green checkmark + count
- Error: Red banner with retry button

### 3. Grading Progress View

Shows while GPT-5 is analyzing:

```
┌─────────────────────────────────────────┐
│  Grading Worksheet...                   │
├─────────────────────────────────────────┤
│                                         │
│   [Animated spinner]                    │
│                                         │
│   AI is analyzing the worksheet         │
│   This usually takes 30-60 seconds      │
│                                         │
│   ━━━━━━━━━━━━━━━━━━━━━━━━ 45%        │
│                                         │
│   Steps completed:                      │
│   ✓ Image uploaded                      │
│   ✓ Reading handwriting                 │
│   ⏳ Grading problems...                │
│   ⏳ Analyzing error patterns           │
│   ⏳ Recommending next step             │
│                                         │
└─────────────────────────────────────────┘
```

**Features**:

- Progress bar (estimated)
- Step-by-step status
- Can navigate away (polling continues)
- Notification when complete

### 4. Results Page (`/worksheets/attempts/[attemptId]`)

**Layout**: Full page, scrollable

#### Header Section

```
┌───────────────────────────────────────────────┐
│  ← Back to Worksheets                         │
├───────────────────────────────────────────────┤
│                                               │
│   📊 Worksheet Results                        │
│   Uploaded: Jan 15, 2025 at 2:34 PM          │
│                                               │
│   ┌─────────────────────────────────────┐   │
│   │         17/20 Correct                │   │
│   │                                       │   │
│   │           85%                         │   │
│   │      ━━━━━━━━━━━━━━━━━ 85%          │   │
│   │                                       │   │
│   │   Great work! Almost there!          │   │
│   └─────────────────────────────────────┘   │
│                                               │
└───────────────────────────────────────────────┘
```

**Features**:

- Big score display
- Color-coded (green if >90%, yellow if >70%, else orange)
- Encouraging message
- Visual progress bar

#### AI Feedback Section

```
┌───────────────────────────────────────────────┐
│  🤖 AI Analysis                               │
├───────────────────────────────────────────────┤
│                                               │
│  Student shows good understanding but         │
│  struggles with carrying in tens place on     │
│  2-digit problems. Recommend returning to     │
│  full scaffolding at 2-digit level.           │
│                                               │
│  Error Patterns Detected:                     │
│  🏷️ Carrying in tens place                   │
│  🏷️ Alignment                                 │
│                                               │
└───────────────────────────────────────────────┘
```

**Features**:

- Natural language summary
- Error pattern tags (visual chips)
- Specific, actionable

#### Problem Breakdown Grid

```
┌───────────────────────────────────────────────┐
│  Problem-by-Problem Results                   │
├───────────────────────────────────────────────┤
│                                               │
│  ┌────┬──────────┬─────────┬────────────┐   │
│  │ #  │ Problem  │ Student │ Correct?   │   │
│  ├────┼──────────┼─────────┼────────────┤   │
│  │ 1  │ 45 + 27  │   72    │  ✓         │   │
│  │ 2  │ 68 + 45  │  103    │  ✗ (113)   │   │
│  │ 3  │ 23 + 56  │   79    │  ✓         │   │
│  │ 4  │ 91 + 38  │  119    │  ✗ (129)   │   │
│  └────┴──────────┴─────────┴────────────┘   │
│                                               │
│  Show all 20 ▼                                │
│                                               │
└───────────────────────────────────────────────┘
```

**Features**:

- Collapsible (first 5 visible, expand for all)
- Color-coded rows (green=correct, red=wrong)
- Shows correct answer for wrong problems
- Click row to see problem details
- Error type tag on wrong answers

#### Progression Recommendation Section

```
┌───────────────────────────────────────────────┐
│  📈 Next Steps                                │
├───────────────────────────────────────────────┤
│                                               │
│  Recommended Practice:                        │
│  2-Digit Single Carry (Full Scaffolding)      │
│                                               │
│  This step includes:                          │
│  • Visual ten-frames for carrying            │
│  • Carry boxes to track regrouping           │
│  • 2-digit problems with single carry        │
│                                               │
│  [Generate Practice Worksheet]                │
│                                               │
│  Current Progression:                         │
│  ●─●─●─◉─○─○  (Step 4 of 6)                 │
│                                               │
└───────────────────────────────────────────────┘
```

**Features**:

- Clear recommendation
- Explains what the step includes
- One-click worksheet generation
- Visual progression path
- Shows mastery status for each step

### 5. Worksheet History Dashboard

**New page**: `/worksheets/history`

```
┌───────────────────────────────────────────────┐
│  Worksheet History                            │
├───────────────────────────────────────────────┤
│                                               │
│  Filter: [All Students ▼] [Last 30 days ▼]   │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ Jan 15, 2025 - Student A                │ │
│  │ 17/20 (85%) - 2-digit carrying           │ │
│  │ Recommended: single-carry-2d-full        │ │
│  │ [View Results]                           │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ Jan 14, 2025 - Student B                │ │
│  │ 19/20 (95%) - 3-digit carrying           │ │
│  │ Recommended: single-carry-3d-minimal     │ │
│  │ [View Results]                           │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  [Load More]                                  │
│                                               │
└───────────────────────────────────────────────┘
```

**Features**:

- Chronological list
- Filter by student/date
- Quick stats per attempt
- Click to view full results
- Export to CSV (future)

## Design System

### Colors

**Light Mode**:

- Primary: Blue (#3B82F6)
- Success: Green (#10B981)
- Warning: Yellow/Orange (#F59E0B)
- Error: Red (#EF4444)
- Background: White (#FFFFFF)
- Surface: Light Gray (#F9FAFB)
- Text: Dark Gray (#111827)

**Dark Mode**:

- Primary: Light Blue (#60A5FA)
- Success: Light Green (#34D399)
- Warning: Light Orange (#FBBF24)
- Error: Light Red (#F87171)
- Background: Dark Gray (#111827)
- Surface: Darker Gray (#1F2937)
- Text: White (#F9FAFB)

### Typography

- **Headings**: Font weight 700, size 24px-32px
- **Body**: Font weight 400, size 16px
- **Labels**: Font weight 500, size 14px
- **Captions**: Font weight 400, size 12px, muted color

### Spacing

- Page padding: 24px
- Section spacing: 32px
- Element spacing: 16px
- Compact spacing: 8px

### Animations

- **Modal open**: Fade + scale from 95% to 100% (200ms)
- **Upload success**: Green checkmark with bounce (300ms)
- **Progress spinner**: Smooth rotation
- **Tab switch**: Slide transition (150ms)
- **Camera flash**: White overlay fade (100ms)

## Responsive Breakpoints

- **Mobile**: < 640px (single column, full-width)
- **Tablet**: 640px - 1024px (max-width 768px content)
- **Desktop**: > 1024px (max-width 1200px content)

### Mobile Adaptations

**Upload Modal**:

- Full-screen on mobile
- Camera button larger
- Simplified layout

**Results Page**:

- Stack sections vertically
- Larger touch targets
- Collapsible sections default collapsed

**Camera Page**:

- Always full-screen
- Portrait lock
- Large capture button

## Accessibility

### WCAG 2.1 AA Compliance

**Keyboard Navigation**:

- Tab through all interactive elements
- Enter/Space to activate buttons
- Escape to close modals

**Screen Readers**:

- Proper ARIA labels on all inputs
- Status announcements for upload progress
- Alt text on all images
- Semantic HTML structure

**Visual**:

- Color contrast ratio ≥ 4.5:1
- Focus indicators on all interactive elements
- No color-only indicators (icons + text)

**Touch Targets**:

- Minimum 44×44px on mobile
- Adequate spacing between targets

## Error States

### Upload Errors

```
┌─────────────────────────────────────────┐
│  ⚠️ Upload Failed                        │
├─────────────────────────────────────────┤
│                                         │
│  The image couldn't be uploaded.        │
│                                         │
│  Possible reasons:                      │
│  • File too large (max 10MB)            │
│  • Invalid file type                    │
│  • Network connection lost              │
│                                         │
│  [Try Again]                            │
│                                         │
└─────────────────────────────────────────┘
```

### Grading Errors

```
┌─────────────────────────────────────────┐
│  ⚠️ Grading Failed                       │
├─────────────────────────────────────────┤
│                                         │
│  The worksheet couldn't be graded.      │
│                                         │
│  The image might be:                    │
│  • Too blurry to read                   │
│  • Not a math worksheet                 │
│  • Missing problems                     │
│                                         │
│  [Upload Different Image]               │
│  [Contact Support]                      │
│                                         │
└─────────────────────────────────────────┘
```

### Camera Errors

```
┌─────────────────────────────────────────┐
│  📷 Camera Access Denied                 │
├─────────────────────────────────────────┤
│                                         │
│  Please allow camera access to          │
│  capture photos.                        │
│                                         │
│  How to enable:                         │
│  1. Open Settings                       │
│  2. Go to Privacy → Camera              │
│  3. Enable for this website             │
│                                         │
│  [Use File Upload Instead]              │
│                                         │
└─────────────────────────────────────────┘
```

## Loading States

- **Upload**: Linear progress bar (0-100%)
- **Grading**: Spinner + status text + estimated time
- **Results**: Skeleton screens for each section
- **Camera**: "Opening camera..." message

## Success States

- **Upload success**: Green checkmark + "Uploaded!"
- **Grading complete**: Confetti animation (subtle)
- **Worksheet generated**: "Ready to print!"

## Empty States

### No Worksheets Yet

```
┌─────────────────────────────────────────┐
│                                         │
│         [Empty folder icon]             │
│                                         │
│    No worksheets graded yet             │
│                                         │
│    Upload a completed worksheet to      │
│    see AI-powered grading and          │
│    progression recommendations.         │
│                                         │
│    [Upload Worksheet]                   │
│                                         │
└─────────────────────────────────────────┘
```

## Future Enhancements

### Phase 2:

- Student-facing results view
- Parent email reports
- Batch grading improvements
- Auto-rotate images
- Confidence scores on OCR

### Phase 3:

- Real-time collaboration (multiple teachers)
- Student progress charts
- Comparison with class average
- Export to Google Classroom
- Print-friendly report cards

## Implementation Checklist

- [ ] UploadWorksheetModal component
- [ ] CameraCapture component
- [ ] QRCodeDisplay component
- [ ] Smartphone camera page
- [ ] Results page layout
- [ ] Problem breakdown table
- [ ] Progression visualization
- [ ] Loading/error states
- [ ] Mobile responsiveness
- [ ] Dark mode support
- [ ] Accessibility testing
- [ ] User testing with teachers
