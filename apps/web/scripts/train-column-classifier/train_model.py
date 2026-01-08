#!/usr/bin/env python3
"""
Train a CNN classifier for abacus column digit recognition.

This script:
1. Loads training images from collected real-world data
2. Trains a lightweight CNN (target: <2MB when quantized)
3. Exports to TensorFlow.js format

Usage:
    python scripts/train-column-classifier/train_model.py [options]

Options:
    --data-dir DIR      Training data directory (default: ./data/vision-training/collected)
    --output-dir DIR    Output directory for model (default: ./public/models/abacus-column-classifier)
    --epochs N          Number of training epochs (default: 50)
    --batch-size N      Batch size (default: 32)
    --validation-split  Validation split ratio (default: 0.2)
    --no-augmentation   Disable runtime augmentation
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
                f"loss: {data['loss']:.4f} - accuracy: {data['accuracy']:.4f} - "
                f"val_loss: {data['val_loss']:.4f} - val_accuracy: {data['val_accuracy']:.4f}"
            )
        elif event_type == "complete":
            print(f"\nTraining complete! Final accuracy: {data['final_accuracy']*100:.2f}%")
        elif event_type == "error":
            print(f"Error: {data.get('message', 'Unknown error')}")


def parse_args():
    parser = argparse.ArgumentParser(description="Train abacus column classifier")
    parser.add_argument(
        "--data-dir",
        type=str,
        default="./data/vision-training/collected",
        help="Training data directory",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./public/models/abacus-column-classifier",
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


def load_dataset(data_dir: str, use_json: bool = False):
    """Load images and labels from the collected data directory."""
    from PIL import Image

    images = []
    labels = []
    digit_counts = {}

    data_path = Path(data_dir)
    if not data_path.exists():
        emit_progress("error", {
            "message": f"Data directory not found: {data_dir}",
            "hint": "Sync training data from production first: ./scripts/sync-training-data.sh"
        }, use_json)
        sys.exit(1)

    emit_progress("status", {"message": f"Loading dataset from {data_dir}...", "phase": "loading"}, use_json)

    # Load images from each digit directory (0-9)
    for digit in range(10):
        digit_dir = data_path / str(digit)
        if not digit_dir.exists():
            digit_counts[digit] = 0
            continue

        digit_images = list(digit_dir.glob("*.png"))
        digit_counts[digit] = len(digit_images)

        for img_path in digit_images:
            try:
                img = Image.open(img_path).convert("L")  # Grayscale
                img_array = np.array(img, dtype=np.float32) / 255.0
                images.append(img_array)
                labels.append(digit)
            except Exception as e:
                emit_progress("status", {"message": f"Error loading {img_path}: {e}", "phase": "loading"}, use_json)

    if not images:
        emit_progress("error", {
            "message": "No images loaded",
            "hint": "Ensure training data exists in data/vision-training/collected/{0-9}/"
        }, use_json)
        sys.exit(1)

    # Convert to numpy arrays
    X = np.array(images)
    y = np.array(labels)

    # Add channel dimension (for grayscale: H, W, 1)
    X = X[..., np.newaxis]

    emit_progress("dataset_loaded", {
        "total_images": len(X),
        "input_shape": list(X.shape),
        "digit_counts": digit_counts,
        "phase": "loading"
    }, use_json)

    return X, y


def create_model(input_shape=(128, 64, 1), use_transfer_learning=True):
    """
    Create a two-head model for bead position detection.

    Instead of directly classifying digits 0-9, we detect:
    - Heaven bead: active (1) or inactive (0)
    - Earth beads: count of active beads (0-4)

    Digit = heaven * 5 + earth

    For small datasets (<1000 images), uses transfer learning with MobileNetV2.
    For larger datasets, can use a custom CNN.
    """
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers

    # Input (grayscale)
    inputs = keras.Input(shape=input_shape)

    if use_transfer_learning:
        # Convert grayscale to RGB by stacking 3x
        # This allows us to use pretrained ImageNet weights
        x = layers.Concatenate()([inputs, inputs, inputs])

        # MobileNetV2 expects input in [-1, 1] range
        # Our input is already [0, 1], so rescale to [-1, 1]
        x = layers.Rescaling(scale=2.0, offset=-1.0)(x)

        # Use MobileNetV2 as feature extractor
        # Using smaller alpha (0.35) for efficiency - still powerful for our task
        base_model = keras.applications.MobileNetV2(
            input_shape=(input_shape[0], input_shape[1], 3),
            include_top=False,
            weights="imagenet",
            alpha=0.35,  # Smaller model, faster training
        )

        # Freeze the base model initially
        base_model.trainable = False

        # Pass through base model
        x = base_model(x, training=False)

        # Global pooling to flatten spatial dimensions
        shared = layers.GlobalAveragePooling2D()(x)
        shared = layers.Dropout(0.3)(shared)

    else:
        # Original custom CNN for larger datasets
        x = layers.Conv2D(32, (3, 3), activation="relu", padding="same")(inputs)
        x = layers.BatchNormalization()(x)
        x = layers.MaxPooling2D((2, 2))(x)
        x = layers.Dropout(0.25)(x)

        x = layers.Conv2D(64, (3, 3), activation="relu", padding="same")(x)
        x = layers.BatchNormalization()(x)
        x = layers.MaxPooling2D((2, 2))(x)
        x = layers.Dropout(0.25)(x)

        x = layers.Conv2D(128, (3, 3), activation="relu", padding="same")(x)
        x = layers.BatchNormalization()(x)
        x = layers.MaxPooling2D((2, 2))(x)
        x = layers.Dropout(0.25)(x)

        shared = layers.Flatten()(x)
        shared = layers.Dense(128, activation="relu")(shared)
        shared = layers.BatchNormalization()(shared)
        shared = layers.Dropout(0.5)(shared)

    # Head 1: Heaven bead (binary: 0 or 1)
    heaven_branch = layers.Dense(64, activation="relu")(shared)
    heaven_branch = layers.Dropout(0.3)(heaven_branch)
    heaven_output = layers.Dense(1, activation="sigmoid", name="heaven")(heaven_branch)

    # Head 2: Earth beads (5-class: 0, 1, 2, 3, or 4 active)
    earth_branch = layers.Dense(64, activation="relu")(shared)
    earth_branch = layers.Dropout(0.3)(earth_branch)
    earth_output = layers.Dense(5, activation="softmax", name="earth")(earth_branch)

    model = keras.Model(inputs=inputs, outputs=[heaven_output, earth_output])

    # Compile with appropriate loss weights
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss={
            "heaven": "binary_crossentropy",
            "earth": "sparse_categorical_crossentropy",
        },
        loss_weights={"heaven": 1.5, "earth": 1.0},
        metrics={
            "heaven": ["accuracy"],
            "earth": ["accuracy"],
        },
    )

    return model


def digit_to_beads(digit):
    """Convert a digit (0-9) to bead positions (heaven, earth)."""
    heaven = 1 if digit >= 5 else 0
    earth = digit % 5
    return heaven, earth


def beads_to_digit(heaven, earth):
    """Convert bead positions to digit."""
    return int(heaven) * 5 + int(earth)


def create_augmentation_layer():
    """Create data augmentation layer for runtime augmentation."""
    import tensorflow as tf
    from tensorflow.keras import layers

    return tf.keras.Sequential([
        layers.RandomRotation(0.05),  # ±5% of 360° = ±18°
        layers.RandomZoom(0.1),  # ±10%
        layers.RandomBrightness(0.1),  # ±10%
    ])


class JSONProgressCallback:
    """Custom callback to emit JSON progress for each epoch."""

    def __init__(self, total_epochs: int, use_json: bool = False):
        self.total_epochs = total_epochs
        self.use_json = use_json
        self.history = {
            "loss": [], "val_loss": [],
            "heaven_accuracy": [], "val_heaven_accuracy": [],
            "earth_accuracy": [], "val_earth_accuracy": [],
        }

    def on_epoch_end(self, epoch, logs):
        # Multi-output model has separate metrics per head
        self.history["loss"].append(logs.get("loss", 0))
        self.history["val_loss"].append(logs.get("val_loss", 0))
        self.history["heaven_accuracy"].append(logs.get("heaven_accuracy", 0))
        self.history["val_heaven_accuracy"].append(logs.get("val_heaven_accuracy", 0))
        self.history["earth_accuracy"].append(logs.get("earth_accuracy", 0))
        self.history["val_earth_accuracy"].append(logs.get("val_earth_accuracy", 0))

        # Compute combined digit accuracy (both heads must be correct)
        heaven_acc = logs.get("val_heaven_accuracy", 0)
        earth_acc = logs.get("val_earth_accuracy", 0)
        # Approximate: if heads are independent, P(both correct) ≈ P(heaven) * P(earth)
        approx_digit_acc = heaven_acc * earth_acc

        # Training accuracy: use product of both heads as approximation
        train_heaven_acc = logs.get("heaven_accuracy", 0)
        train_earth_acc = logs.get("earth_accuracy", 0)
        train_digit_acc = train_heaven_acc * train_earth_acc

        emit_progress("epoch", {
            "epoch": epoch + 1,
            "total_epochs": self.total_epochs,
            "loss": float(logs.get("loss", 0)),
            "val_loss": float(logs.get("val_loss", 0)),
            # Main accuracy fields (used by UI) - approximate digit accuracy
            "accuracy": float(train_digit_acc),
            "val_accuracy": float(approx_digit_acc),
            # Detailed per-head metrics
            "heaven_accuracy": float(train_heaven_acc),
            "val_heaven_accuracy": float(heaven_acc),
            "earth_accuracy": float(train_earth_acc),
            "val_earth_accuracy": float(earth_acc),
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
    """Train the two-head model for bead position detection."""
    import tensorflow as tf
    from tensorflow import keras

    # Convert digit labels to bead positions
    y_train_heaven = np.array([digit_to_beads(d)[0] for d in y_train], dtype=np.float32)
    y_train_earth = np.array([digit_to_beads(d)[1] for d in y_train], dtype=np.int32)
    y_val_heaven = np.array([digit_to_beads(d)[0] for d in y_val], dtype=np.float32)
    y_val_earth = np.array([digit_to_beads(d)[1] for d in y_val], dtype=np.int32)

    # Create model
    input_shape = X_train.shape[1:]
    model = create_model(input_shape=input_shape)

    if not use_json:
        model.summary()

    # NOTE: We previously used sample weights for earth class imbalance, but this
    # was disrupting heaven head training (causing constant predictions).
    # The model should learn to handle the natural class distribution without weighting.
    # If earth accuracy suffers, consider class_weight in compile() instead of sample_weight.

    emit_progress("status", {
        "message": "Starting training (bead position detection)...",
        "phase": "training",
        "total_epochs": epochs,
        "batch_size": batch_size,
        "use_augmentation": use_augmentation,
        "heaven_distribution": {
            "active": int(np.sum(y_train_heaven)),
            "inactive": int(len(y_train_heaven) - np.sum(y_train_heaven))
        },
        "earth_distribution": {int(k): int(v) for k, v in zip(*np.unique(y_train_earth, return_counts=True))}
    }, use_json)

    # Create datasets with multi-output labels
    def make_label_dict(heaven, earth):
        return {"heaven": heaven, "earth": earth}

    if use_augmentation:
        augmentation = create_augmentation_layer()

        # Create augmented training dataset (no sample weights)
        train_ds = tf.data.Dataset.from_tensor_slices((
            X_train,
            {"heaven": y_train_heaven, "earth": y_train_earth}
        ))
        train_ds = train_ds.shuffle(len(X_train))
        train_ds = train_ds.map(
            lambda x, y: (augmentation(x, training=True), y),
            num_parallel_calls=tf.data.AUTOTUNE,
        )
        train_ds = train_ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)

        val_ds = tf.data.Dataset.from_tensor_slices((
            X_val,
            {"heaven": y_val_heaven, "earth": y_val_earth}
        ))
        val_ds = val_ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    else:
        train_ds = tf.data.Dataset.from_tensor_slices((
            X_train,
            {"heaven": y_train_heaven, "earth": y_train_earth}
        ))
        train_ds = train_ds.shuffle(len(X_train)).batch(batch_size).prefetch(tf.data.AUTOTUNE)

        val_ds = tf.data.Dataset.from_tensor_slices((
            X_val,
            {"heaven": y_val_heaven, "earth": y_val_earth}
        ))
        val_ds = val_ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)

    # JSON progress callback
    json_callback = JSONProgressCallback(epochs, use_json)

    # Create a custom callback class that wraps our progress emitter
    class ProgressCallback(keras.callbacks.Callback):
        def on_epoch_end(self, epoch, logs=None):
            json_callback.on_epoch_end(epoch, logs or {})

    # Callbacks
    callbacks = [
        ProgressCallback(),
        keras.callbacks.EarlyStopping(
            # Monitor total validation loss (combines both heads)
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

    # Train (verbose=0 when using JSON to avoid mixed output)
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=epochs,
        callbacks=callbacks,
        verbose=0 if use_json else 1,
    )

    return model, history


def export_to_tfjs(model, keras_path: str, output_dir: str, use_json: bool = False):
    """
    Export model to TensorFlow.js format with quantization.

    Uses SavedModel format as intermediate to avoid nested Functional model issues.
    The SavedModel format flattens the model graph, avoiding TensorFlow.js
    deserialization problems with nested models like MobileNetV2.
    """
    import subprocess
    import tempfile
    import shutil

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    emit_progress("status", {"message": "Exporting to TensorFlow.js format...", "phase": "exporting"}, use_json)

    # Clear output directory first (converter doesn't overwrite cleanly)
    for f in output_path.glob("*.bin"):
        f.unlink()
    model_json = output_path / "model.json"
    if model_json.exists():
        model_json.unlink()

    # First, save as SavedModel format (flattens the graph)
    with tempfile.TemporaryDirectory() as tmpdir:
        saved_model_path = Path(tmpdir) / "saved_model"
        model.export(str(saved_model_path), format="tf_saved_model")

        emit_progress("status", {
            "message": "Saved as TF SavedModel format, converting to TensorFlow.js...",
            "phase": "exporting"
        }, use_json)

        # Run tensorflowjs_converter on the SavedModel
        # Using tf_saved_model input format which handles nested models properly
        # IMPORTANT: Do NOT use --quantize_uint8 - it corrupts model weights!
        # See apps/web/.claude/CLAUDE.md "Quantization Corruption" section.
        # Model size increases (556KB → 2.2MB) but predictions are correct.
        cmd = [
            sys.executable, "-m", "tensorflowjs.converters.converter",
            "--input_format=tf_saved_model",
            "--output_format=tfjs_graph_model",
            str(saved_model_path),
            str(output_path),
        ]

        emit_progress("status", {"message": f"Running: {' '.join(cmd)}", "phase": "exporting"}, use_json)

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            emit_progress("status", {
                "message": f"SavedModel conversion failed: {result.stderr[:500]}. Trying keras format...",
                "phase": "exporting"
            }, use_json)

            # Fall back to Keras format conversion (no quantization!)
            cmd = [
                sys.executable, "-m", "tensorflowjs.converters.converter",
                "--input_format=keras",
                "--output_format=tfjs_layers_model",
                keras_path,
                str(output_path),
            ]

            emit_progress("status", {"message": f"Running: {' '.join(cmd)}", "phase": "exporting"}, use_json)
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode != 0:
                emit_progress("status", {
                    "message": f"tensorflowjs_converter failed: {result.stderr[:500]}",
                    "phase": "exporting"
                }, use_json)

                # Fall back to direct Python API save (no quantization!)
                emit_progress("status", {"message": "Falling back to direct Python API save...", "phase": "exporting"}, use_json)
                import tensorflowjs as tfjs
                tfjs.converters.save_keras_model(
                    model,
                    str(output_path),
                )

    # Patch for Keras 3.x compatibility (if we used layers_model format)
    model_json_path = output_path / "model.json"
    if model_json_path.exists():
        patch_model_json_for_tfjs(model_json_path, use_json)

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
            "exceeds_target": size_mb > 2.0,
            "phase": "exporting"
        }, use_json)
    else:
        emit_progress("status", {
            "message": "Warning: model.json not found after export",
            "phase": "exporting"
        }, use_json)


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


def save_keras_model(model, output_dir: str, use_json: bool = False) -> tuple[str, str]:
    """
    Save Keras model in both .keras (native) and .h5 (legacy) formats.
    Returns (keras_path, h5_path).

    We need .h5 for tensorflowjs converter compatibility (it doesn't support .keras format).
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Save in new .keras format
    keras_path = output_path / "column-classifier.keras"
    model.save(keras_path)
    emit_progress("status", {"message": f"Keras model saved to: {keras_path}", "phase": "saving"}, use_json)

    # Also save in legacy .h5 format for tensorflowjs converter
    h5_path = output_path / "column-classifier.h5"
    model.save(h5_path)
    emit_progress("status", {"message": f"H5 model saved to: {h5_path}", "phase": "saving"}, use_json)

    return str(keras_path), str(h5_path)


def main():
    args = parse_args()
    use_json = args.json_progress

    if not use_json:
        print("=" * 60)
        print("Abacus Column Classifier Training")
        print("=" * 60)

    # Check TensorFlow is available
    try:
        import tensorflow as tf

        # Check for GPU
        gpus = tf.config.list_physical_devices("GPU")
        mps_devices = tf.config.list_physical_devices("MPS")  # Apple Silicon

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

    # Check tensorflowjs is available
    tfjs_available = False
    tfjs_error = None
    try:
        import tensorflowjs
        tfjs_available = True
        emit_progress("status", {
            "message": f"TensorFlow.js converter available (v{tensorflowjs.__version__})",
            "phase": "setup"
        }, use_json)
    except ImportError as e:
        tfjs_error = f"ImportError: {str(e)}"
        emit_progress("status", {
            "message": f"TensorFlow.js converter not available - {tfjs_error}",
            "phase": "setup"
        }, use_json)
    except Exception as e:
        tfjs_error = f"{type(e).__name__}: {str(e)}"
        emit_progress("status", {
            "message": f"TensorFlow.js check failed - {tfjs_error}",
            "phase": "setup"
        }, use_json)

    # Load dataset
    X, y = load_dataset(args.data_dir, use_json)

    # Check minimum data requirements
    if len(X) < 50:
        emit_progress("error", {
            "message": f"Insufficient training data: {len(X)} images (need at least 50)",
            "hint": "Collect more training data using vision mode"
        }, use_json)
        sys.exit(1)

    # Split into train/validation
    from sklearn.model_selection import train_test_split

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=args.validation_split, stratify=y, random_state=42
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

    # Evaluate final accuracy (multi-output model)
    # Convert validation labels to bead positions
    y_val_heaven = np.array([digit_to_beads(d)[0] for d in y_val], dtype=np.float32)
    y_val_earth = np.array([digit_to_beads(d)[1] for d in y_val], dtype=np.int32)

    # Debug: Log model output names and metric names
    emit_progress("debug_model", {
        "output_names": model.output_names,
        "metrics_names": model.metrics_names,
        "y_val_heaven_shape": list(y_val_heaven.shape),
        "y_val_heaven_dtype": str(y_val_heaven.dtype),
        "y_val_heaven_distribution": {
            "zeros": int(np.sum(y_val_heaven == 0)),
            "ones": int(np.sum(y_val_heaven == 1)),
        },
    }, use_json)

    # Use return_dict=True for Keras 3.x compatibility (metric names are different)
    eval_results = model.evaluate(
        X_val,
        {"heaven": y_val_heaven, "earth": y_val_earth},
        verbose=0,
        return_dict=True
    )

    # Debug: Log all eval results
    emit_progress("debug_eval", {
        "eval_results": {k: float(v) for k, v in eval_results.items()},
    }, use_json)

    # Extract metrics from dict
    val_loss = eval_results.get("loss", 0)
    heaven_acc = eval_results.get("heaven_accuracy", 0)
    earth_acc = eval_results.get("earth_accuracy", 0)

    # Compute actual digit accuracy by checking both heads
    predictions = model.predict(X_val, verbose=0)
    heaven_preds = (predictions[0] > 0.5).astype(int).flatten()
    earth_preds = np.argmax(predictions[1], axis=1)
    digit_preds = heaven_preds * 5 + earth_preds
    digit_accuracy = np.mean(digit_preds == y_val)

    # Debug: Check if heaven predictions are inverted
    heaven_raw = predictions[0].flatten()
    heaven_true = y_val_heaven

    # Compute accuracy both ways
    normal_acc = np.mean((heaven_raw > 0.5) == heaven_true)
    inverted_acc = np.mean((heaven_raw <= 0.5) == heaven_true)

    emit_progress("debug_heaven", {
        "normal_accuracy": float(normal_acc),
        "inverted_accuracy": float(inverted_acc),
        "mean_prediction": float(np.mean(heaven_raw)),
        "std_prediction": float(np.std(heaven_raw)),
        "prediction_samples": [float(x) for x in heaven_raw[:10]],
        "true_labels_samples": [int(x) for x in heaven_true[:10]],
        "digits_samples": [int(x) for x in y_val[:10]],
        "heaven_distribution": {
            "true_0": int(np.sum(heaven_true == 0)),
            "true_1": int(np.sum(heaven_true == 1)),
        },
        "prediction_distribution": {
            "pred_0": int(np.sum(heaven_raw <= 0.5)),
            "pred_1": int(np.sum(heaven_raw > 0.5)),
        }
    }, use_json)

    # Save Keras model (both .keras and .h5 formats)
    keras_path, h5_path = save_keras_model(model, args.output_dir, use_json)

    # Export to TensorFlow.js (if available)
    # Use .h5 format because tensorflowjs converter doesn't support .keras format
    if tfjs_available:
        try:
            export_to_tfjs(model, h5_path, args.output_dir, use_json)
        except Exception as e:
            emit_progress("status", {
                "message": f"TensorFlow.js export failed: {str(e)}",
                "phase": "exporting"
            }, use_json)
            tfjs_available = False  # Mark as failed for completion event

    # Debug: Log tfjs export status
    emit_progress("debug_tfjs", {
        "tfjs_available": tfjs_available,
        "tfjs_error": tfjs_error,
    }, use_json)

    # Emit completion event
    emit_progress("complete", {
        "final_accuracy": float(digit_accuracy),
        "heaven_accuracy": float(heaven_acc),
        "earth_accuracy": float(earth_acc),
        "final_loss": float(val_loss),
        "epochs_trained": len(history.history.get("loss", [])),
        "output_dir": args.output_dir,
        "tfjs_exported": tfjs_available,
        "phase": "complete"
    }, use_json)


if __name__ == "__main__":
    main()
