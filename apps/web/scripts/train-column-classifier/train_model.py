#!/usr/bin/env python3
"""
Train a CNN classifier for abacus column digit recognition.

This script:
1. Loads training images from the generated dataset
2. Trains a lightweight CNN (target: <2MB when quantized)
3. Exports to TensorFlow.js format

Usage:
    python scripts/train-column-classifier/train_model.py [options]

Options:
    --data-dir DIR      Training data directory (default: ./training-data/column-classifier)
    --output-dir DIR    Output directory for model (default: ./public/models/abacus-column-classifier)
    --epochs N          Number of training epochs (default: 50)
    --batch-size N      Batch size (default: 32)
    --validation-split  Validation split ratio (default: 0.2)
    --no-augmentation   Disable runtime augmentation
"""

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np


def parse_args():
    parser = argparse.ArgumentParser(description="Train abacus column classifier")
    parser.add_argument(
        "--data-dir",
        type=str,
        default="./training-data/column-classifier",
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
    return parser.parse_args()


def load_dataset(data_dir: str):
    """Load images and labels from the dataset directory."""
    from PIL import Image

    images = []
    labels = []

    data_path = Path(data_dir)
    if not data_path.exists():
        print(f"Error: Data directory not found: {data_dir}")
        print("Run the data generation script first:")
        print("  npx tsx scripts/train-column-classifier/generateTrainingData.ts")
        sys.exit(1)

    # Load metadata
    metadata_path = data_path / "metadata.json"
    if metadata_path.exists():
        with open(metadata_path) as f:
            metadata = json.load(f)
        print(f"Dataset info:")
        print(f"  Generated: {metadata.get('generatedAt', 'unknown')}")
        print(f"  Total samples: {metadata.get('totalSamples', 'unknown')}")
        print(f"  Image size: {metadata['config']['outputWidth']}x{metadata['config']['outputHeight']}")

    # Load images from each digit directory
    for digit in range(10):
        digit_dir = data_path / str(digit)
        if not digit_dir.exists():
            print(f"Warning: Missing digit directory: {digit_dir}")
            continue

        digit_images = list(digit_dir.glob("*.png"))
        print(f"  Digit {digit}: {len(digit_images)} images")

        for img_path in digit_images:
            try:
                img = Image.open(img_path).convert("L")  # Grayscale
                img_array = np.array(img, dtype=np.float32) / 255.0
                images.append(img_array)
                labels.append(digit)
            except Exception as e:
                print(f"Error loading {img_path}: {e}")

    if not images:
        print("Error: No images loaded")
        sys.exit(1)

    # Convert to numpy arrays
    X = np.array(images)
    y = np.array(labels)

    # Add channel dimension (for grayscale: H, W, 1)
    X = X[..., np.newaxis]

    print(f"\nLoaded {len(X)} images")
    print(f"Input shape: {X.shape}")
    print(f"Label distribution: {np.bincount(y)}")

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


def train_model(
    X_train,
    y_train,
    X_val,
    y_val,
    epochs=50,
    batch_size=32,
    use_augmentation=True,
):
    """Train the model with optional data augmentation."""
    import tensorflow as tf
    from tensorflow import keras

    # Create model
    input_shape = X_train.shape[1:]
    model = create_model(input_shape=input_shape)
    model.summary()

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

    # Callbacks
    callbacks = [
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

    # Train
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=epochs,
        callbacks=callbacks,
        verbose=1,
    )

    return model, history


def export_to_tfjs(model, output_dir: str):
    """Export model to TensorFlow.js format with quantization."""
    import tensorflowjs as tfjs

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Export with quantization for smaller model size
    tfjs.converters.save_keras_model(
        model,
        str(output_path),
        quantization_dtype_map={"uint8": "*"},  # Quantize weights to uint8
    )

    print(f"\nModel exported to: {output_path}")

    # Check model size
    model_json = output_path / "model.json"
    weights_bin = list(output_path.glob("*.bin"))
    total_size = model_json.stat().st_size
    for w in weights_bin:
        total_size += w.stat().st_size

    print(f"Model size: {total_size / 1024 / 1024:.2f} MB")

    if total_size > 2 * 1024 * 1024:
        print("Warning: Model exceeds 2MB target size")


def save_keras_model(model, output_dir: str):
    """Save Keras model for potential further training."""
    output_path = Path(output_dir)
    keras_path = output_path / "column-classifier.keras"
    model.save(keras_path)
    print(f"Keras model saved to: {keras_path}")


def main():
    args = parse_args()

    print("=" * 60)
    print("Abacus Column Classifier Training")
    print("=" * 60)

    # Check TensorFlow is available
    try:
        import tensorflow as tf
        print(f"TensorFlow version: {tf.__version__}")

        # Check for GPU
        gpus = tf.config.list_physical_devices("GPU")
        if gpus:
            print(f"GPU available: {len(gpus)} device(s)")
        else:
            print("No GPU detected, using CPU")
    except ImportError:
        print("Error: TensorFlow not installed")
        print("Install with: pip install tensorflow")
        sys.exit(1)

    # Check tensorflowjs is available (optional - can convert later)
    tfjs_available = False
    try:
        import tensorflowjs
        print(f"TensorFlow.js converter version: {tensorflowjs.__version__}")
        tfjs_available = True
    except (ImportError, AttributeError) as e:
        print(f"Note: tensorflowjs not available ({type(e).__name__})")
        print("Model will be saved as Keras format. Convert later with:")
        print("  tensorflowjs_converter --input_format=keras model.keras output_dir/")

    print()

    # Load dataset
    print("Loading dataset...")
    X, y = load_dataset(args.data_dir)

    # Split into train/validation
    from sklearn.model_selection import train_test_split

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=args.validation_split, stratify=y, random_state=42
    )

    print(f"\nTraining set: {len(X_train)} samples")
    print(f"Validation set: {len(X_val)} samples")

    # Train model
    print("\nTraining model...")
    model, history = train_model(
        X_train,
        y_train,
        X_val,
        y_val,
        epochs=args.epochs,
        batch_size=args.batch_size,
        use_augmentation=not args.no_augmentation,
    )

    # Evaluate final accuracy
    val_loss, val_acc = model.evaluate(X_val, y_val, verbose=0)
    print(f"\nFinal validation accuracy: {val_acc * 100:.2f}%")

    if val_acc < 0.95:
        print("Warning: Accuracy below 95% target")

    # Save Keras model
    save_keras_model(model, args.output_dir)

    # Export to TensorFlow.js (if available)
    if tfjs_available:
        print("\nExporting to TensorFlow.js format...")
        export_to_tfjs(model, args.output_dir)
    else:
        print("\nSkipping TensorFlow.js export (tensorflowjs not available)")
        print("Convert later with:")
        print(f"  tensorflowjs_converter --input_format=keras {args.output_dir}/column-classifier.keras {args.output_dir}")

    print("\nTraining complete!")
    print(f"Model files saved to: {args.output_dir}")


if __name__ == "__main__":
    main()
