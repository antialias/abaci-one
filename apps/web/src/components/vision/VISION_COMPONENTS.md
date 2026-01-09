# Vision Components - Required Wiring

**READ THIS before creating or modifying any component that uses abacus vision/camera.**

## The Pattern That Works

When using `CameraCapture` for local camera with marker detection:

```typescript
<CameraCapture
  initialSource="local"
  onCapture={handleCapture}
  onSourceChange={setCameraSource}
  onPhoneConnected={setIsPhoneConnected}
  enableMarkerDetection        // ← REQUIRED for marker detection
  columnCount={columnCount}    // ← REQUIRED for calibration grid
  onCalibrationChange={setCalibration}  // ← REQUIRED to receive calibration
  showRectifiedView            // ← REQUIRED to show perspective-corrected view
/>
```

**All four props are required for the full pipeline to work:**

1. `enableMarkerDetection` - Enables ArUco marker detection
2. `columnCount` - Tells the calibration how many columns to expect
3. `onCalibrationChange` - Receives the calibration when markers are detected
4. `showRectifiedView` - Shows the perspective-corrected view (requires calibration)

## How It Works Internally

```
CameraCapture
  └── useMarkerDetection (needs videoElement state)
        └── detects ArUco markers
        └── creates CalibrationGrid with corners
  └── VisionCameraFeed
        └── renders video element
        └── calls videoRef callback → sets videoElement state
        └── when calibration exists + showRectifiedView:
              └── loads OpenCV
              └── runs perspective transform loop
              └── displays rectified canvas
```

## Critical Implementation Detail

`VisionCameraFeed` has an early return when there's no `videoStream`:

```typescript
if (!videoStream) {
  return <div>No camera feed</div>  // Video element NOT rendered here!
}
```

This means the video element only exists AFTER the stream is acquired. The effect that passes the video ref to the parent must re-run when `videoStream` changes:

```typescript
// In VisionCameraFeed - THIS IS CRITICAL
useEffect(() => {
  if (externalVideoRef) {
    externalVideoRef(internalVideoRef.current);
  }
}, [externalVideoRef, videoStream]); // ← videoStream dependency is essential!
```

Without `videoStream` in the dependency array, the parent's `videoElement` state stays `null`, marker detection never gets a video to analyze, and the rectified view never appears.

## Checklist for New Vision Components

Before saying a vision component is "done":

- [ ] Does it pass `enableMarkerDetection` to CameraCapture?
- [ ] Does it pass `columnCount` to CameraCapture?
- [ ] Does it pass `onCalibrationChange` and store the result?
- [ ] Does it pass `showRectifiedView` if perspective correction is needed?
- [ ] **TEST IT**: Point camera at markers - do you see the green quadrilateral overlay?
- [ ] **TEST IT**: When 4/4 markers detected, does the view switch to rectified?

## Common Mistakes

1. **Forgetting `showRectifiedView`** - Markers detect but view stays raw
2. **Forgetting `onCalibrationChange`** - Can't use calibration for inference
3. **Using `processImageFrame` expecting perspective correction** - It only does ROI extraction, not perspective transform. Use `processVideoFrame` for video with perspective correction.
4. **Creating a new component instead of using CameraCapture** - CameraCapture handles all the wiring. If you bypass it, you need to replicate all the wiring manually (see DockedVisionFeed for an example).

## Two Valid Patterns

### Pattern 1: Use CameraCapture (Recommended)

CameraCapture handles marker detection internally. Just pass the right props.

### Pattern 2: Direct VisionCameraFeed + useMarkerDetection

If you need more control (like DockedVisionFeed), you must:

1. Call `useMarkerDetection` yourself with `videoElement` state
2. Pass a `videoRef` callback that updates `videoElement` state
3. Pass the resulting `calibration` to VisionCameraFeed
4. Handle the `showRectifiedView` logic yourself

```typescript
const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)

const { calibration } = useMarkerDetection({
  enabled: true,
  videoElement,  // ← Must be state, not just a ref
  columnCount,
  onCalibrationChange: handleCalibration,
})

<VisionCameraFeed
  videoStream={stream}
  calibration={calibration}
  showRectifiedView={calibration !== null}
  videoRef={(el) => {
    videoRef.current = el
    setVideoElement(el)  // ← Critical: update state so hook re-runs
  }}
/>
```
