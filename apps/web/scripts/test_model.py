#!/usr/bin/env python3
"""
Quick test script to verify model predictions on training data.

Usage:
    python scripts/test_model.py [--model PATH] [--data-dir PATH] [--digit N] [--count N]
"""

import argparse
import sys
from pathlib import Path
import numpy as np
from PIL import Image

def digit_to_beads(digit):
    """Convert digit 0-9 to (heaven, earth)"""
    heaven = 1 if digit >= 5 else 0
    earth = digit % 5
    return heaven, earth

def beads_to_digit(heaven, earth):
    """Convert bead positions to digit"""
    return int(heaven) * 5 + int(earth)

def load_and_preprocess(img_path, target_size=(128, 64)):
    """Load image and preprocess exactly as training does."""
    img = Image.open(img_path).convert("L")  # Grayscale
    img = img.resize((target_size[1], target_size[0]), Image.Resampling.BILINEAR)
    img_array = np.array(img, dtype=np.float32) / 255.0  # [0, 1]
    # Add batch and channel dims: (1, H, W, 1)
    img_array = img_array[np.newaxis, ..., np.newaxis]
    return img_array

def test_model(model_path, data_dir, digit=None, count=5):
    """Test model predictions."""
    import tensorflow as tf

    # Load the Keras model
    print(f"Loading model from {model_path}...")
    model = tf.keras.models.load_model(model_path)

    # Show model summary
    print("\nModel architecture:")
    model.summary()

    # Check input layer
    print(f"\nInput shape: {model.input_shape}")
    print(f"Output names: {model.output_names}")

    # Load test images
    data_path = Path(data_dir)
    if not data_path.exists():
        print(f"Error: Data directory not found: {data_dir}")
        sys.exit(1)

    # Collect images
    test_images = []
    if digit is not None:
        # Test specific digit
        digit_dir = data_path / str(digit)
        if not digit_dir.exists():
            print(f"Error: No images for digit {digit}")
            sys.exit(1)
        for img_path in list(digit_dir.glob("*.png"))[:count]:
            test_images.append((digit, img_path))
    else:
        # Test one of each digit
        for d in range(10):
            digit_dir = data_path / str(d)
            if digit_dir.exists():
                imgs = list(digit_dir.glob("*.png"))
                if imgs:
                    test_images.append((d, imgs[0]))

    if not test_images:
        print("No test images found!")
        sys.exit(1)

    # Test each image
    print(f"\n{'='*70}")
    print(f"Testing {len(test_images)} images...")
    print(f"{'='*70}")

    correct_digit = 0
    correct_heaven = 0
    correct_earth = 0

    for true_digit, img_path in test_images:
        # Preprocess
        img_array = load_and_preprocess(img_path)

        # Debug: show input range
        print(f"\n[{img_path.name}] True digit: {true_digit}")
        print(f"  Input range: [{img_array.min():.3f}, {img_array.max():.3f}]")

        # Predict
        outputs = model.predict(img_array, verbose=0)

        # Parse outputs
        heaven_raw = outputs[0][0][0]  # Shape: (1, 1)
        earth_probs = outputs[1][0]     # Shape: (1, 5)

        # Interpret
        heaven_pred = 1 if heaven_raw > 0.5 else 0
        earth_pred = int(np.argmax(earth_probs))
        digit_pred = beads_to_digit(heaven_pred, earth_pred)

        # Ground truth
        true_heaven, true_earth = digit_to_beads(true_digit)

        # Compare
        heaven_ok = "✓" if heaven_pred == true_heaven else "✗"
        earth_ok = "✓" if earth_pred == true_earth else "✗"
        digit_ok = "✓" if digit_pred == true_digit else "✗"

        if heaven_pred == true_heaven:
            correct_heaven += 1
        if earth_pred == true_earth:
            correct_earth += 1
        if digit_pred == true_digit:
            correct_digit += 1

        print(f"  Heaven: {heaven_pred} (raw={heaven_raw:.3f}) vs {true_heaven} {heaven_ok}")
        print(f"  Earth:  {earth_pred} (probs={[f'{p:.2f}' for p in earth_probs]}) vs {true_earth} {earth_ok}")
        print(f"  Digit:  {digit_pred} vs {true_digit} {digit_ok}")

    # Summary
    n = len(test_images)
    print(f"\n{'='*70}")
    print(f"Summary: digit={correct_digit}/{n} ({100*correct_digit/n:.1f}%), "
          f"heaven={correct_heaven}/{n} ({100*correct_heaven/n:.1f}%), "
          f"earth={correct_earth}/{n} ({100*correct_earth/n:.1f}%)")
    print(f"{'='*70}")


def test_normalization_comparison(model_path, data_dir, digit=0):
    """Test both normalization approaches to find the correct one."""
    import tensorflow as tf

    print("=" * 70)
    print("NORMALIZATION COMPARISON TEST")
    print("=" * 70)

    model = tf.keras.models.load_model(model_path)

    # Get one test image
    data_path = Path(data_dir)
    digit_dir = data_path / str(digit)
    img_path = list(digit_dir.glob("*.png"))[0]

    img = Image.open(img_path).convert("L")
    img = img.resize((64, 128), Image.Resampling.BILINEAR)
    img_array = np.array(img, dtype=np.float32)

    true_heaven, true_earth = digit_to_beads(digit)

    # Test different normalizations
    normalizations = [
        ("raw [0,255]", img_array[np.newaxis, ..., np.newaxis]),
        ("[0,1]", (img_array / 255.0)[np.newaxis, ..., np.newaxis]),
        ("[-1,1]", ((img_array / 255.0) * 2 - 1)[np.newaxis, ..., np.newaxis]),
        ("[0,2]", ((img_array / 255.0) * 2)[np.newaxis, ..., np.newaxis]),
    ]

    print(f"\nTesting digit {digit} (heaven={true_heaven}, earth={true_earth})")
    print(f"Image: {img_path.name}")
    print()

    for name, arr in normalizations:
        outputs = model.predict(arr, verbose=0)
        heaven_raw = outputs[0][0][0]
        earth_probs = outputs[1][0]
        heaven_pred = 1 if heaven_raw > 0.5 else 0
        earth_pred = int(np.argmax(earth_probs))
        digit_pred = beads_to_digit(heaven_pred, earth_pred)

        correct = "✓ CORRECT" if digit_pred == digit else "✗ WRONG"
        print(f"  {name:12s}: heaven={heaven_pred} (raw={heaven_raw:.3f}), earth={earth_pred}, digit={digit_pred} {correct}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="./public/models/abacus-column-classifier/column-classifier.keras")
    parser.add_argument("--data-dir", default="./data/vision-training/collected")
    parser.add_argument("--digit", type=int, default=None, help="Test specific digit")
    parser.add_argument("--count", type=int, default=5, help="Number of images to test per digit")
    parser.add_argument("--compare-norm", action="store_true", help="Compare normalization approaches")
    args = parser.parse_args()

    if args.compare_norm:
        test_normalization_comparison(args.model, args.data_dir, args.digit or 0)
    else:
        test_model(args.model, args.data_dir, args.digit, args.count)
