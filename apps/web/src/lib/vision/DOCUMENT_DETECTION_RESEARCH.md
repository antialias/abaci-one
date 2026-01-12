# Document Detection Research

Research notes on improving quad/document detection, particularly for handling finger occlusion and complex backgrounds.

**Date**: January 2026
**Context**: Current OpenCV-based quad detection struggles with finger occlusion and busy backgrounds.

---

## The Core Problem

Standard Canny edge detection fails for document scanning because:
> "The sections of text inside the document are strongly amplified, whereas the document edges—what we're interested in—show up very weakly."
> — Dropbox Engineering

Traditional CV approaches (Canny + Hough) can only work with **visible edges**. When fingers occlude document corners, the edge pixels simply aren't there.

---

## Industry Approaches

### Dropbox (2016)
**Source**: [Fast and Accurate Document Detection for Scanning](https://dropbox.tech/machine-learning/fast-and-accurate-document-detection-for-scanning)

1. **Custom ML-based edge detector** - trained to suppress text edges while keeping document boundaries (details proprietary)
2. **Hough transform** for line detection from the cleaned edge map
3. **Quadrilateral scoring** - enumerate all possible quads from line intersections, score each by summing edge probabilities along perimeter
4. **Result**: 8-10 FPS, 60% fewer manual corrections vs Apple's SDK

Follow-up: [Improving the Responsiveness of the Document Detector](https://dropbox.tech/machine-learning/improving-the-responsiveness-of-the-document-detector)
- Motion-based quad tracking between frames
- Hybrid: full detection every ~100ms + fast tracking on intermediate frames

### Genius Scan (2024)
**Source**: [Document Detection - How Deep Learning Has Changed The Game](https://blog.thegrizzlylabs.com/2024/10/document-detection.html)

**Key insight**: Combining DL + traditional CV raised accuracy from 51% → 75% → 85%:
- DL provides **robustness** (handles occlusion, complex backgrounds)
- Traditional CV provides **precision** (sub-pixel corner refinement)

Architecture:
- MobileNet V2 backbone
- Input resolution: 96×96 pixels
- Training dataset: 1M+ images
- Pre-training: ImageNet, fine-tuned on document data
- Performance: 25+ FPS on mobile

### Scanner Pro (Readdle)
**Source**: [Inside ScannerPro: the Tech behind perfect scans](https://readdle.com/blog/scanner-pro-border-detection)

Evolution:
1. Traditional CV (Canny + Hough) - baseline
2. Semantic segmentation - too slow (5 FPS on iPhone X)
3. **Keypoint detection** - direct corner prediction, 30+ FPS

Key techniques:
- MobileNet-based keypoint detector
- Kalman filter + IMU data for temporal smoothing
- Two-stage: lightweight detector for streaming, heavier model on capture

### Academic Approaches

**Multi-document detection via corner localization**:
- Joint Corner Detector (JCD) with attention mechanism
- Coarse-to-fine: rough prediction → corner-specific refinement
- Datasets: ICDAR 2015 SmartDoc, SEECS-NUSF, MIDV-500

**Semantic segmentation** (LearnOpenCV tutorial):
- DeepLabv3 with MobileNetV3-Large backbone
- Binary segmentation (document vs background)
- Trained on synthetic data with augmentation
- Extract corners from mask via contour detection

---

## Modern Architecture Pattern

The recommended approach for robust document detection:

```
Input Image (downscaled to 96-256px)
        ↓
┌───────────────────┐
│  MobileNetV2/V3   │  ← Pretrained on ImageNet
│  Feature Extractor│
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Regression Head  │  ← 8 outputs (x,y for 4 corners)
│  (or Heatmap Head)│
└─────────┬─────────┘
          ↓
    Corner Coordinates
          ↓
┌───────────────────┐
│  Optional: CV     │  ← Sub-pixel refinement
│  Refinement       │
└───────────────────┘
```

**Why this works for occlusion**: The network learns document shape priors and can predict where corners *should* be even when they're not visible.

---

## Hugging Face Models

### Document-Specific

**[ordaktaktak/Document-Scanner](https://huggingface.co/ordaktaktak/Document-Scanner)**
- Architecture: U-Net semantic segmentation
- Input: Grayscale 256×256
- Output: Binary mask → extract corners via contour detection
- Framework: PyTorch (.pth weights)
- Status: Would need conversion to ONNX/TF.js

### Background Removal (Could Adapt)

**[briaai/RMBG-2.0](https://huggingface.co/briaai/RMBG-2.0)**
- Architecture: BiRefNet (0.2B params) - too large for real-time
- Input: 1024×1024 RGB
- Output: Alpha matte
- Transformers.js compatible
- License: CC BY-NC 4.0 (non-commercial)

**[briaai/RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4)**
- Smaller version (44.1M params)
- Same approach, might be more practical

### General Segmentation (Transformers.js Ready)

| Model | Size | Use Case |
|-------|------|----------|
| `Xenova/deeplabv3-mobilevit-xx-small` | Tiny | Fast, low accuracy |
| `Xenova/deeplabv3-mobilevit-small` | Small | Balanced |
| `Xenova/deeplabv3-mobilevit-x-small` | X-Small | Middle ground |
| `nnny/onnx-mobile-sam` | ~5MB | General segmentation with prompts |

### SAM-based Approach

Could use Segment Anything Model with point prompts:
1. User taps roughly in document area
2. SAM segments the document
3. Extract corners from segmentation mask

Models: `nnny/onnx-mobile-sam`, SlimSAM variants

---

## Implementation Options

### Option 1: Convert Document-Scanner to ONNX

```bash
# Download PyTorch model
# Convert with torch.onnx.export()
# Use with ONNX Runtime Web

import torch
model = load_document_scanner_model()
dummy_input = torch.randn(1, 1, 256, 256)  # grayscale
torch.onnx.export(model, dummy_input, "document_scanner.onnx")
```

Pros: Purpose-built for documents
Cons: Still outputs mask, need CV for corners

### Option 2: SAM with Point Prompts

```typescript
import { pipeline } from '@huggingface/transformers';

const segmenter = await pipeline('image-segmentation', 'nnny/onnx-mobile-sam');
const result = await segmenter(image, { points: [[centerX, centerY]] });
// Extract corners from mask
```

Pros: No training needed, handles complex shapes
Cons: Requires user interaction (point prompt)

### Option 3: Train Custom Corner Detector

Training a lightweight model specifically for corner prediction:

1. **Architecture**: MobileNetV2 → 8-output regression (4 corners × 2 coords)
2. **Training data**:
   - SmartDoc dataset (ICDAR)
   - DocVQA documents on backgrounds
   - Synthetic: random quads with augmentation
   - **Critical**: Include finger occlusion augmentation
3. **Output**: Normalized corner coordinates [0,1]
4. **Export**: TensorFlow.js or ONNX

This is what Dropbox, Genius Scan, and Scanner Pro actually do.

### Option 4: Hybrid (Recommended for Production)

1. **Primary**: Lightweight CNN corner predictor (handles occlusion)
2. **Refinement**: Traditional CV on predicted region (sub-pixel accuracy)
3. **Tracking**: Kalman filter for temporal stability

---

## Datasets

| Dataset | Size | Notes |
|---------|------|-------|
| SmartDoc (ICDAR 2015) | 4,260 images | Competition dataset, labeled corners |
| MIDV-500 | 500 video clips | ID documents, challenging conditions |
| DocVQA | 50K+ images | Document images (need corner labels) |
| Synthetic | Unlimited | Generate documents on backgrounds |

---

## Key Takeaways

1. **Traditional CV (our current approach) will always struggle with occlusion** - it can only see visible edges

2. **The industry solution is learned corner prediction** - networks trained on documents learn shape priors

3. **Hybrid approaches work best** - DL for robustness, CV for precision

4. **No ready-to-use model exists** on Hugging Face that:
   - Is specifically trained for document corners
   - Handles finger occlusion
   - Is already in TF.js/ONNX format

5. **Realistic path forward**:
   - Short term: Try SAM with prompts, or convert Document-Scanner to ONNX
   - Long term: Train custom MobileNet-based corner detector

---

## References

- [Dropbox: Fast and Accurate Document Detection](https://dropbox.tech/machine-learning/fast-and-accurate-document-detection-for-scanning)
- [Dropbox: Improving Responsiveness](https://dropbox.tech/machine-learning/improving-the-responsiveness-of-the-document-detector)
- [Genius Scan: Document Detection with Deep Learning](https://blog.thegrizzlylabs.com/2024/10/document-detection.html)
- [Scanner Pro: Tech Behind Perfect Scans](https://readdle.com/blog/scanner-pro-border-detection)
- [LearnOpenCV: Document Segmentation with DeepLabv3](https://learnopencv.com/deep-learning-based-document-segmentation-using-semantic-segmentation-deeplabv3-on-custom-dataset/)
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js/en/index)
- [U-Net Paper (arxiv 1505.04597)](https://arxiv.org/abs/1505.04597)
