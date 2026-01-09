# Column Classifier Training

Trains the TensorFlow.js abacus column digit classifier using real images collected from production.

## Overview

Training data is collected automatically when users practice with vision mode enabled:

- When a student answers correctly with vision enabled, column images are saved
- Images are 64×128 grayscale PNGs, organized by digit (0-9)
- Collection happens in the background without interrupting practice

## Quick Start

```bash
# 1. Sync training data from production
./scripts/sync-training-data.sh

# 2. Install Python dependencies
pip install -r scripts/train-column-classifier/requirements.txt

# 3. Train the model
python scripts/train-column-classifier/train_model.py

# 4. Convert to TensorFlow.js format
tensorflowjs_converter \
  --input_format=keras \
  ./models/column-classifier.keras \
  ./public/models/abacus-column-classifier/
```

## Data Collection

Training data is collected by:

- `POST /api/vision-training/collect` - saves column images when answer is correct
- Images stored in `data/vision-training/collected/{digit}/*.png`

View collected data at `/vision-training` in the app.

### Filename Format

```
{timestamp}_{playerId}_{sessionId}_col{index}_{uuid}.png
```

Example: `1736112345678_abc12345_def67890_col2_a1b2c3d4.png`

## Directory Structure

```
data/vision-training/collected/
├── 0/
│   ├── 1736112345678_abc12345_def67890_col0_a1b2c3d4.png
│   └── ...
├── 1/
├── 2/
├── ...
└── 9/
```

## Image Specifications

- **Dimensions**: 64×128 pixels (width × height)
- **Format**: Grayscale PNG
- **Classes**: 10 (digits 0-9)
- **Source**: Real abacus photos from vision mode

## Training the Model

```bash
# Train with default settings
python scripts/train-column-classifier/train_model.py

# Specify data directory
python scripts/train-column-classifier/train_model.py --data-dir ./data/vision-training/collected

# Adjust epochs
python scripts/train-column-classifier/train_model.py --epochs 50
```

## Model Architecture

CNN designed for efficiency on mobile devices:

```
Input: 64×128×1 (grayscale)
├── Conv2D(32, 3×3) + ReLU + MaxPool(2×2)
├── Conv2D(64, 3×3) + ReLU + MaxPool(2×2)
├── Conv2D(128, 3×3) + ReLU + MaxPool(2×2)
├── Flatten
├── Dense(128) + ReLU + Dropout(0.5)
└── Dense(10) + Softmax
Output: 10 classes (digits 0-9)
```

Target model size: <2MB (quantized)

## Files

- `train_model.py` - Python training script
- `requirements.txt` - Python dependencies
- `../sync-training-data.sh` - Script to pull data from production

## Requirements

- Python 3.8+
- TensorFlow 2.x
- tensorflowjs (for model conversion)

## Workflow

1. **Collect**: Users practice with vision mode → images auto-saved on prod
2. **Sync**: Run `sync-training-data.sh` to pull images to dev machine
3. **Review**: Check `/vision-training` page to view/filter collected data
4. **Train**: Run `train_model.py` to train the model
5. **Convert**: Use `tensorflowjs_converter` to export for browser
6. **Deploy**: Commit updated model to `public/models/abacus-column-classifier/`
