#!/usr/bin/env python3
"""
Test boundary detector inference locally to compare with browser results.

Loads the trained model and runs inference on sample images, logging
heatmap statistics and decoded coordinates.

Tests both WITH and WITHOUT marker masking to verify the model works
correctly when markers are removed (as in training).
"""

import json
import sys
from pathlib import Path

import numpy as np

# Import marker masking from the training script directory
sys.path.insert(0, str(Path(__file__).parent))
from marker_masking import mask_markers


def load_model(model_path: str):
    """Load the trained Keras model."""
    import tensorflow as tf

    model_path = Path(model_path)

    # Try loading .keras file first
    keras_path = model_path / "boundary-detector.keras"
    if keras_path.exists():
        print(f"Loading Keras model from: {keras_path}")
        return tf.keras.models.load_model(keras_path)

    # Try SavedModel format
    saved_model_path = model_path
    if (saved_model_path / "saved_model.pb").exists():
        print(f"Loading SavedModel from: {saved_model_path}")
        return tf.saved_model.load(saved_model_path)

    raise FileNotFoundError(f"No model found at {model_path}")


def dsnt_decode_numpy(heatmaps, temperature=10.0):
    """
    Decode heatmaps to coordinates using DSNT (numpy version).

    This matches the browser implementation to ensure we're comparing apples to apples.
    """
    batch_size, height, width, num_kp = heatmaps.shape

    all_coords = []
    for b in range(batch_size):
        coords = []
        for kp in range(num_kp):
            hm = heatmaps[b, :, :, kp]

            # Apply temperature and softmax
            hm_flat = hm.flatten() * temperature
            hm_flat = hm_flat - np.max(hm_flat)  # Stability
            hm_exp = np.exp(hm_flat)
            hm_softmax = hm_exp / np.sum(hm_exp)
            hm_normalized = hm_softmax.reshape(height, width)

            # Compute expected coordinates
            x_range = np.linspace(0, 1, width)
            y_range = np.linspace(0, 1, height)

            expected_x = np.sum(hm_normalized * x_range.reshape(1, -1))
            expected_y = np.sum(hm_normalized * y_range.reshape(-1, 1))

            coords.append([expected_x, expected_y])
        all_coords.append(coords)

    return np.array(all_coords)


def analyze_heatmaps(heatmaps, corner_names=None, verbose=True):
    """Analyze heatmap statistics per corner."""
    if corner_names is None:
        corner_names = ["TL", "TR", "BL", "BR"]

    if verbose:
        print(f"  Heatmap shape: {heatmaps.shape}")

    results = []
    hm = heatmaps[0]  # (H, W, 4)
    for c, name in enumerate(corner_names):
        corner_hm = hm[:, :, c]
        corner_max = corner_hm.max()
        corner_mean = corner_hm.mean()

        # Diagnostic
        if corner_max > 0.5:
            status = "✓ strong"
        elif corner_max > 0.1:
            status = "⚠ weak"
        else:
            status = "✗ very weak"

        results.append({
            "name": name,
            "max": corner_max,
            "mean": corner_mean,
            "status": status
        })

        if verbose:
            print(f"  Corner {c} ({name}): max={corner_max:.4f} - {status}")

    return results


def load_sample_data(data_dir: str, num_samples: int = 5):
    """
    Load sample images and annotations from the training data directory.

    Returns raw images (not resized) so we can apply marker masking properly.
    """
    from PIL import Image

    data_path = Path(data_dir)
    png_files = list(data_path.glob("**/*.png"))

    if not png_files:
        raise FileNotFoundError(f"No PNG files found in {data_dir}")

    print(f"\nFound {len(png_files)} images, loading {min(num_samples, len(png_files))} samples...")

    samples = []
    for png_path in png_files[:num_samples]:
        json_path = png_path.with_suffix(".json")

        if not json_path.exists():
            print(f"Skipping {png_path.name} - no annotation file")
            continue

        # Load raw image (not resized yet)
        img = Image.open(png_path).convert("RGB")
        img_array = np.array(img)

        # Load annotations
        with open(json_path) as f:
            annotation = json.load(f)

        corners = annotation.get("corners", {})
        gt_coords = [
            (corners["topLeft"]["x"], corners["topLeft"]["y"]),
            (corners["topRight"]["x"], corners["topRight"]["y"]),
            (corners["bottomLeft"]["x"], corners["bottomLeft"]["y"]),
            (corners["bottomRight"]["x"], corners["bottomRight"]["y"]),
        ]

        samples.append({
            "path": png_path.name,
            "full_path": png_path,
            "raw_image": img_array,  # Raw, not resized
            "ground_truth": gt_coords
        })

    return samples


def prepare_image(raw_image: np.ndarray, keypoints: list, image_size: int = 224,
                  apply_masking: bool = False) -> np.ndarray:
    """
    Prepare image for inference.

    Args:
        raw_image: Raw image array (H, W, 3) uint8
        keypoints: List of (x, y) normalized coordinates for corners
        image_size: Target size for model input
        apply_masking: Whether to apply marker masking (as in training)

    Returns:
        Normalized image array (H, W, 3) float32 in [0, 1]
    """
    from PIL import Image

    img_array = raw_image.copy()

    # Apply marker masking if requested
    if apply_masking:
        try:
            img_array = mask_markers(img_array, keypoints, method="noise")
        except Exception as e:
            print(f"    Warning: marker masking failed: {e}")

    # Resize to model input size
    img = Image.fromarray(img_array)
    img = img.resize((image_size, image_size), Image.BILINEAR)

    # Normalize to [0, 1]
    return np.array(img, dtype=np.float32) / 255.0


def run_single_inference(model, image: np.ndarray, gt_coords: list, label: str = ""):
    """Run inference on a single image and return results."""
    corner_names = ["TL", "TR", "BL", "BR"]

    # Prepare input batch
    image_batch = np.expand_dims(image, axis=0)  # (1, 224, 224, 3)

    # Run inference
    heatmaps = model(image_batch, training=False)
    heatmaps = heatmaps.numpy()

    # Analyze heatmaps
    hm_results = analyze_heatmaps(heatmaps, corner_names, verbose=False)

    # Decode coordinates
    pred_coords = dsnt_decode_numpy(heatmaps, temperature=10.0)[0]
    gt_array = np.array(gt_coords)

    # Calculate errors
    errors = []
    for c in range(4):
        pred = pred_coords[c]
        gt = gt_array[c]
        error_px = np.sqrt((pred[0] - gt[0])**2 + (pred[1] - gt[1])**2) * 224
        errors.append(error_px)

    mean_error = np.mean(errors)

    return {
        "pred_coords": pred_coords,
        "errors": errors,
        "mean_error": mean_error,
        "heatmap_results": hm_results
    }


def run_comparison(model, samples, image_size: int = 224):
    """Run inference with and without marker masking for comparison."""
    corner_names = ["TL", "TR", "BL", "BR"]

    print("\n" + "=" * 80)
    print("COMPARISON: With Marker Masking (like training) vs Without (like browser)")
    print("=" * 80)

    all_errors_masked = []
    all_errors_unmasked = []

    for i, sample in enumerate(samples):
        print(f"\n{'─'*80}")
        print(f"Sample {i+1}: {sample['path']}")
        print(f"{'─'*80}")

        gt_coords = sample["ground_truth"]

        # Prepare images with and without masking
        img_masked = prepare_image(
            sample["raw_image"], gt_coords, image_size, apply_masking=True
        )
        img_unmasked = prepare_image(
            sample["raw_image"], gt_coords, image_size, apply_masking=False
        )

        # Run inference on both
        results_masked = run_single_inference(model, img_masked, gt_coords, "masked")
        results_unmasked = run_single_inference(model, img_unmasked, gt_coords, "unmasked")

        all_errors_masked.extend(results_masked["errors"])
        all_errors_unmasked.extend(results_unmasked["errors"])

        # Print comparison table
        print(f"\n  {'Corner':<6} │ {'Ground Truth':>14} │ {'With Masking':>14} {'Err':>6} │ {'No Masking':>14} {'Err':>6}")
        print(f"  {'─'*6}─┼─{'─'*14}─┼─{'─'*14}─{'─'*6}─┼─{'─'*14}─{'─'*6}")

        for c, name in enumerate(corner_names):
            gt = gt_coords[c]
            pred_m = results_masked["pred_coords"][c]
            pred_u = results_unmasked["pred_coords"][c]
            err_m = results_masked["errors"][c]
            err_u = results_unmasked["errors"][c]

            gt_str = f"({gt[0]:.3f}, {gt[1]:.3f})"
            pred_m_str = f"({pred_m[0]:.3f}, {pred_m[1]:.3f})"
            pred_u_str = f"({pred_u[0]:.3f}, {pred_u[1]:.3f})"

            print(f"  {name:<6} │ {gt_str:>14} │ {pred_m_str:>14} {err_m:>5.1f}px │ {pred_u_str:>14} {err_u:>5.1f}px")

        print(f"  {'─'*6}─┼─{'─'*14}─┼─{'─'*14}─{'─'*6}─┼─{'─'*14}─{'─'*6}")
        print(f"  {'Mean':<6} │ {'':>14} │ {'':>14} {results_masked['mean_error']:>5.1f}px │ {'':>14} {results_unmasked['mean_error']:>5.1f}px")

        # Show heatmap strength comparison
        print(f"\n  Heatmap peak strengths:")
        print(f"  {'Corner':<6} │ {'With Masking':>14} │ {'No Masking':>14}")
        print(f"  {'─'*6}─┼─{'─'*14}─┼─{'─'*14}")
        for c, name in enumerate(corner_names):
            hm_m = results_masked["heatmap_results"][c]
            hm_u = results_unmasked["heatmap_results"][c]
            print(f"  {name:<6} │ {hm_m['max']:>10.4f} {hm_m['status'][0]:>3} │ {hm_u['max']:>10.4f} {hm_u['status'][0]:>3}")

    # Summary statistics
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)

    mean_masked = np.mean(all_errors_masked)
    mean_unmasked = np.mean(all_errors_unmasked)
    std_masked = np.std(all_errors_masked)
    std_unmasked = np.std(all_errors_unmasked)

    print(f"\n  WITH marker masking (like training):")
    print(f"    Mean error: {mean_masked:.1f}px ± {std_masked:.1f}px")
    print(f"    Range: {min(all_errors_masked):.1f}px - {max(all_errors_masked):.1f}px")

    print(f"\n  WITHOUT marker masking (like browser):")
    print(f"    Mean error: {mean_unmasked:.1f}px ± {std_unmasked:.1f}px")
    print(f"    Range: {min(all_errors_unmasked):.1f}px - {max(all_errors_unmasked):.1f}px")

    if mean_unmasked > mean_masked * 1.5:
        print(f"\n  ⚠️  Browser inference is significantly worse!")
        print(f"      The model was trained WITH marker masking.")
        print(f"      Browser needs to apply the same masking for good results.")
    elif mean_masked < 15 and mean_unmasked < 15:
        print(f"\n  ✓ Both modes show good accuracy (< 15px error)")
    elif mean_masked < 15:
        print(f"\n  ✓ With masking: Good accuracy")
        print(f"  ⚠ Without masking: Higher error - consider adding masking to browser")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Test boundary detector inference")
    parser.add_argument(
        "--model-dir",
        type=str,
        default="./public/models/abacus-boundary-detector",
        help="Directory containing the trained model"
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default="./data/vision-training/boundary-frames",
        help="Directory containing test images"
    )
    parser.add_argument(
        "--num-samples",
        type=int,
        default=5,
        help="Number of samples to test"
    )
    args = parser.parse_args()

    print("=" * 80)
    print("Boundary Detector Inference Test - Masked vs Unmasked Comparison")
    print("=" * 80)

    # Load model
    try:
        model = load_model(args.model_dir)
        print(f"Model loaded successfully")
    except Exception as e:
        print(f"Error loading model: {e}")
        sys.exit(1)

    # Load samples
    try:
        samples = load_sample_data(args.data_dir, args.num_samples)
        print(f"Loaded {len(samples)} samples")
    except Exception as e:
        print(f"Error loading samples: {e}")
        sys.exit(1)

    # Run comparison
    run_comparison(model, samples)

    print("\n" + "=" * 80)
    print("Test complete")
    print("=" * 80)


if __name__ == "__main__":
    main()
