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


def create_model(input_shape=(128, 64, 1), num_classes=10):
    """Create a lightweight CNN for digit classification."""
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers

    model = keras.Sequential([
        # Input layer
        keras.Input(shape=input_shape),

        # Block 1: 32 filters
        layers.Conv2D(32, (3, 3), activation="relu", padding="same"),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),

        # Block 2: 64 filters
        layers.Conv2D(64, (3, 3), activation="relu", padding="same"),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),

        # Block 3: 128 filters
        layers.Conv2D(128, (3, 3), activation="relu", padding="same"),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),

        # Dense layers
        layers.Flatten(),
        layers.Dense(128, activation="relu"),
        layers.BatchNormalization(),
        layers.Dropout(0.5),
        layers.Dense(num_classes, activation="softmax"),
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    return model


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
        self.history = {"loss": [], "accuracy": [], "val_loss": [], "val_accuracy": []}

    def on_epoch_end(self, epoch, logs):
        self.history["loss"].append(logs.get("loss", 0))
        self.history["accuracy"].append(logs.get("accuracy", 0))
        self.history["val_loss"].append(logs.get("val_loss", 0))
        self.history["val_accuracy"].append(logs.get("val_accuracy", 0))

        emit_progress("epoch", {
            "epoch": epoch + 1,
            "total_epochs": self.total_epochs,
            "loss": float(logs.get("loss", 0)),
            "accuracy": float(logs.get("accuracy", 0)),
            "val_loss": float(logs.get("val_loss", 0)),
            "val_accuracy": float(logs.get("val_accuracy", 0)),
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
    """Train the model with optional data augmentation."""
    import tensorflow as tf
    from tensorflow import keras

    # Create model
    input_shape = X_train.shape[1:]
    model = create_model(input_shape=input_shape)

    if not use_json:
        model.summary()

    emit_progress("status", {
        "message": "Starting training...",
        "phase": "training",
        "total_epochs": epochs,
        "batch_size": batch_size,
        "use_augmentation": use_augmentation
    }, use_json)

    # Create augmentation if enabled
    if use_augmentation:
        augmentation = create_augmentation_layer()

        # Create augmented training dataset
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

    # Create a custom callback class that wraps our progress emitter
    class ProgressCallback(keras.callbacks.Callback):
        def on_epoch_end(self, epoch, logs=None):
            json_callback.on_epoch_end(epoch, logs or {})

    # Callbacks
    callbacks = [
        ProgressCallback(),
        keras.callbacks.EarlyStopping(
            monitor="val_accuracy",
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


def export_to_tfjs(model, output_dir: str, use_json: bool = False):
    """Export model to TensorFlow.js format with quantization."""
    import tensorflowjs as tfjs

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    emit_progress("status", {"message": "Exporting to TensorFlow.js format...", "phase": "exporting"}, use_json)

    # Export with quantization for smaller model size
    tfjs.converters.save_keras_model(
        model,
        str(output_path),
        quantization_dtype_map={"uint8": "*"},  # Quantize weights to uint8
    )

    # Check model size
    model_json = output_path / "model.json"
    weights_bin = list(output_path.glob("*.bin"))
    total_size = model_json.stat().st_size
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


def save_keras_model(model, output_dir: str, use_json: bool = False):
    """Save Keras model for potential further training."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    keras_path = output_path / "column-classifier.keras"
    model.save(keras_path)
    emit_progress("status", {"message": f"Keras model saved to: {keras_path}", "phase": "saving"}, use_json)


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
    try:
        import tensorflowjs
        tfjs_available = True
        emit_progress("status", {
            "message": f"TensorFlow.js converter available (v{tensorflowjs.__version__})",
            "phase": "setup"
        }, use_json)
    except (ImportError, AttributeError):
        emit_progress("status", {
            "message": "TensorFlow.js converter not available - will save Keras model only",
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

    # Evaluate final accuracy
    val_loss, val_acc = model.evaluate(X_val, y_val, verbose=0)

    # Save Keras model
    save_keras_model(model, args.output_dir, use_json)

    # Export to TensorFlow.js (if available)
    if tfjs_available:
        export_to_tfjs(model, args.output_dir, use_json)

    # Emit completion event
    emit_progress("complete", {
        "final_accuracy": float(val_acc),
        "final_loss": float(val_loss),
        "epochs_trained": len(history.history.get("loss", [])),
        "output_dir": args.output_dir,
        "tfjs_exported": tfjs_available,
        "phase": "complete"
    }, use_json)


if __name__ == "__main__":
    main()
