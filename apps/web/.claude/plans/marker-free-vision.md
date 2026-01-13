# Marker-Free Abacus Vision

## Goal

Train a neural network to detect the abacus boundary (quadrilateral corners) without requiring ArUco markers. This provides a third calibration mode alongside:

1. **Auto (Markers)** - Current ArUco-based detection
2. **Manual** - User drags corners
3. **Marker-Free (ML)** - NEW: Neural network detects abacus boundary

## The Marker Learning Problem

**Concern**: If we train on frames that include markers, the NN will learn to detect markers rather than the abacus outline.

**Solutions** (in order of preference):

### Option A: Marker Inpainting (Recommended)

Use OpenCV's inpainting to fill marker regions with surrounding texture:

```python
# For each marker region
mask = create_marker_mask(corners, padding=10)
inpainted = cv2.inpaint(frame, mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
```

- **Pros**: Seamless removal, preserves abacus structure
- **Cons**: Requires OpenCV, slightly slower

### Option B: Marker Blurring

Apply strong Gaussian blur to marker regions:

```python
for marker in markers:
    roi = frame[marker_region]
    frame[marker_region] = cv2.GaussianBlur(roi, (31, 31), 0)
```

- **Pros**: Fast, simple
- **Cons**: Visible blur spots, NN might learn "blur = corner"

### Option C: Solid Color Fill

Replace marker regions with average background color:

```python
for marker in markers:
    avg_color = np.mean(surrounding_pixels, axis=0)
    frame[marker_region] = avg_color
```

- **Pros**: Very fast
- **Cons**: Visible patches, unnatural

### Option D: Corner Crop (Not Recommended)

Crop slightly inside the markers to exclude them entirely.

- **Cons**: Loses valuable edge context the NN needs to learn

**Recommendation**: Use **Option A (Inpainting)** for training data, with fallback to **Option B (Blurring)** for simplicity.

---

## Architecture

### Model Design

**Input**: 224×224 RGB image (resized from camera frame)

**Output**: 8 values (4 corners × 2 coordinates)

- Normalized to [0, 1] range (relative to image dimensions)
- Order: `[tl_x, tl_y, tr_x, tr_y, br_x, br_y, bl_x, bl_y]`

**Architecture** (transfer learning):

```
MobileNetV2 (pretrained, frozen initially)
  ↓
GlobalAveragePooling2D
  ↓
Dense(256, activation='relu')
Dropout(0.3)
  ↓
Dense(128, activation='relu')
Dropout(0.2)
  ↓
Dense(8, activation='sigmoid')  # Corner coordinates [0,1]
```

**Why MobileNetV2**:

- Small enough for real-time inference in browser (TF.js)
- Pretrained features excellent for edge/shape detection
- ~3MB model size

**Loss Function**: MSE on corner coordinates

```python
loss = mean((predicted_corners - true_corners)^2)
```

**Metrics**:

- Mean corner distance (pixels)
- IoU of predicted vs true quadrilateral

---

## Training Data Collection

### Source

Any frame where `markerDetection.allMarkersFound === true`:

- Ground truth corners come from marker detection
- Already have this data flowing through the system

### Collection Flow

```
Camera Frame
  ↓
detectMarkers() → allMarkersFound=true
  ↓
Extract quadCorners (ground truth labels)
  ↓
Mask/inpaint marker regions
  ↓
Save:
  - frame_XXXX.jpg (processed frame, markers removed)
  - frame_XXXX.json (corner coordinates, original dimensions)
```

### Storage Format

```
data/vision-training/abacus-boundary/
├── frames/
│   ├── frame_0001.jpg
│   ├── frame_0002.jpg
│   └── ...
├── labels/
│   ├── frame_0001.json
│   ├── frame_0002.json
│   └── ...
└── metadata.json
```

**Label format** (`frame_XXXX.json`):

```json
{
  "corners": {
    "topLeft": { "x": 0.15, "y": 0.12 },
    "topRight": { "x": 0.85, "y": 0.11 },
    "bottomLeft": { "x": 0.14, "y": 0.88 },
    "bottomRight": { "x": 0.86, "y": 0.89 }
  },
  "originalDimensions": { "width": 1280, "height": 720 },
  "markerPositions": {
    "topLeft": { "x": 192, "y": 86 },
    "topRight": { "x": 1088, "y": 79 },
    "bottomLeft": { "x": 179, "y": 634 },
    "bottomRight": { "x": 1101, "y": 641 }
  },
  "capturedAt": "2025-01-08T...",
  "deviceId": "..."
}
```

### Data Augmentation (at training time)

- Random brightness/contrast
- Random rotation (±5°)
- Random scale (0.9-1.1)
- Random perspective warp (slight)
- NO marker-related augmentation (markers already removed)

---

## Unified Training UI

The `/vision-training/train` page will handle training for BOTH model types:

1. **Column Classifier** (existing) - Recognizes digit values from abacus columns
2. **Boundary Detector** (new) - Detects abacus quadrilateral corners

### Model Type Selection

New initial card in the wizard for model selection:

```
┌─────────────────────────────────────────────────┐
│  🎯 Select Model to Train                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────┐  ┌───────────────────┐  │
│  │  📊 Column        │  │  🖼️ Boundary      │  │
│  │  Classifier       │  │  Detector         │  │
│  │                   │  │                   │  │
│  │  Recognizes 0-9   │  │  Detects abacus   │  │
│  │  digit values     │  │  corners          │  │
│  │                   │  │                   │  │
│  │  247 samples      │  │  12 samples       │  │
│  │  ✓ Ready          │  │  ⚠️ Need 200+     │  │
│  └───────────────────┘  └───────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Types

```typescript
// New model type
export type ModelType = "column-classifier" | "boundary-detector";

// Updated phase structure
export const PHASES: PhaseDefinition[] = [
  {
    id: "preparation",
    cards: ["model", "data", "hardware", "dependencies", "config"], // "model" is NEW
  },
  {
    id: "training",
    cards: ["setup", "loading", "training", "export"],
  },
  {
    id: "results",
    cards: ["results"],
  },
];

// Model-specific samples data
export interface ColumnClassifierSamples {
  type: "column-classifier";
  digits: Record<
    number,
    { count: number; samplePath: string | null; tilePaths: string[] }
  >;
  totalImages: number;
  hasData: boolean;
  dataQuality: "none" | "insufficient" | "minimal" | "good" | "excellent";
}

export interface BoundaryDetectorSamples {
  type: "boundary-detector";
  totalFrames: number;
  hasData: boolean;
  dataQuality: "none" | "insufficient" | "minimal" | "good" | "excellent";
  // Distribution info
  deviceCount: number; // Unique devices captured from
  lightingVariety: number; // Estimated lighting condition variety
  angleVariety: number; // Estimated angle variety
}

export type SamplesData = ColumnClassifierSamples | BoundaryDetectorSamples;

// Model-specific results
export interface ColumnClassifierResult extends BaseTrainingResult {
  type: "column-classifier";
  heaven_accuracy?: number;
  earth_accuracy?: number;
}

export interface BoundaryDetectorResult extends BaseTrainingResult {
  type: "boundary-detector";
  mean_corner_error: number; // pixels
  iou_score: number; // 0-1
}

export type TrainingResult = ColumnClassifierResult | BoundaryDetectorResult;
```

### Shared vs Model-Specific Components

| Component            | Shared? | Notes                            |
| -------------------- | ------- | -------------------------------- |
| `ModelCard.tsx`      | N/A     | NEW - Model selection            |
| `DataCard.tsx`       | ❌      | Different for each model type    |
| `HardwareCard.tsx`   | ✅      | Same hardware detection          |
| `DependencyCard.tsx` | ✅      | Same dependencies                |
| `ConfigCard.tsx`     | ✅      | Same config (epochs, batch size) |
| `SetupCard.tsx`      | ✅      | Same setup phase                 |
| `LoadingCard.tsx`    | ✅      | Same loading indicator           |
| `TrainingCard.tsx`   | ✅      | Same progress display            |
| `ExportCard.tsx`     | ✅      | Same export phase                |
| `ResultsCard.tsx`    | ❌      | Different metrics display        |
| `ModelTester.tsx`    | ❌      | Different testing UI             |

### API Changes

```
GET  /api/vision-training/samples?model=column-classifier
GET  /api/vision-training/samples?model=boundary-detector
POST /api/vision-training/train  { model: "column-classifier", ... }
POST /api/vision-training/train  { model: "boundary-detector", ... }
```

### Component Architecture

```
TrainingWizard
├── modelType state (selected model)
├── PhaseSection (preparation)
│   ├── ModelCard (NEW - selects modelType)
│   ├── DataCard
│   │   ├── ColumnClassifierDataCard (if column-classifier)
│   │   └── BoundaryDetectorDataCard (if boundary-detector)
│   ├── HardwareCard (shared)
│   ├── DependencyCard (shared)
│   └── ConfigCard (shared)
├── PhaseSection (training)
│   └── (all shared cards)
└── PhaseSection (results)
    └── ResultsCard
        ├── ColumnClassifierResults (if column-classifier)
        └── BoundaryDetectorResults (if boundary-detector)
```

---

## Files to Create/Modify

### New Files

| File                                                    | Purpose                                     |
| ------------------------------------------------------- | ------------------------------------------- |
| `src/lib/vision/abacusBoundaryDetector.ts`              | TF.js model loading and inference           |
| `src/lib/vision/markerInpainting.ts`                    | Marker removal for training data            |
| `src/hooks/useAbacusBoundaryDetector.ts`                | Hook for boundary detection                 |
| `scripts/train-boundary-detector/train_model.py`        | Python training script                      |
| `scripts/train-boundary-detector/prepare_data.py`       | Data preprocessing                          |
| `src/app/api/vision-training/boundary-samples/route.ts` | API for collecting/listing boundary samples |
| `public/models/abacus-boundary-detector/model.json`     | Trained model                               |

### Training UI Refactoring

| File                                                            | Changes                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| `train/components/wizard/types.ts`                              | Add `ModelType`, update `SamplesData`, `TrainingResult` |
| `train/components/wizard/cards/ModelCard.tsx`                   | NEW - Model selection card                              |
| `train/components/wizard/cards/DataCard.tsx`                    | Refactor to dispatch to model-specific cards            |
| `train/components/wizard/cards/ColumnClassifierDataCard.tsx`    | Extract existing column classifier data UI              |
| `train/components/wizard/cards/BoundaryDetectorDataCard.tsx`    | NEW - Boundary detector data UI                         |
| `train/components/wizard/cards/ResultsCard.tsx`                 | Refactor to dispatch to model-specific results          |
| `train/components/wizard/cards/ColumnClassifierResultsCard.tsx` | Extract existing results UI                             |
| `train/components/wizard/cards/BoundaryDetectorResultsCard.tsx` | NEW - Boundary detector results                         |
| `train/components/wizard/TrainingWizard.tsx`                    | Add `modelType` state, pass to children                 |
| `train/components/wizard/ExpandedCard.tsx`                      | Pass `modelType` to cards                               |
| `train/page.tsx`                                                | Fetch samples for selected model, route training API    |

### Vision Integration Files

| File                                           | Changes                                                     |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `src/types/vision.ts`                          | Add `CalibrationMode = "auto" \| "manual" \| "marker-free"` |
| `src/hooks/useAbacusVision.ts`                 | Add marker-free detection loop                              |
| `src/components/vision/AbacusVisionBridge.tsx` | Add third calibration mode UI                               |
| `src/components/vision/CameraCapture.tsx`      | Support marker-free mode                                    |
| `src/components/vision/DockedVisionFeed.tsx`   | Handle marker-free calibration                              |
| `src/contexts/MyAbacusContext.tsx`             | Add `calibrationMode` to VisionConfig                       |
| `src/hooks/useCameraCalibration.ts`            | Support marker-free calibration storage                     |

---

## Implementation Plan

### Phase 1: Unified Training UI Refactoring

1. **Add ModelType and update types** (`types.ts`)
   - Add `ModelType = "column-classifier" | "boundary-detector"`
   - Add `"model"` to CardId union
   - Update PHASES to include "model" card first
   - Create discriminated union types for SamplesData and TrainingResult

2. **Create ModelCard** (`cards/ModelCard.tsx`)
   - Two-option selector (Column Classifier vs Boundary Detector)
   - Shows sample count and readiness for each
   - Fetches summary info for both models on mount
   - Calls `onSelectModel(modelType)` when user chooses

3. **Refactor DataCard to dispatch by model type**
   - Extract existing code to `ColumnClassifierDataCard.tsx`
   - Create `BoundaryDetectorDataCard.tsx` stub
   - DataCard becomes thin dispatcher based on `modelType`

4. **Refactor ResultsCard to dispatch by model type**
   - Extract existing code to `ColumnClassifierResultsCard.tsx`
   - Create `BoundaryDetectorResultsCard.tsx` stub
   - ResultsCard becomes thin dispatcher based on `modelType`

5. **Update TrainingWizard and page.tsx**
   - Add `modelType` state to wizard
   - Pass `modelType` through component tree
   - Update API calls to include model parameter
   - Fetch correct samples based on selected model

### Phase 2: Boundary Detector Training Data

6. **Add marker inpainting utility** (`markerInpainting.ts`)
   - `inpaintMarkers(frame, markerPositions)` → cleaned frame
   - Use canvas-based approach (no server-side OpenCV needed)
   - Fallback to blur if inpainting not available

7. **Create boundary sample collection API**
   - Endpoint: `POST /api/vision-training/boundary-samples`
   - Accepts: frame (base64), corners, marker positions
   - Processes: inpaints markers, saves frame + labels
   - Returns: sample ID

8. **Add collection trigger to existing marker detection**
   - When `allMarkersFound` and user opts in, auto-collect samples
   - Rate limit: max 1 sample per second
   - Show collection count in UI

9. **Implement BoundaryDetectorDataCard**
   - Shows frame count, variety metrics
   - Quality indicator based on sample count
   - Link to start collecting if markers available

### Phase 3: Boundary Detector Training Pipeline

10. **Create Python training script** (`scripts/train-boundary-detector/train_model.py`)
    - Load frames + labels
    - Train MobileNetV2-based model (regression for 8 corner coords)
    - Export to TF.js format
    - Save to `public/models/abacus-boundary-detector/`

11. **Update training API** (`/api/vision-training/train`)
    - Accept `model` parameter in request body
    - Route to correct Python script based on model type
    - Return model-specific metrics

12. **Implement BoundaryDetectorResultsCard**
    - Show mean corner error (pixels)
    - Show IoU score
    - Visual overlay of predicted vs actual corners
    - Model tester with live camera

### Phase 4: Inference Integration

13. **Create boundary detector hook** (`useAbacusBoundaryDetector.ts`)
    - Lazy load TF.js model
    - Run inference on video frames
    - Return corner predictions with confidence
    - Stability filtering (similar to digit detection)

14. **Update CalibrationMode type**

    ```typescript
    export type CalibrationMode = "auto" | "manual" | "marker-free";
    ```

15. **Add marker-free option to AbacusVisionBridge**
    - Third segment in source selector
    - Shows "Training required" if no model
    - Falls back to markers if detection confidence low

### Phase 5: Vision UI Integration

16. **Update all calibration mode UIs**
    - `AbacusVisionBridge.tsx` - Main setup modal with 3-way selector
    - `CameraCapture.tsx` - Support marker-free mode
    - `DockedVisionFeed.tsx` - Handle marker-free calibration
    - Add indicator showing which mode is active

17. **Add calibration mode to VisionConfig**

    ```typescript
    interface VisionConfig {
      enabled: boolean;
      cameraDeviceId: string | null;
      calibration: CalibrationGrid | null;
      calibrationMode: CalibrationMode; // NEW
      // ...
    }
    ```

18. **Persist calibration mode preference**
    - Save to localStorage with other vision config
    - Remember user's preferred mode per device

---

## UI Design

### Calibration Mode Selector (in AbacusVisionBridge)

```
┌─────────────────────────────────────────────┐
│  📷 Abacus Vision                      [×]  │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │        [Camera Feed]                │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Calibration Mode                           │
│  ┌───────────┬───────────┬───────────┐     │
│  │ 🎯 Auto   │ ✋ Manual │ 🧠 ML     │     │
│  │ (Markers) │           │ (Beta)    │     │
│  └───────────┴───────────┴───────────┘     │
│                                             │
│  [Auto selected]                            │
│  ● 4/4 markers detected                     │
│  ✓ Calibration ready                        │
│                                             │
│  [ML selected - if no model]                │
│  ⚠️ Model not trained                       │
│  → Collect samples with markers first       │
│  → Then train the boundary detector         │
│                                             │
│         [ Enable Vision ]                   │
└─────────────────────────────────────────────┘
```

### Sample Collection Banner (when markers detected)

```
┌─────────────────────────────────────────────┐
│ 🎓 Training marker-free detection           │
│ Collected: 47 samples                       │
│ [Stop Collecting]                           │
└─────────────────────────────────────────────┘
```

---

## Confidence & Fallback Strategy

### Inference Confidence

- Compute confidence from prediction consistency across frames
- If corners "jump" significantly between frames → low confidence
- Threshold: require 5 consecutive stable predictions

### Fallback Chain

```
1. Try marker-free ML detection
   ↓ (if confidence < threshold OR model not loaded)
2. Try ArUco marker detection
   ↓ (if markers not found)
3. Show "Position abacus in frame" message
```

### Quality Indicators

- Green: High confidence, stable detection
- Yellow: Medium confidence, some jitter
- Red: Low confidence, using fallback

---

## Model Performance Targets

| Metric                 | Target                   |
| ---------------------- | ------------------------ |
| Mean corner error      | < 10 pixels (at 640×480) |
| Inference time         | < 50ms per frame         |
| Model size             | < 5MB (TF.js)            |
| Min training samples   | 200 frames               |
| Ideal training samples | 1000+ frames             |

---

## Testing Strategy

1. **Unit tests**: Corner coordinate normalization/denormalization
2. **Integration tests**: Full pipeline from frame to corners
3. **Visual tests**: Overlay predicted corners on test frames
4. **A/B comparison**: Side-by-side with marker detection
5. **Stress tests**: Various lighting, angles, partial occlusion

---

## Rollout Plan

1. **Alpha**: Behind feature flag, opt-in only
2. **Beta**: Available in UI with "(Beta)" label
3. **GA**: Full release after sufficient user validation

---

## Open Questions

1. Should marker-free work with remote phone camera?
   - Probably yes, same pipeline

2. Should we support training from phone-captured frames?
   - Yes, phone camera often has better angle

3. How to handle multiple abaci in frame?
   - V1: Detect largest/most confident
   - V2: Multi-abacus support

4. Should the model also detect column count?
   - V1: User specifies column count
   - V2: Model predicts column count (4-13)
