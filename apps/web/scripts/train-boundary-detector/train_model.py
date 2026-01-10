#!/usr/bin/env python3
"""
Train a neural network to detect abacus boundary corners using heatmap regression.

Architecture:
- MobileNetV2 backbone (pretrained ImageNet)
- BiFPN-style feature fusion neck
- 4 heatmap outputs (one per corner: TL, TR, BL, BR)
- DSNT layer converts heatmaps to coordinates (differentiable)

Loss:
- Adaptive Wing Loss on heatmaps
- Smooth L1 on coordinates
- Convexity regularization

This approach outperforms direct coordinate regression for localization tasks.

Usage:
    python scripts/train-boundary-detector/train_model.py [options]

Options:
    --data-dir DIR      Training data directory (default: ./data/vision-training/boundary-frames)
    --output-dir DIR    Output directory for model (default: ./public/models/abacus-boundary-detector)
    --epochs N          Number of training epochs (default: 100)
    --batch-size N      Batch size (default: 16)
    --validation-split  Validation split ratio (default: 0.2)
    --json-progress     Output JSON progress for streaming to web UI
"""

import argparse
import base64
import io
import json
import os
import platform
import socket
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Tuple, List

import numpy as np

# Import marker masking (from same directory)
from marker_masking import mask_markers


def get_hardware_info() -> dict:
    """Detect available hardware for TensorFlow training."""
    result = {
        "device": "unknown",
        "deviceName": "Unknown",
        "deviceType": "unknown",
        "tensorflowVersion": None,
        "platform": platform.system(),
        "machine": platform.machine(),
        "processor": platform.processor(),
    }

    try:
        import tensorflow as tf

        result["tensorflowVersion"] = tf.__version__

        gpus = tf.config.list_physical_devices('GPU')
        is_apple_silicon = (
            platform.system() == "Darwin" and
            platform.machine() == "arm64"
        )

        if gpus:
            result["deviceType"] = "gpu"
            if is_apple_silicon:
                result["device"] = "metal"
                result["deviceName"] = "Apple Silicon GPU (Metal)"
                # Try to get chip info
                try:
                    import subprocess
                    sp_output = subprocess.check_output(
                        ["system_profiler", "SPHardwareDataType", "-json"],
                        text=True,
                        timeout=5
                    )
                    sp_data = json.loads(sp_output)
                    hardware = sp_data.get("SPHardwareDataType", [{}])[0]
                    chip_type = hardware.get("chip_type", "")
                    if chip_type:
                        result["deviceName"] = f"{chip_type} GPU (Metal)"
                        result["chipType"] = chip_type
                    memory = hardware.get("physical_memory", "")
                    if memory:
                        result["systemMemory"] = memory
                except Exception:
                    pass
            else:
                result["device"] = "cuda"
                result["deviceName"] = gpus[0].name
                result["gpuCount"] = len(gpus)
        else:
            result["device"] = "cpu"
            result["deviceType"] = "cpu"
            result["deviceName"] = "CPU"

    except ImportError:
        result["error"] = "TensorFlow not installed"
    except Exception as e:
        result["error"] = str(e)

    return result


def get_environment_info() -> dict:
    """Get information about the training environment."""
    return {
        "hostname": socket.gethostname(),
        "username": os.environ.get("USER", os.environ.get("USERNAME", "unknown")),
        "pythonVersion": platform.python_version(),
        "workingDirectory": os.getcwd(),
        "platform": platform.system(),
        "platformVersion": platform.version(),
        "architecture": platform.machine(),
    }


def emit_progress(event_type: str, data: dict, use_json: bool = False):
    """Emit a progress event, either as text or JSON."""
    if use_json:
        print(json.dumps({"event": event_type, **data}), flush=True)
    else:
        if event_type == "status":
            print(data.get("message", ""))
        elif event_type == "epoch":
            print(
                f"Epoch {data['epoch']}/{data['total_epochs']} - "
                f"loss: {data['loss']:.4f} - val_loss: {data['val_loss']:.4f} - "
                f"coord_mae: {data.get('coord_mae', 0):.4f}"
            )
        elif event_type == "complete":
            print(f"\nTraining complete! Final coord MAE: {data['final_mae']:.4f}")
        elif event_type == "error":
            print(f"Error: {data.get('message', 'Unknown error')}")


def generate_inference_samples(model, X_val, coords_val, num_samples: int = 5, image_size: int = 224):
    """
    Generate inference samples for visualization.

    Args:
        model: Trained model
        X_val: Validation images (N, H, W, 3) with values 0-1
        coords_val: Ground truth coordinates (N, 4, 2) normalized 0-1
        num_samples: Number of samples to generate
        image_size: Image size in pixels (for pixel error calculation)

    Returns:
        List of sample dicts with imageBase64, predicted, groundTruth, pixelError
    """
    import tensorflow as tf
    from PIL import Image

    # Select random indices (use consistent seed based on epoch for reproducibility)
    num_val = len(X_val)
    if num_val < num_samples:
        indices = list(range(num_val))
    else:
        indices = np.random.choice(num_val, size=num_samples, replace=False)

    samples = []
    for idx in indices:
        # Get image and ground truth
        image = X_val[idx]  # Shape: (224, 224, 3), values 0-1
        gt_coords = coords_val[idx]  # Shape: (4, 2), normalized 0-1

        # Run inference
        image_batch = np.expand_dims(image, axis=0)  # (1, 224, 224, 3)
        heatmaps = model(image_batch, training=False)  # (1, H, W, 4)

        # Decode heatmaps to coordinates using DSNT
        # Inline simplified DSNT decode for single sample
        hm = heatmaps[0].numpy()  # (H, W, 4)
        h, w, num_kp = hm.shape

        pred_coords = []
        for kp in range(num_kp):
            hm_kp = hm[:, :, kp]
            # Softmax normalization
            hm_kp = hm_kp - hm_kp.max()
            hm_kp = np.exp(hm_kp)
            hm_kp = hm_kp / (hm_kp.sum() + 1e-8)

            # Compute expected x, y coordinates
            x_range = np.linspace(0, 1, w)
            y_range = np.linspace(0, 1, h)

            expected_x = np.sum(hm_kp * x_range.reshape(1, -1))
            expected_y = np.sum(hm_kp * y_range.reshape(-1, 1))

            pred_coords.append([expected_x, expected_y])

        pred_coords = np.array(pred_coords)  # (4, 2)

        # Calculate pixel error for this sample
        pixel_errors = np.sqrt(np.sum((pred_coords - gt_coords) ** 2, axis=1)) * image_size
        mean_pixel_error = float(np.mean(pixel_errors))

        # Encode image as base64 JPEG
        img_uint8 = (image * 255).astype(np.uint8)
        pil_img = Image.fromarray(img_uint8)
        buffer = io.BytesIO()
        pil_img.save(buffer, format='JPEG', quality=80)
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        # Flatten coordinates to list: [tl_x, tl_y, tr_x, tr_y, br_x, br_y, bl_x, bl_y]
        # Model outputs: TL, TR, BL, BR (need to reorder to TL, TR, BR, BL for consistency)
        # Actually let's keep as TL, TR, BL, BR and handle in UI
        pred_flat = pred_coords.flatten().tolist()
        gt_flat = gt_coords.flatten().tolist()

        samples.append({
            "imageBase64": img_base64,
            "predicted": pred_flat,
            "groundTruth": gt_flat,
            "pixelError": mean_pixel_error
        })

    return samples


def parse_args():
    parser = argparse.ArgumentParser(description="Train abacus boundary detector (heatmap + DSNT)")
    parser.add_argument(
        "--data-dir",
        type=str,
        default="./data/vision-training/boundary-frames",
        help="Training data directory",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./public/models/abacus-boundary-detector",
        help="Output directory for model",
    )
    parser.add_argument(
        "--epochs", type=int, default=100, help="Number of training epochs"
    )
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size")
    parser.add_argument(
        "--validation-split",
        type=float,
        default=0.2,
        help="Validation split ratio",
    )
    parser.add_argument(
        "--heatmap-size",
        type=int,
        default=56,
        help="Size of output heatmaps (default: 56 for 224/4)",
    )
    parser.add_argument(
        "--heatmap-sigma",
        type=float,
        default=2.0,
        help="Gaussian sigma for heatmap generation",
    )
    parser.add_argument(
        "--json-progress",
        action="store_true",
        help="Output JSON progress for streaming to web UI",
    )
    parser.add_argument(
        "--no-augmentation",
        action="store_true",
        help="Disable data augmentation (ignored for boundary detector)",
    )
    parser.add_argument(
        "--color-augmentation",
        action="store_true",
        help="Enable color-only augmentation (brightness, contrast, saturation variations)",
    )
    parser.add_argument(
        "--no-marker-masking",
        action="store_true",
        help="Disable marker masking (for comparison testing - not recommended for production)",
    )
    parser.add_argument(
        "--stop-file",
        type=str,
        default=None,
        help="Path to a file that, when created, signals training to stop and save",
    )
    parser.add_argument(
        "--session-id",
        type=str,
        default=None,
        help="Session ID for tracking this training run (for session management)",
    )
    return parser.parse_args()


# =============================================================================
# Image Preprocessing
# =============================================================================

def resize_sample(image: np.ndarray, keypoints: List[Tuple[float, float]],
                  image_size: int = 224) -> Tuple[np.ndarray, List[Tuple[float, float]]]:
    """
    Resize image to target size. Keypoints are already normalized so they don't change.

    Args:
        image: Input image (H, W, 3) uint8
        keypoints: List of 4 (x, y) normalized coordinates (0-1)
        image_size: Target size

    Returns:
        Resized image and unchanged keypoints
    """
    from PIL import Image as PILImage

    img = PILImage.fromarray(image.astype(np.uint8))
    img = img.resize((image_size, image_size), PILImage.BILINEAR)

    # Keypoints are normalized (0-1) so they don't change with resize
    return np.array(img), keypoints


# =============================================================================
# Color Augmentation (No geometric transforms - those break corner labels)
# =============================================================================

def augment_brightness(image: np.ndarray, factor: float) -> np.ndarray:
    """
    Adjust image brightness.

    Args:
        image: Input image (H, W, 3) uint8
        factor: Brightness factor (1.0 = no change, >1 = brighter, <1 = darker)

    Returns:
        Brightness-adjusted image (H, W, 3) uint8
    """
    return np.clip(image.astype(np.float32) * factor, 0, 255).astype(np.uint8)


def augment_contrast(image: np.ndarray, factor: float) -> np.ndarray:
    """
    Adjust image contrast.

    Args:
        image: Input image (H, W, 3) uint8
        factor: Contrast factor (1.0 = no change, >1 = more contrast, <1 = less contrast)

    Returns:
        Contrast-adjusted image (H, W, 3) uint8
    """
    mean = np.mean(image, axis=(0, 1), keepdims=True)
    return np.clip((image.astype(np.float32) - mean) * factor + mean, 0, 255).astype(np.uint8)


def augment_saturation(image: np.ndarray, factor: float) -> np.ndarray:
    """
    Adjust image saturation.

    Args:
        image: Input image (H, W, 3) uint8 RGB
        factor: Saturation factor (1.0 = no change, >1 = more saturated, <1 = less/grayscale)

    Returns:
        Saturation-adjusted image (H, W, 3) uint8
    """
    # Convert to grayscale for desaturation reference
    gray = np.mean(image, axis=2, keepdims=True)
    return np.clip(gray + (image.astype(np.float32) - gray) * factor, 0, 255).astype(np.uint8)


def apply_color_augmentation(image: np.ndarray) -> List[np.ndarray]:
    """
    Apply color augmentation variations to an image.

    Returns multiple augmented versions (including original) with random
    brightness, contrast, and saturation adjustments.

    Args:
        image: Input image (H, W, 3) uint8

    Returns:
        List of augmented images including the original
    """
    augmented = [image]  # Always include original

    # Random brightness variations
    for _ in range(2):
        factor = np.random.uniform(0.7, 1.3)
        augmented.append(augment_brightness(image, factor))

    # Random contrast variations
    for _ in range(2):
        factor = np.random.uniform(0.7, 1.3)
        augmented.append(augment_contrast(image, factor))

    # Random saturation variations
    for _ in range(2):
        factor = np.random.uniform(0.5, 1.5)
        augmented.append(augment_saturation(image, factor))

    # Combined random adjustments
    for _ in range(2):
        img = image.copy()
        img = augment_brightness(img, np.random.uniform(0.8, 1.2))
        img = augment_contrast(img, np.random.uniform(0.8, 1.2))
        img = augment_saturation(img, np.random.uniform(0.7, 1.3))
        augmented.append(img)

    return augmented


# =============================================================================
# Heatmap Generation
# =============================================================================

def generate_heatmap(point: Tuple[float, float], size: int, sigma: float) -> np.ndarray:
    """
    Generate a Gaussian heatmap for a single keypoint.

    Args:
        point: (x, y) normalized coordinates (0-1)
        size: Output heatmap size
        sigma: Gaussian standard deviation

    Returns:
        Heatmap array of shape (size, size)
    """
    x, y = point

    # Create coordinate grids
    xx, yy = np.meshgrid(np.arange(size), np.arange(size))

    # Convert normalized coords to heatmap coords
    cx = x * size
    cy = y * size

    # Generate Gaussian
    heatmap = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sigma ** 2))

    return heatmap.astype(np.float32)


def generate_heatmaps(keypoints: List[Tuple[float, float]], size: int, sigma: float) -> np.ndarray:
    """
    Generate heatmaps for all 4 corners.

    Args:
        keypoints: List of 4 (x, y) normalized coordinates
        size: Output heatmap size
        sigma: Gaussian standard deviation

    Returns:
        Array of shape (size, size, 4)
    """
    heatmaps = np.stack([
        generate_heatmap(kp, size, sigma) for kp in keypoints
    ], axis=-1)

    return heatmaps


# =============================================================================
# Dataset Loading
# =============================================================================

def load_dataset(data_dir: str, image_size: int = 224, heatmap_size: int = 56,
                 heatmap_sigma: float = 2.0, use_json: bool = False,
                 apply_marker_masking: bool = True, color_augmentation: bool = False):
    """
    Load frames and their corner annotations.

    Args:
        data_dir: Directory containing training frames
        image_size: Target image size
        heatmap_size: Size of output heatmaps
        heatmap_sigma: Gaussian sigma for heatmap generation
        use_json: Output JSON progress events
        apply_marker_masking: Whether to mask ArUco markers (recommended True)
        color_augmentation: Whether to apply color augmentation (brightness/contrast/saturation)

    Returns:
        images: Array of images (N, H, W, 3) normalized to [0, 1]
        heatmaps: Array of heatmaps (N, heatmap_size, heatmap_size, 4)
        coords: Array of coordinates (N, 4, 2) normalized to [0, 1]
    """
    from PIL import Image as PILImage

    data_path = Path(data_dir)
    if not data_path.exists():
        emit_progress("error", {
            "message": f"Data directory not found: {data_dir}",
            "hint": "Collect boundary training data using the training wizard"
        }, use_json)
        sys.exit(1)

    # Find all PNG files
    png_files = list(data_path.glob("**/*.png"))
    total_files = len(png_files)

    emit_progress("loading_progress", {
        "step": "scanning",
        "current": 0,
        "total": total_files,
        "message": f"Found {total_files} files to process...",
        "phase": "loading"
    }, use_json)

    raw_samples = []
    skipped = 0

    for idx, png_path in enumerate(png_files):
        # Emit progress every 10 files or at start/end
        if idx % 10 == 0 or idx == total_files - 1:
            emit_progress("loading_progress", {
                "step": "loading_raw",
                "current": idx + 1,
                "total": total_files,
                "message": f"Loading raw frames... {idx + 1}/{total_files}",
                "phase": "loading"
            }, use_json)

        json_path = png_path.with_suffix(".json")

        if not json_path.exists():
            skipped += 1
            continue

        try:
            with open(json_path, "r") as f:
                annotation = json.load(f)

            corners = annotation.get("corners", {})
            if not all(k in corners for k in ["topLeft", "topRight", "bottomLeft", "bottomRight"]):
                skipped += 1
                continue

            # Load image
            img = PILImage.open(png_path).convert("RGB")
            img_array = np.array(img)

            # Extract keypoints in order: TL, TR, BL, BR
            keypoints = [
                (corners["topLeft"]["x"], corners["topLeft"]["y"]),
                (corners["topRight"]["x"], corners["topRight"]["y"]),
                (corners["bottomLeft"]["x"], corners["bottomLeft"]["y"]),
                (corners["bottomRight"]["x"], corners["bottomRight"]["y"]),
            ]

            # Apply marker masking to prevent model from learning marker patterns
            # The masking uses the corner positions to locate and obscure the ArUco markers
            if apply_marker_masking:
                try:
                    img_array = mask_markers(img_array, keypoints, method="noise")
                except Exception as mask_err:
                    # If masking fails, log warning but continue with unmasked image
                    emit_progress("status", {
                        "message": f"Warning: marker masking failed for {png_path.name}: {mask_err}",
                        "phase": "loading"
                    }, use_json)

            raw_samples.append((img_array, keypoints))

        except Exception as e:
            emit_progress("status", {
                "message": f"Error loading {png_path}: {e}",
                "phase": "loading"
            }, use_json)
            skipped += 1

    if not raw_samples:
        emit_progress("error", {
            "message": "No valid frames loaded",
            "hint": "Ensure frames have matching .json annotation files with corner data"
        }, use_json)
        sys.exit(1)

    # Process samples
    images = []
    all_heatmaps = []
    all_coords = []

    total_samples = len(raw_samples)
    augment_factor = 9 if color_augmentation else 1  # 9 augmented versions per original

    emit_progress("loading_progress", {
        "step": "processing",
        "current": 0,
        "total": total_samples,
        "message": f"Processing {total_samples} frames" + (f" with color augmentation (~{total_samples * augment_factor} total)..." if color_augmentation else "..."),
        "phase": "loading"
    }, use_json)

    for idx, (img_array, keypoints) in enumerate(raw_samples):
        # Generate heatmaps and coords (same for all augmented versions)
        heatmaps = generate_heatmaps(keypoints, heatmap_size, heatmap_sigma)
        coords = np.array(keypoints, dtype=np.float32)

        if color_augmentation:
            # Apply color augmentation (returns 9 versions including original)
            augmented_images = apply_color_augmentation(img_array)

            for aug_img in augmented_images:
                # Resize and normalize
                resized_img, _ = resize_sample(aug_img, keypoints, image_size)
                resized_img = resized_img.astype(np.float32) / 255.0

                images.append(resized_img)
                all_heatmaps.append(heatmaps)
                all_coords.append(coords)
        else:
            # No augmentation - just resize and normalize
            resized_img, _ = resize_sample(img_array, keypoints, image_size)
            resized_img = resized_img.astype(np.float32) / 255.0

            images.append(resized_img)
            all_heatmaps.append(heatmaps)
            all_coords.append(coords)

        # Emit progress every 10 samples
        if (idx + 1) % 10 == 0 or idx == total_samples - 1:
            emit_progress("loading_progress", {
                "step": "processing",
                "current": idx + 1,
                "total": total_samples,
                "message": f"Processing... {idx + 1}/{total_samples}" + (f" ({len(images)} with augmentation)" if color_augmentation else ""),
                "phase": "loading"
            }, use_json)

    emit_progress("loading_progress", {
        "step": "finalizing",
        "current": total_samples,
        "total": total_samples,
        "message": "Converting to tensors...",
        "phase": "loading"
    }, use_json)

    images = np.array(images)
    all_heatmaps = np.array(all_heatmaps)
    all_coords = np.array(all_coords)

    emit_progress("dataset_loaded", {
        "total_frames": len(images),
        "raw_frames": len(raw_samples),
        "skipped": skipped,
        "device_count": 1,  # UI expects this
        "image_shape": list(images.shape),
        "heatmap_shape": list(all_heatmaps.shape),
        "coords_shape": list(all_coords.shape),
        "marker_masking_enabled": apply_marker_masking,
        "color_augmentation_enabled": color_augmentation,
        "augment_factor": augment_factor,
        "phase": "loading"
    }, use_json)

    return images, all_heatmaps, all_coords


# =============================================================================
# Model Architecture
# =============================================================================

def create_model(input_shape: Tuple[int, int, int] = (224, 224, 3),
                 heatmap_size: int = 56,
                 num_corners: int = 4):
    """
    Create heatmap regression model with MobileNetV2 backbone and feature fusion.

    Architecture:
    - MobileNetV2 backbone (pretrained)
    - Multi-scale feature fusion (simplified BiFPN)
    - Heatmap output heads
    """
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers

    # Input
    inputs = keras.Input(shape=input_shape, name="input_image")

    # Preprocess for MobileNetV2 (expects [-1, 1])
    x = layers.Rescaling(scale=2.0, offset=-1.0)(inputs)

    # MobileNetV2 backbone
    backbone = keras.applications.MobileNetV2(
        input_shape=input_shape,
        include_top=False,
        weights="imagenet",
        alpha=1.0,  # Full width for better features
    )

    # Get multi-scale features
    layer_names = [
        "block_3_expand_relu",   # 56x56, 96 channels
        "block_6_expand_relu",   # 28x28, 144 channels
        "block_13_expand_relu",  # 14x14, 576 channels
    ]

    # Create a model that outputs intermediate features
    backbone_outputs = [backbone.get_layer(name).output for name in layer_names]
    feature_extractor = keras.Model(inputs=backbone.input, outputs=backbone_outputs)

    # Freeze early layers, fine-tune later layers
    for layer in backbone.layers[:100]:
        layer.trainable = False
    for layer in backbone.layers[100:]:
        layer.trainable = True

    # Extract features
    features = feature_extractor(x)
    f1, f2, f3 = features  # 56x56, 28x28, 14x14

    # Feature fusion (simplified BiFPN-style)
    # Process f3 (14x14)
    f3_conv = layers.Conv2D(128, 1, padding="same", activation="relu")(f3)
    f3_up = layers.UpSampling2D(size=(2, 2))(f3_conv)  # 28x28

    # Combine with f2 (28x28)
    f2_conv = layers.Conv2D(128, 1, padding="same", activation="relu")(f2)
    f2_combined = layers.Add()([f2_conv, f3_up])
    f2_combined = layers.Conv2D(128, 3, padding="same", activation="relu")(f2_combined)
    f2_up = layers.UpSampling2D(size=(2, 2))(f2_combined)  # 56x56

    # Combine with f1 (56x56)
    f1_conv = layers.Conv2D(128, 1, padding="same", activation="relu")(f1)
    f1_combined = layers.Add()([f1_conv, f2_up])
    f1_combined = layers.Conv2D(128, 3, padding="same", activation="relu")(f1_combined)

    # Heatmap heads
    x = layers.Conv2D(128, 3, padding="same", activation="relu")(f1_combined)
    x = layers.BatchNormalization()(x)
    x = layers.Conv2D(64, 3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)

    # Output heatmaps (one per corner)
    heatmaps = layers.Conv2D(
        num_corners,
        1,
        padding="same",
        activation="sigmoid",
        name="heatmaps"
    )(x)

    # Resize heatmaps to target size if needed
    if heatmap_size != 56:
        heatmaps = layers.Resizing(heatmap_size, heatmap_size, name="resize_heatmaps")(heatmaps)

    model = keras.Model(inputs=inputs, outputs=heatmaps, name="boundary_detector")

    return model


# =============================================================================
# Loss Functions
# =============================================================================

def adaptive_wing_loss(y_true, y_pred, omega=14, epsilon=1, alpha=2.1, theta=0.5):
    """
    Adaptive Wing Loss for heatmap regression.
    From: "Adaptive Wing Loss for Robust Face Alignment via Heatmap Regression" (ICCV 2019)
    """
    import tensorflow as tf

    delta = tf.abs(y_true - y_pred)

    # Adaptive weight based on ground truth
    weight = y_true ** alpha

    A = omega * (1 / (1 + tf.pow(theta / epsilon, alpha - y_true))) * \
        (alpha - y_true) * tf.pow(theta / epsilon, alpha - y_true - 1) / epsilon
    C = theta * A - omega * tf.math.log(1 + tf.pow(theta / epsilon, alpha - y_true))

    loss = tf.where(
        delta < theta,
        omega * tf.math.log(1 + tf.pow(delta / epsilon, alpha - y_true)),
        A * delta - C
    )

    weighted_loss = weight * loss + (1 - weight) * loss * 0.1

    return tf.reduce_mean(weighted_loss)


def dsnt_decode(heatmaps):
    """
    Differentiable Spatial to Numerical Transform.
    Converts heatmaps to normalized coordinates in a fully differentiable way.
    """
    import tensorflow as tf

    shape = tf.shape(heatmaps)
    batch_size = shape[0]
    height = shape[1]
    width = shape[2]
    num_keypoints = shape[3]

    # Create coordinate grids (0 to 1)
    x_range = tf.linspace(0.0, 1.0, width)
    y_range = tf.linspace(0.0, 1.0, height)

    # Reshape for broadcasting
    x_coords = tf.reshape(x_range, [1, 1, width, 1])
    y_coords = tf.reshape(y_range, [1, height, 1, 1])

    # Normalize heatmaps with softmax
    heatmaps_flat = tf.reshape(heatmaps, [batch_size, height * width, num_keypoints])
    heatmaps_softmax = tf.nn.softmax(heatmaps_flat * 10, axis=1)
    heatmaps_normalized = tf.reshape(heatmaps_softmax, [batch_size, height, width, num_keypoints])

    # Compute expected coordinates (soft-argmax)
    x = tf.reduce_sum(x_coords * heatmaps_normalized, axis=[1, 2])
    y = tf.reduce_sum(y_coords * heatmaps_normalized, axis=[1, 2])

    coords = tf.stack([x, y], axis=-1)

    return coords


def coordinate_loss(y_true_coords, pred_heatmaps):
    """Compute coordinate loss using DSNT decoded coordinates."""
    import tensorflow as tf

    pred_coords = dsnt_decode(pred_heatmaps)

    # Smooth L1 loss (Huber loss)
    diff = tf.abs(y_true_coords - pred_coords)
    loss = tf.where(diff < 1.0, 0.5 * diff ** 2, diff - 0.5)

    return tf.reduce_mean(loss)


def convexity_loss(pred_heatmaps):
    """Regularization loss to encourage convex quadrilaterals."""
    import tensorflow as tf

    coords = dsnt_decode(pred_heatmaps)  # (batch, 4, 2)

    # Corner order: TL, TR, BL, BR -> reorder to TL, TR, BR, BL for polygon
    tl = coords[:, 0, :]
    tr = coords[:, 1, :]
    bl = coords[:, 2, :]
    br = coords[:, 3, :]

    corners = tf.stack([tl, tr, br, bl], axis=1)

    def cross_product_2d(v1, v2):
        return v1[:, 0] * v2[:, 1] - v1[:, 1] * v2[:, 0]

    total_penalty = 0.0
    for i in range(4):
        p1 = corners[:, i, :]
        p2 = corners[:, (i + 1) % 4, :]
        p3 = corners[:, (i + 2) % 4, :]

        v1 = p2 - p1
        v2 = p3 - p2

        cross = cross_product_2d(v1, v2)
        total_penalty = total_penalty + tf.reduce_mean(tf.nn.relu(-cross))

    return total_penalty


# =============================================================================
# Training
# =============================================================================

def check_early_stop_signal(stop_file: str = None) -> bool:
    """Check if the user has requested early stop via a signal file."""
    if stop_file is None:
        return False
    try:
        stop_path = Path(stop_file)
        if stop_path.exists():
            # Remove the signal file and return True
            stop_path.unlink()
            return True
    except Exception:
        pass
    return False


def train_model(X_train, heatmaps_train, coords_train,
                X_val, heatmaps_val, coords_val,
                epochs=100, batch_size=16, heatmap_size=56,
                use_json=False, stop_file=None):
    """Train the boundary detection model with custom training loop."""
    import tensorflow as tf
    from tensorflow import keras

    emit_progress("status", {
        "message": "Creating model (loading MobileNetV2 backbone)...",
        "phase": "training",
        "step": "model_creation",
    }, use_json)

    model = create_model(
        input_shape=X_train.shape[1:],
        heatmap_size=heatmap_size,
        num_corners=4
    )

    if not use_json:
        model.summary()

    emit_progress("status", {
        "message": "Preparing training pipeline...",
        "phase": "training",
        "step": "pipeline_setup",
        "total_epochs": epochs,
        "batch_size": batch_size,
    }, use_json)

    # Optimizer with cosine decay
    lr_schedule = keras.optimizers.schedules.CosineDecay(
        initial_learning_rate=1e-3,
        decay_steps=epochs * len(X_train) // batch_size,
        alpha=1e-6
    )
    optimizer = keras.optimizers.Adam(learning_rate=lr_schedule)

    # Datasets
    train_ds = tf.data.Dataset.from_tensor_slices((X_train, heatmaps_train, coords_train))
    train_ds = train_ds.shuffle(len(X_train)).batch(batch_size).prefetch(tf.data.AUTOTUNE)

    val_ds = tf.data.Dataset.from_tensor_slices((X_val, heatmaps_val, coords_val))
    val_ds = val_ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)

    history = {"loss": [], "val_loss": [], "coord_mae": [], "val_coord_mae": []}
    best_val_loss = float('inf')
    best_weights = None
    patience = 8  # Stop after 8 epochs without meaningful improvement
    patience_counter = 0
    min_delta = 0.001  # Minimum improvement to reset patience

    @tf.function
    def train_step(images, heatmaps_true, coords_true):
        with tf.GradientTape() as tape:
            heatmaps_pred = model(images, training=True)

            heatmap_loss = adaptive_wing_loss(heatmaps_true, heatmaps_pred)
            coord_loss = coordinate_loss(coords_true, heatmaps_pred)
            conv_loss = convexity_loss(heatmaps_pred)

            total_loss = heatmap_loss + 0.5 * coord_loss + 0.01 * conv_loss

        gradients = tape.gradient(total_loss, model.trainable_variables)
        optimizer.apply_gradients(zip(gradients, model.trainable_variables))

        pred_coords = dsnt_decode(heatmaps_pred)
        coord_mae = tf.reduce_mean(tf.abs(coords_true - pred_coords))

        return total_loss, coord_mae

    @tf.function
    def val_step(images, heatmaps_true, coords_true):
        heatmaps_pred = model(images, training=False)

        heatmap_loss = adaptive_wing_loss(heatmaps_true, heatmaps_pred)
        coord_loss = coordinate_loss(coords_true, heatmaps_pred)
        conv_loss = convexity_loss(heatmaps_pred)

        total_loss = heatmap_loss + 0.5 * coord_loss + 0.01 * conv_loss

        pred_coords = dsnt_decode(heatmaps_pred)
        coord_mae = tf.reduce_mean(tf.abs(coords_true - pred_coords))

        return total_loss, coord_mae

    emit_progress("status", {
        "message": "Compiling TensorFlow graph (first epoch may be slow)...",
        "phase": "training",
        "step": "graph_compilation",
    }, use_json)

    # Calculate total batches for progress reporting
    train_batches = (len(X_train) + batch_size - 1) // batch_size  # Ceiling division

    for epoch in range(epochs):
        # Check for user-requested early stop at start of each epoch
        if check_early_stop_signal(stop_file):
            emit_progress("status", {
                "message": f"User requested early stop at epoch {epoch + 1}. Saving best model...",
                "phase": "training",
                "early_graduation": True
            }, use_json)
            break

        train_losses, train_maes = [], []
        for batch_idx, (images, heatmaps_true, coords_true) in enumerate(train_ds):
            # First batch of first epoch triggers graph compilation
            if epoch == 0 and batch_idx == 0:
                emit_progress("status", {
                    "message": "Running first batch (compiling graph)...",
                    "phase": "training",
                    "step": "first_batch",
                }, use_json)

            loss, mae = train_step(images, heatmaps_true, coords_true)
            train_losses.append(loss.numpy())
            train_maes.append(mae.numpy())

            # After first batch, confirm compilation is done
            if epoch == 0 and batch_idx == 0:
                emit_progress("status", {
                    "message": f"Graph compiled. Training epoch 1/{epochs}...",
                    "phase": "training",
                    "step": "training_started",
                }, use_json)

            # Report batch progress during first epoch (every 10 batches)
            if epoch == 0 and batch_idx > 0 and batch_idx % 10 == 0:
                emit_progress("status", {
                    "message": f"Epoch 1/{epochs}: batch {batch_idx + 1}/{train_batches}",
                    "phase": "training",
                    "step": "batch_progress",
                }, use_json)

        # Validation phase
        if epoch == 0:
            emit_progress("status", {
                "message": f"Epoch 1/{epochs}: running validation (compiling validation graph)...",
                "phase": "training",
                "step": "validation_compile",
            }, use_json)

        val_losses, val_maes = [], []
        for batch_idx, (images, heatmaps_true, coords_true) in enumerate(val_ds):
            loss, mae = val_step(images, heatmaps_true, coords_true)
            val_losses.append(loss.numpy())
            val_maes.append(mae.numpy())

            # After first validation batch of first epoch
            if epoch == 0 and batch_idx == 0:
                emit_progress("status", {
                    "message": f"Epoch 1/{epochs}: validation in progress...",
                    "phase": "training",
                    "step": "validation_progress",
                }, use_json)

        train_loss = np.mean(train_losses)
        val_loss = np.mean(val_losses)
        train_mae = np.mean(train_maes)
        val_mae = np.mean(val_maes)

        history["loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["coord_mae"].append(train_mae)
        history["val_coord_mae"].append(val_mae)

        # Convert normalized MAE to pixel error (image is 224x224)
        pixel_error = float(val_mae) * 224.0

        # Generate inference samples for visualization (5 random validation samples)
        if epoch == 0:
            emit_progress("status", {
                "message": f"Epoch 1/{epochs}: generating sample visualizations...",
                "phase": "training",
                "step": "generating_samples",
            }, use_json)
        inference_samples = generate_inference_samples(model, X_val, coords_val, num_samples=5)

        emit_progress("epoch", {
            "epoch": epoch + 1,
            "total_epochs": epochs,
            "loss": float(train_loss),
            "val_loss": float(val_loss),
            "coord_mae": float(train_mae),
            "val_coord_mae": float(val_mae),
            "accuracy": 1.0 - float(val_mae),
            "val_accuracy": 1.0 - float(val_mae),
            "val_pixel_error": pixel_error,  # Mean corner error in pixels
            "inference_samples": inference_samples,  # 5 sample inferences for visualization
            "phase": "training"
        }, use_json)

        # Only count as improvement if loss decreased by at least min_delta
        if val_loss < best_val_loss - min_delta:
            best_val_loss = val_loss
            patience_counter = 0
            best_weights = model.get_weights()
        else:
            patience_counter += 1
            if patience_counter >= patience:
                emit_progress("status", {
                    "message": f"Early stopping at epoch {epoch + 1} (no improvement for {patience} epochs)",
                    "phase": "training"
                }, use_json)
                break

    if best_weights:
        model.set_weights(best_weights)

    return model, history


# =============================================================================
# Export
# =============================================================================

def export_to_tfjs(model, output_dir: str, use_json: bool = False):
    """Export model to TensorFlow.js format."""
    import subprocess
    import tempfile
    import tensorflow as tf

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    emit_progress("status", {
        "message": "Exporting to TensorFlow.js format...",
        "phase": "exporting"
    }, use_json)

    for f in output_path.glob("*.bin"):
        f.unlink()
    model_json = output_path / "model.json"
    if model_json.exists():
        model_json.unlink()

    with tempfile.TemporaryDirectory() as tmpdir:
        saved_model_path = Path(tmpdir) / "saved_model"

        @tf.function(input_signature=[tf.TensorSpec(shape=[None, 224, 224, 3], dtype=tf.float32)])
        def serve(x):
            return model(x, training=False)

        tf.saved_model.save(model, str(saved_model_path), signatures={"serving_default": serve})

        cmd = [
            sys.executable, "-m", "tensorflowjs.converters.converter",
            "--input_format=tf_saved_model",
            "--output_format=tfjs_graph_model",
            "--signature_name=serving_default",
            str(saved_model_path),
            str(output_path),
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            emit_progress("status", {
                "message": f"TensorFlow.js conversion warning: {result.stderr[-500:] if result.stderr else 'unknown'}",
                "phase": "exporting"
            }, use_json)

    model_json_path = output_path / "model.json"
    if model_json_path.exists():
        weights_bin = list(output_path.glob("*.bin"))
        total_size = model_json_path.stat().st_size
        for w in weights_bin:
            total_size += w.stat().st_size

        emit_progress("exported", {
            "output_dir": str(output_path),
            "model_size_mb": round(total_size / 1024 / 1024, 2),
            "phase": "exporting"
        }, use_json)


def main():
    args = parse_args()
    use_json = args.json_progress

    # Record training start time
    training_start_time = time.time()
    training_start_iso = datetime.now().isoformat()

    if not use_json:
        print("=" * 60)
        print("Abacus Boundary Detector Training (Heatmap + DSNT)")
        print("=" * 60)

    # Gather hardware and environment info
    hardware_info = get_hardware_info()
    environment_info = get_environment_info()

    # Emit training_started event with all metadata
    emit_progress("training_started", {
        "session_id": args.session_id,
        "model_type": "boundary-detector",
        "started_at": training_start_iso,
        "config": {
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "validation_split": args.validation_split,
            "heatmap_size": args.heatmap_size,
            "heatmap_sigma": args.heatmap_sigma,
            "color_augmentation": args.color_augmentation,
            "marker_masking": not args.no_marker_masking,
        },
        "hardware": hardware_info,
        "environment": environment_info,
        "phase": "setup",
    }, use_json)

    # Check TensorFlow
    try:
        import tensorflow as tf

        gpus = tf.config.list_physical_devices("GPU")
        mps_devices = tf.config.list_physical_devices("MPS")

        device = "MPS (Apple Silicon)" if mps_devices else ("GPU" if gpus else "CPU")

        emit_progress("status", {
            "message": f"TensorFlow {tf.__version__} - Using {device}",
            "phase": "setup",
        }, use_json)

    except ImportError:
        emit_progress("error", {
            "message": "TensorFlow not installed",
            "hint": "Install with: pip install tensorflow"
        }, use_json)
        sys.exit(1)

    # Check tensorflowjs
    tfjs_available = False
    try:
        import tensorflowjs
        tfjs_available = True
    except ImportError:
        emit_progress("status", {
            "message": "TensorFlow.js converter not available - will skip JS export",
            "phase": "setup"
        }, use_json)

    # Load dataset
    apply_masking = not args.no_marker_masking
    if apply_masking:
        emit_progress("status", {
            "message": "Marker masking enabled - ArUco markers will be obscured in training data",
            "phase": "loading"
        }, use_json)
    else:
        emit_progress("status", {
            "message": "WARNING: Marker masking disabled - model may learn to detect markers instead of frame edges",
            "phase": "loading"
        }, use_json)

    if args.color_augmentation:
        emit_progress("status", {
            "message": "Color augmentation enabled - will generate ~9x training samples with brightness/contrast/saturation variations",
            "phase": "loading"
        }, use_json)

    images, heatmaps, coords = load_dataset(
        args.data_dir,
        image_size=224,
        heatmap_size=args.heatmap_size,
        heatmap_sigma=args.heatmap_sigma,
        use_json=use_json,
        apply_marker_masking=apply_masking,
        color_augmentation=args.color_augmentation,
    )

    if len(images) < 20:
        emit_progress("error", {
            "message": f"Insufficient training data: {len(images)} samples (need at least 20)",
            "hint": "Collect more boundary frames using the training wizard"
        }, use_json)
        sys.exit(1)

    # Split
    from sklearn.model_selection import train_test_split

    X_train, X_val, hm_train, hm_val, c_train, c_val = train_test_split(
        images, heatmaps, coords,
        test_size=args.validation_split,
        random_state=42
    )

    emit_progress("status", {
        "message": f"Split: {len(X_train)} training, {len(X_val)} validation",
        "phase": "loading",
    }, use_json)

    # Train
    model, history = train_model(
        X_train, hm_train, c_train,
        X_val, hm_val, c_val,
        epochs=args.epochs,
        batch_size=args.batch_size,
        heatmap_size=args.heatmap_size,
        use_json=use_json,
        stop_file=args.stop_file,
    )

    # Final evaluation
    import tensorflow as tf

    val_ds = tf.data.Dataset.from_tensor_slices((X_val, hm_val, c_val)).batch(args.batch_size)

    all_maes = []
    for images_batch, hm_true, coords_true in val_ds:
        hm_pred = model(images_batch, training=False)
        pred_coords = dsnt_decode(hm_pred)
        mae = tf.reduce_mean(tf.abs(coords_true - pred_coords))
        all_maes.append(mae.numpy())

    final_mae = np.mean(all_maes)

    # Save
    output_path = Path(args.output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    keras_path = output_path / "boundary-detector.keras"
    model.save(keras_path)
    emit_progress("status", {
        "message": f"Keras model saved to: {keras_path}",
        "phase": "saving"
    }, use_json)

    tfjs_exported = False
    if tfjs_available:
        try:
            export_to_tfjs(model, args.output_dir, use_json)
            # Verify the export actually created model.json
            model_json_path = output_path / "model.json"
            if model_json_path.exists():
                tfjs_exported = True
            else:
                emit_progress("status", {
                    "message": "WARNING: TensorFlow.js export completed but model.json not found",
                    "phase": "exporting"
                }, use_json)
        except Exception as e:
            emit_progress("status", {
                "message": f"TensorFlow.js export failed: {str(e)}",
                "phase": "exporting"
            }, use_json)
    else:
        emit_progress("status", {
            "message": "TensorFlow.js converter not available - skipping browser export",
            "phase": "exporting"
        }, use_json)

    # Save config
    preprocessing_config = {
        "model_type": "heatmap_dsnt",
        "input_size": 224,
        "heatmap_size": args.heatmap_size,
        "num_corners": 4,
        "corner_order": ["topLeft", "topRight", "bottomLeft", "bottomRight"],
        "trained_at": __import__("datetime").datetime.now().isoformat(),
        "training_samples": len(images),
        "final_coord_mae": float(final_mae),
    }
    preprocessing_path = output_path / "preprocessing.json"
    with open(preprocessing_path, "w") as f:
        json.dump(preprocessing_config, f, indent=2)

    # Convert MAE to pixel error for display (more intuitive than normalized MAE)
    final_pixel_error = float(final_mae) * 224.0

    # Calculate training duration
    training_end_time = time.time()
    training_end_iso = datetime.now().isoformat()
    training_duration_seconds = training_end_time - training_start_time

    # Build epoch history for graph
    epoch_history = []
    for i in range(len(history["loss"])):
        epoch_history.append({
            "epoch": i + 1,
            "loss": float(history["loss"][i]),
            "val_loss": float(history["val_loss"][i]),
            "coord_mae": float(history["coord_mae"][i]),
            "val_coord_mae": float(history["val_coord_mae"][i]),
            "val_pixel_error": float(history["val_coord_mae"][i]) * 224.0,
        })

    emit_progress("complete", {
        "final_accuracy": float(1.0 - final_mae),  # Legacy field for compatibility
        "final_loss": float(history["val_loss"][-1]) if history["val_loss"] else 0,
        "final_mae": float(final_mae),
        "final_pixel_error": final_pixel_error,  # Average corner error in pixels
        "epochs_trained": len(history["loss"]),
        "output_dir": args.output_dir,
        "model_type": "heatmap_dsnt",
        "tfjs_exported": tfjs_exported,  # Whether browser model was successfully created
        "session_id": args.session_id,  # Session ID for database tracking
        # Timing info
        "started_at": training_start_iso,
        "completed_at": training_end_iso,
        "training_duration_seconds": training_duration_seconds,
        # Full epoch history for graphs
        "epoch_history": epoch_history,
        # Hardware and environment (repeat for complete event)
        "hardware": hardware_info,
        "environment": environment_info,
        "phase": "complete"
    }, use_json)


if __name__ == "__main__":
    main()
