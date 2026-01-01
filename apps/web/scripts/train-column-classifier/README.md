# Column Classifier Training Data Generator

Generates synthetic training images for the TensorFlow.js abacus column digit classifier used by the AbacusVisionBridge feature.

## Overview

This script renders single-column abacus SVGs for digits 0-9 using the `AbacusStatic` component from `@soroban/abacus-react`, then applies various augmentations to create diverse training data.

## Quick Start

```bash
# Generate training data (default: 5000 samples per digit = 50,000 total)
npx tsx scripts/train-column-classifier/generateTrainingData.ts

# Generate fewer samples for testing
npx tsx scripts/train-column-classifier/generateTrainingData.ts --samples 100

# Specify output directory
npx tsx scripts/train-column-classifier/generateTrainingData.ts --output ./my-training-data

# Set random seed for reproducibility
npx tsx scripts/train-column-classifier/generateTrainingData.ts --seed 42

# Dry run (show config without generating)
npx tsx scripts/train-column-classifier/generateTrainingData.ts --dry-run
```

## Output Structure

```
training-data/column-classifier/
├── 0/
│   ├── 0_circle-mono_00000.png
│   ├── 0_circle-mono_00001.png
│   └── ...
├── 1/
├── 2/
├── ...
├── 9/
├── metadata.json    # Generation configuration and stats
└── labels.csv       # Sample labels with augmentation params
```

## Image Specifications

- **Dimensions**: 64x128 pixels (width x height)
- **Format**: Grayscale PNG
- **Classes**: 10 (digits 0-9)
- **Default samples**: 5,000 per digit (50,000 total)

## Augmentations Applied

Each sample is randomly augmented with:

| Augmentation     | Range                | Purpose                        |
| ---------------- | -------------------- | ------------------------------ |
| Rotation         | ±5°                  | Handle camera angle variations |
| Scale            | 0.9-1.1x             | Handle distance variations     |
| Brightness       | 0.8-1.2x             | Handle lighting conditions     |
| Gaussian noise   | σ=10                 | Handle camera sensor noise     |
| Background color | 7 variations         | Handle different surfaces      |
| Blur             | 0-1.5px (10% chance) | Handle focus issues            |

## Style Variants

Training data includes all bead shapes and color schemes:

- `circle-mono` - Circle beads, monochrome
- `diamond-mono` - Diamond beads, monochrome
- `square-mono` - Square beads, monochrome
- `circle-heaven-earth` - Circle beads, heaven-earth colors
- `diamond-heaven-earth` - Diamond beads, heaven-earth colors
- `circle-place-value` - Circle beads, place-value colors

## Training the Model

After generating training data, use the Python training script:

```bash
# Install dependencies
pip install tensorflow numpy pillow

# Train the model
python scripts/train-column-classifier/train_model.py

# Export to TensorFlow.js format
tensorflowjs_converter \
  --input_format=keras \
  ./models/column-classifier.keras \
  ./public/models/abacus-column-classifier/
```

## Model Architecture

The CNN architecture is designed for efficiency on mobile devices:

```
Input: 64x128x1 (grayscale)
├── Conv2D(32, 3x3) + ReLU + MaxPool(2x2)
├── Conv2D(64, 3x3) + ReLU + MaxPool(2x2)
├── Conv2D(128, 3x3) + ReLU + MaxPool(2x2)
├── Flatten
├── Dense(128) + ReLU + Dropout(0.5)
└── Dense(10) + Softmax
Output: 10 classes (digits 0-9)
```

Target model size: <2MB (quantized)

## Files

- `types.ts` - Type definitions and default configurations
- `renderColumn.tsx` - Single-column SVG rendering
- `augmentation.ts` - Image augmentation utilities
- `generateTrainingData.ts` - Main generation script
- `train_model.py` - Python training script (to be created)

## Requirements

- Node.js 18+
- `sharp` package (for image processing)
- `@soroban/abacus-react` package (workspace dependency)

## Notes

- Generation takes ~5-10 minutes for 50,000 samples
- Output size is approximately 200-300MB
- Training data is grayscale to focus on shape recognition
- The model will be integrated via `useColumnClassifier.ts` hook
