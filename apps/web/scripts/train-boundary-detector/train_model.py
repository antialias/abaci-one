#!/usr/bin/env python3
"""
Train a neural network to detect abacus boundaries without markers.

This script:
1. Loads training frames with their corner annotations
2. Optionally applies marker inpainting to remove ArUco markers
3. Trains a MobileNetV2-based regression model for corner detection
4. Exports to TensorFlow.js format

Usage:
    python scripts/train-boundary-detector/train_model.py [options]

Options:
    --data-dir DIR      Training data directory (default: ./data/vision-training/boundary-frames)
    --output-dir DIR    Output directory for model (default: ./public/models/abacus-boundary-detector)
    --epochs N          Number of training epochs (default: 50)
    --batch-size N      Batch size (default: 32)
    --validation-split  Validation split ratio (default: 0.2)
    --inpaint-markers   Apply marker inpainting during loading
    --json-progress     Output JSON progress for streaming to web UI
"""

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np


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
                f"loss: {data['loss']:.4f} - val_loss: {data['val_loss']:.4f}"
            )
        elif event_type == "complete":
            print(f"\nTraining complete! Final MAE: {data['final_mae']:.4f}")
        elif event_type == "error":
            print(f"Error: {data.get('message', 'Unknown error')}")


def parse_args():
    parser = argparse.ArgumentParser(description="Train abacus boundary detector")
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
        "--epochs", type=int, default=50, help="Number of training epochs"
    )
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument(
        "--validation-split",
        type=float,
        default=0.2,
        help="Validation split ratio",
    )
    parser.add_argument(
        "--inpaint-markers",
        action="store_true",
        help="Apply marker inpainting to remove ArUco markers",
    )
    parser.add_argument(
        "--no-augmentation",
        action="store_true",
        help="Disable runtime augmentation",
    )
    parser.add_argument(
        "--json-progress",
        action="store_true",
        help="Output JSON progress for streaming to web UI",
    )
    return parser.parse_args()


def inpaint_marker_region(image: np.ndarray, center: tuple, size: int = 30) -> np.ndarray:
    """
    Simple marker inpainting using OpenCV if available, otherwise blur.

    Args:
        image: Input image (H, W, 3) or (H, W)
        center: (x, y) coordinates of marker center
        size: Size of marker region to inpaint

    Returns:
        Image with marker region inpainted
    """
    x, y = int(center[0]), int(center[1])
    h, w = image.shape[:2]
    half = size // 2

    # Bounds check
    x1 = max(0, x - half)
    x2 = min(w, x + half)
    y1 = max(0, y - half)
    y2 = min(h, y + half)

    if x2 <= x1 or y2 <= y1:
        return image

    try:
        import cv2
        # Create mask for the marker region
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.circle(mask, (x, y), half, 255, -1)

        # Use inpainting
        if len(image.shape) == 2:
            result = cv2.inpaint(image, mask, 3, cv2.INPAINT_TELEA)
        else:
            result = cv2.inpaint(image, mask, 3, cv2.INPAINT_TELEA)
        return result
    except ImportError:
        # Fallback: simple blur from surrounding pixels
        result = image.copy()

        # Sample surrounding pixels
        sample_half = half + 10
        sx1 = max(0, x - sample_half)
        sx2 = min(w, x + sample_half)
        sy1 = max(0, y - sample_half)
        sy2 = min(h, y + sample_half)

        surrounding = image[sy1:sy2, sx1:sx2]
        if len(image.shape) == 3:
            fill_color = surrounding.mean(axis=(0, 1)).astype(image.dtype)
        else:
            fill_color = surrounding.mean().astype(image.dtype)

        # Fill the marker region
        result[y1:y2, x1:x2] = fill_color
        return result


def inpaint_all_markers(image: np.ndarray, corners: dict, marker_size_ratio: float = 0.06) -> np.ndarray:
    """
    Inpaint all marker regions in an image.

    Args:
        image: Input image
        corners: Dict with topLeft, topRight, bottomLeft, bottomRight (normalized 0-1)
        marker_size_ratio: Size of markers as fraction of image width

    Returns:
        Image with all markers inpainted
    """
    h, w = image.shape[:2]
    marker_size = int(min(w, h) * marker_size_ratio)

    result = image.copy()
    for corner_name in ["topLeft", "topRight", "bottomLeft", "bottomRight"]:
        corner = corners.get(corner_name, {})
        cx = corner.get("x", 0) * w
        cy = corner.get("y", 0) * h
        result = inpaint_marker_region(result, (cx, cy), marker_size)

    return result


def load_dataset(data_dir: str, inpaint_markers: bool = False, use_json: bool = False):
    """
    Load frames and their corner annotations from the collected data directory.

    Expected structure:
    data_dir/
        {device_id}/
            {timestamp}_{random}.png
            {timestamp}_{random}.json  # Contains corners annotation

    Returns:
        X: Array of images (N, H, W, 3)
        y: Array of corner coordinates (N, 8) - [topLeft.x, topLeft.y, topRight.x, ...]
    """
    from PIL import Image

    images = []
    corners_list = []
    skipped = 0

    data_path = Path(data_dir)
    if not data_path.exists():
        emit_progress("error", {
            "message": f"Data directory not found: {data_dir}",
            "hint": "Collect boundary training data using the training wizard"
        }, use_json)
        sys.exit(1)

    emit_progress("status", {"message": f"Loading dataset from {data_dir}...", "phase": "loading"}, use_json)

    # Find all PNG files (may be in device subdirectories or root)
    png_files = list(data_path.glob("**/*.png"))

    for png_path in png_files:
        json_path = png_path.with_suffix(".json")

        if not json_path.exists():
            skipped += 1
            continue

        try:
            # Load annotation
            with open(json_path, "r") as f:
                annotation = json.load(f)

            corners = annotation.get("corners", {})
            if not all(k in corners for k in ["topLeft", "topRight", "bottomLeft", "bottomRight"]):
                skipped += 1
                continue

            # Load image
            img = Image.open(png_path).convert("RGB")
            img_array = np.array(img, dtype=np.float32)

            # Optional marker inpainting
            if inpaint_markers:
                img_array = inpaint_all_markers(img_array, corners)

            # Resize to standard input size (224x224 for MobileNetV2)
            img = Image.fromarray(img_array.astype(np.uint8))
            img = img.resize((224, 224), Image.BILINEAR)
            img_array = np.array(img, dtype=np.float32) / 255.0

            images.append(img_array)

            # Extract normalized corner coordinates (already 0-1 from capture)
            corner_coords = []
            for corner_name in ["topLeft", "topRight", "bottomLeft", "bottomRight"]:
                corner = corners[corner_name]
                corner_coords.extend([corner["x"], corner["y"]])

            corners_list.append(corner_coords)

        except Exception as e:
            emit_progress("status", {"message": f"Error loading {png_path}: {e}", "phase": "loading"}, use_json)
            skipped += 1

    if not images:
        emit_progress("error", {
            "message": "No valid frames loaded",
            "hint": "Ensure frames have matching .json annotation files with corner data"
        }, use_json)
        sys.exit(1)

    X = np.array(images)
    y = np.array(corners_list, dtype=np.float32)

    emit_progress("dataset_loaded", {
        "total_frames": len(X),
        "skipped": skipped,
        "input_shape": list(X.shape),
        "output_shape": list(y.shape),
        "phase": "loading"
    }, use_json)

    return X, y


def create_model(input_shape=(224, 224, 3)):
    """
    Create a MobileNetV2-based model for corner regression.

    Output: 8 values (4 corners × 2 coordinates), all in [0, 1] range.
    """
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers

    # Use MobileNetV2 as feature extractor
    base_model = keras.applications.MobileNetV2(
        input_shape=input_shape,
        include_top=False,
        weights="imagenet",
        alpha=0.5,  # Smaller model for efficiency
    )

    # Freeze early layers, allow fine-tuning of later layers
    for layer in base_model.layers[:100]:
        layer.trainable = False
    for layer in base_model.layers[100:]:
        layer.trainable = True

    inputs = keras.Input(shape=input_shape)

    # MobileNetV2 expects input in [-1, 1] range
    x = layers.Rescaling(scale=2.0, offset=-1.0)(inputs)

    # Pass through base model
    x = base_model(x, training=True)

    # Global pooling
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)

    # Regression head for 8 corner coordinates
    x = layers.Dense(256, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.Dropout(0.2)(x)

    # Output: 8 values with sigmoid activation (corners are normalized to [0, 1])
    outputs = layers.Dense(8, activation="sigmoid", name="corners")(x)

    model = keras.Model(inputs=inputs, outputs=outputs)

    # Compile with MSE loss for regression
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss="mse",
        metrics=["mae"],
    )

    return model


def create_augmentation_layer():
    """Create data augmentation layer for runtime augmentation."""
    import tensorflow as tf
    from tensorflow.keras import layers

    return tf.keras.Sequential([
        layers.RandomBrightness(0.1),
        layers.RandomContrast(0.1),
    ])


class JSONProgressCallback:
    """Custom callback to emit JSON progress for each epoch."""

    def __init__(self, total_epochs: int, use_json: bool = False):
        self.total_epochs = total_epochs
        self.use_json = use_json
        self.history = {"loss": [], "val_loss": [], "mae": [], "val_mae": []}

    def on_epoch_end(self, epoch, logs):
        self.history["loss"].append(logs.get("loss", 0))
        self.history["val_loss"].append(logs.get("val_loss", 0))
        self.history["mae"].append(logs.get("mae", 0))
        self.history["val_mae"].append(logs.get("val_mae", 0))

        emit_progress("epoch", {
            "epoch": epoch + 1,
            "total_epochs": self.total_epochs,
            "loss": float(logs.get("loss", 0)),
            "val_loss": float(logs.get("val_loss", 0)),
            "accuracy": 1.0 - float(logs.get("val_mae", 0)),  # Convert MAE to pseudo-accuracy for UI
            "val_accuracy": 1.0 - float(logs.get("val_mae", 0)),
            "mae": float(logs.get("mae", 0)),
            "val_mae": float(logs.get("val_mae", 0)),
            "phase": "training"
        }, self.use_json)


def train_model(
    X_train,
    y_train,
    X_val,
    y_val,
    epochs=50,
    batch_size=32,
    use_augmentation=True,
    use_json=False,
):
    """Train the boundary detection model."""
    import tensorflow as tf
    from tensorflow import keras

    model = create_model(input_shape=X_train.shape[1:])

    if not use_json:
        model.summary()

    emit_progress("status", {
        "message": "Starting training (corner regression)...",
        "phase": "training",
        "total_epochs": epochs,
        "batch_size": batch_size,
        "use_augmentation": use_augmentation,
    }, use_json)

    # Create datasets
    if use_augmentation:
        augmentation = create_augmentation_layer()

        train_ds = tf.data.Dataset.from_tensor_slices((X_train, y_train))
        train_ds = train_ds.shuffle(len(X_train))
        train_ds = train_ds.map(
            lambda x, y: (augmentation(x, training=True), y),
            num_parallel_calls=tf.data.AUTOTUNE,
        )
        train_ds = train_ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)

        val_ds = tf.data.Dataset.from_tensor_slices((X_val, y_val))
        val_ds = val_ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    else:
        train_ds = tf.data.Dataset.from_tensor_slices((X_train, y_train))
        train_ds = train_ds.shuffle(len(X_train)).batch(batch_size).prefetch(tf.data.AUTOTUNE)

        val_ds = tf.data.Dataset.from_tensor_slices((X_val, y_val))
        val_ds = val_ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)

    # JSON progress callback
    json_callback = JSONProgressCallback(epochs, use_json)

    class ProgressCallback(keras.callbacks.Callback):
        def on_epoch_end(self, epoch, logs=None):
            json_callback.on_epoch_end(epoch, logs or {})

    # Callbacks
    callbacks = [
        ProgressCallback(),
        keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=10,
            restore_best_weights=True,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=5,
            min_lr=1e-6,
        ),
    ]

    # Train
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=epochs,
        callbacks=callbacks,
        verbose=0 if use_json else 1,
    )

    return model, history


def _patch_layers_recursive(layers, patches_applied, depth=0):
    """
    Recursively patch layers for TensorFlow.js compatibility.
    Handles nested Functional models (like MobileNetV2).
    Returns the number of layers patched.
    """
    layers_patched = 0

    for layer in layers:
        # Fix 1: batch_shape -> batchInputShape in InputLayer
        if layer.get("class_name") == "InputLayer":
            config = layer.get("config", {})
            if "batch_shape" in config and "batchInputShape" not in config:
                config["batchInputShape"] = config.pop("batch_shape")
                if depth == 0:
                    patches_applied.append("batch_shape -> batchInputShape")

        # Fix 2: Convert inbound_nodes from dict format to array format
        inbound_nodes = layer.get("inbound_nodes", [])
        if inbound_nodes and isinstance(inbound_nodes[0], dict):
            # Keras 3.x format: list of dicts with "args" and "kwargs"
            new_inbound_nodes = []

            for node in inbound_nodes:
                node_connections = []
                args = node.get("args", [])

                # Handle list arguments (for layers like Concatenate, Add)
                if args and isinstance(args[0], list):
                    # Args is a list of keras tensors wrapped in a list
                    for tensor_list in args:
                        if isinstance(tensor_list, list):
                            for arg in tensor_list:
                                if isinstance(arg, dict) and arg.get("class_name") == "__keras_tensor__":
                                    history = arg.get("config", {}).get("keras_history", [])
                                    if len(history) >= 3:
                                        node_connections.append([history[0], history[1], history[2], {}])
                else:
                    # Single tensor argument
                    for arg in args:
                        if isinstance(arg, dict) and arg.get("class_name") == "__keras_tensor__":
                            history = arg.get("config", {}).get("keras_history", [])
                            if len(history) >= 3:
                                node_connections.append([history[0], history[1], history[2], {}])

                if node_connections:
                    new_inbound_nodes.append(node_connections)

            if new_inbound_nodes:
                layer["inbound_nodes"] = new_inbound_nodes
                layers_patched += 1

        # Recursively process nested Functional models (like MobileNetV2)
        if layer.get("class_name") == "Functional":
            nested_config = layer.get("config", {})
            nested_layers = nested_config.get("layers", [])

            # Fix input_layers/output_layers in nested model
            if "input_layers" in nested_config:
                input_layers = nested_config.pop("input_layers")
                if input_layers and not isinstance(input_layers[0], list):
                    input_layers = [input_layers]
                nested_config["inputLayers"] = input_layers
                if depth == 0:
                    patches_applied.append("nested input_layers -> inputLayers")

            if "output_layers" in nested_config:
                output_layers = nested_config.pop("output_layers")
                if output_layers and not isinstance(output_layers[0], list):
                    output_layers = [output_layers]
                nested_config["outputLayers"] = output_layers
                if depth == 0:
                    patches_applied.append("nested output_layers -> outputLayers")

            # Recursively patch nested layers
            layers_patched += _patch_layers_recursive(nested_layers, patches_applied, depth + 1)

    return layers_patched


def patch_model_json_for_tfjs(model_json_path: Path, use_json: bool = False):
    """
    Patch model.json for TensorFlow.js compatibility.

    Keras 3.x exports models with several incompatibilities that TensorFlow.js cannot load:

    1. InputLayer uses "batch_shape" but TensorFlow.js expects "batchInputShape"

    2. inbound_nodes use a dict format:
       {"args": [{"class_name": "__keras_tensor__", "config": {"keras_history": ["layer_name", 0, 0]}}], "kwargs": {...}}
       But TensorFlow.js expects an array format:
       [[["layer_name", 0, 0, {}]]]

    3. Model config uses snake_case: "input_layers", "output_layers"
       But TensorFlow.js expects camelCase: "inputLayers", "outputLayers"

    4. input_layers may be a flat array [name, 0, 0] instead of nested [[name, 0, 0]]

    5. Nested Functional models (like MobileNetV2) need the same patches recursively applied.

    This function patches all issues to make the model loadable in TensorFlow.js.
    """
    emit_progress("status", {
        "message": f"Patching model.json at {model_json_path}...",
        "phase": "exporting"
    }, use_json)

    if not model_json_path.exists():
        emit_progress("status", {
            "message": f"Warning: model.json not found at {model_json_path}",
            "phase": "exporting"
        }, use_json)
        return

    with open(model_json_path, "r") as f:
        model_data = json.load(f)

    patches_applied = []
    layers_patched = 0

    try:
        model_config = model_data["modelTopology"]["model_config"]["config"]
        layers = model_config["layers"]

        emit_progress("status", {
            "message": f"Found {len(layers)} top-level layers to check",
            "phase": "exporting"
        }, use_json)

        # Fix 3 & 4: Convert input_layers/output_layers to inputLayers/outputLayers
        if "input_layers" in model_config:
            input_layers = model_config.pop("input_layers")
            # Ensure it's a nested array [[name, idx, tensor_idx], ...]
            if input_layers and not isinstance(input_layers[0], list):
                # It's a flat array [name, idx, tensor_idx], wrap it
                input_layers = [input_layers]
            model_config["inputLayers"] = input_layers
            patches_applied.append("input_layers -> inputLayers")

        if "output_layers" in model_config:
            output_layers = model_config.pop("output_layers")
            # Ensure it's a nested array
            if output_layers and not isinstance(output_layers[0], list):
                output_layers = [output_layers]
            model_config["outputLayers"] = output_layers
            patches_applied.append("output_layers -> outputLayers")

        # Recursively patch all layers including nested Functional models
        layers_patched = _patch_layers_recursive(layers, patches_applied)

        if layers_patched > 0:
            patches_applied.append(f"inbound_nodes dict->array ({layers_patched} layers)")

    except (KeyError, TypeError) as e:
        emit_progress("status", {
            "message": f"Warning: Could not patch model.json: {e}",
            "phase": "exporting"
        }, use_json)
        return

    if patches_applied:
        with open(model_json_path, "w") as f:
            json.dump(model_data, f)
        emit_progress("status", {
            "message": f"Patched model.json for TensorFlow.js compatibility: {', '.join(patches_applied)}",
            "phase": "exporting"
        }, use_json)
    else:
        emit_progress("status", {
            "message": "No patches needed - model.json already compatible",
            "phase": "exporting"
        }, use_json)


def export_to_tfjs(model, keras_path: str, output_dir: str, use_json: bool = False):
    """
    Export model to TensorFlow.js graph-model format.

    Uses tf.saved_model.save() with explicit signatures to create a SavedModel,
    then converts to TensorFlow.js graph-model format. This avoids issues with
    MobileNetV2's nested Functional model that occur with save_keras_model().

    The graph-model format is more compact and loads faster than layers-model.
    """
    import subprocess
    import tempfile
    import tensorflow as tf

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    emit_progress("status", {"message": "Exporting to TensorFlow.js format...", "phase": "exporting"}, use_json)

    # Clear output directory (old .bin files)
    for f in output_path.glob("*.bin"):
        f.unlink()
    model_json = output_path / "model.json"
    if model_json.exists():
        model_json.unlink()

    # Use SavedModel with explicit signatures (works with nested Functional models)
    with tempfile.TemporaryDirectory() as tmpdir:
        saved_model_path = Path(tmpdir) / "saved_model"

        emit_progress("status", {
            "message": "Creating SavedModel with explicit signature...",
            "phase": "exporting"
        }, use_json)

        # Create a concrete function from the model with explicit input signature
        @tf.function(input_signature=[tf.TensorSpec(shape=[None, 224, 224, 3], dtype=tf.float32)])
        def serve(x):
            return model(x, training=False)

        # Save with concrete function signature
        tf.saved_model.save(model, str(saved_model_path), signatures={"serving_default": serve})

        emit_progress("status", {
            "message": "Converting to TensorFlow.js graph model...",
            "phase": "exporting"
        }, use_json)

        # Convert to TensorFlow.js graph model
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
                "message": f"Conversion failed: {result.stderr[-500:]}",
                "phase": "exporting"
            }, use_json)
            raise RuntimeError(f"TensorFlow.js conversion failed: {result.stderr}")

    # Check model size
    model_json_path = output_path / "model.json"
    if model_json_path.exists():
        weights_bin = list(output_path.glob("*.bin"))
        total_size = model_json_path.stat().st_size
        for w in weights_bin:
            total_size += w.stat().st_size

        size_mb = total_size / 1024 / 1024

        emit_progress("exported", {
            "output_dir": str(output_path),
            "model_size_mb": round(size_mb, 2),
            "model_size_bytes": total_size,
            "phase": "exporting"
        }, use_json)
    else:
        emit_progress("status", {
            "message": "Warning: model.json not found after export",
            "phase": "exporting"
        }, use_json)


def save_keras_model(model, output_dir: str, use_json: bool = False) -> tuple:
    """Save Keras model in both .keras and .h5 formats."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    keras_path = output_path / "boundary-detector.keras"
    model.save(keras_path)
    emit_progress("status", {"message": f"Keras model saved to: {keras_path}", "phase": "saving"}, use_json)

    h5_path = output_path / "boundary-detector.h5"
    model.save(h5_path)
    emit_progress("status", {"message": f"H5 model saved to: {h5_path}", "phase": "saving"}, use_json)

    return str(keras_path), str(h5_path)


def main():
    args = parse_args()
    use_json = args.json_progress

    if not use_json:
        print("=" * 60)
        print("Abacus Boundary Detector Training")
        print("=" * 60)

    # Check TensorFlow
    try:
        import tensorflow as tf

        gpus = tf.config.list_physical_devices("GPU")
        mps_devices = tf.config.list_physical_devices("MPS")

        gpu_info = {
            "tensorflow_version": tf.__version__,
            "gpu_count": len(gpus),
            "mps_available": len(mps_devices) > 0,
            "device": "MPS (Apple Silicon)" if mps_devices else ("GPU" if gpus else "CPU")
        }

        emit_progress("status", {
            "message": f"TensorFlow {tf.__version__} - Using {gpu_info['device']}",
            "phase": "setup",
            **gpu_info
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
        emit_progress("status", {
            "message": f"TensorFlow.js converter available (v{tensorflowjs.__version__})",
            "phase": "setup"
        }, use_json)
    except ImportError:
        emit_progress("status", {
            "message": "TensorFlow.js converter not available",
            "phase": "setup"
        }, use_json)

    # Load dataset
    X, y = load_dataset(args.data_dir, args.inpaint_markers, use_json)

    # Check minimum data requirements
    if len(X) < 50:
        emit_progress("error", {
            "message": f"Insufficient training data: {len(X)} frames (need at least 50)",
            "hint": "Collect more boundary frames using the training wizard"
        }, use_json)
        sys.exit(1)

    # Split into train/validation
    from sklearn.model_selection import train_test_split

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=args.validation_split, random_state=42
    )

    emit_progress("status", {
        "message": f"Split: {len(X_train)} training, {len(X_val)} validation",
        "phase": "loading",
        "train_count": len(X_train),
        "val_count": len(X_val)
    }, use_json)

    # Train model
    model, history = train_model(
        X_train,
        y_train,
        X_val,
        y_val,
        epochs=args.epochs,
        batch_size=args.batch_size,
        use_augmentation=not args.no_augmentation,
        use_json=use_json,
    )

    # Evaluate
    eval_results = model.evaluate(X_val, y_val, verbose=0, return_dict=True)
    final_mae = eval_results.get("mae", 0)
    final_loss = eval_results.get("loss", 0)

    # Save Keras model
    keras_path, h5_path = save_keras_model(model, args.output_dir, use_json)

    # Export to TensorFlow.js
    if tfjs_available:
        try:
            export_to_tfjs(model, h5_path, args.output_dir, use_json)
        except Exception as e:
            emit_progress("status", {
                "message": f"TensorFlow.js export failed: {str(e)}",
                "phase": "exporting"
            }, use_json)
            tfjs_available = False

    # Emit completion
    emit_progress("complete", {
        "final_accuracy": 1.0 - final_mae,  # Pseudo-accuracy for UI
        "final_mae": float(final_mae),
        "final_loss": float(final_loss),
        "epochs_trained": len(history.history.get("loss", [])),
        "output_dir": args.output_dir,
        "tfjs_exported": tfjs_available,
        "phase": "complete"
    }, use_json)


if __name__ == "__main__":
    main()
