#!/usr/bin/env python3
"""
Test the boundary detector model locally with a sample image.
Compares Python predictions with what the browser should produce.

Usage:
    python scripts/test_boundary_model.py <image_path>
    python scripts/test_boundary_model.py data/vision-training/boundary-frames/device123/frame001.png
"""

import sys
import os
from pathlib import Path
import json

# Add the training scripts to path
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
from PIL import Image

# Try to import TensorFlow
try:
    import tensorflow as tf
    print(f"TensorFlow version: {tf.__version__}")
except ImportError:
    print("TensorFlow not installed. Run: pip install tensorflow")
    sys.exit(1)


def load_model():
    """Load the boundary detector model."""
    model_dir = Path(__file__).parent.parent / "public/models/abacus-boundary-detector"
    model_path = model_dir / "model.json"

    if not model_path.exists():
        print(f"Model not found at: {model_path}")
        sys.exit(1)

    print(f"Loading model from: {model_dir}")

    # Try loading as SavedModel format first (graph model)
    saved_model_dir = model_dir

    # For tfjs_graph_model, we need to convert back or use a different approach
    # Let's try loading the original Keras model if it exists
    keras_path = model_dir / "column-classifier.keras"  # Wrong name, let me check

    # Actually, let's load from the saved_model that was used for conversion
    saved_model_path = Path(__file__).parent / "train-boundary-detector/saved_model"

    if saved_model_path.exists():
        print(f"Loading from SavedModel: {saved_model_path}")
        model = tf.saved_model.load(str(saved_model_path))
        return model, "saved_model"

    # Try loading from keras file
    keras_path = model_dir.parent.parent / "data/vision-training/boundary-detector-model.keras"
    if keras_path.exists():
        print(f"Loading from Keras: {keras_path}")
        model = tf.keras.models.load_model(str(keras_path))
        return model, "keras"

    # Look for any .keras or .h5 file
    for pattern in ["*.keras", "*.h5"]:
        for p in model_dir.glob(pattern):
            print(f"Loading from: {p}")
            model = tf.keras.models.load_model(str(p))
            return model, "keras"

    print("Could not find a loadable model format.")
    print("Available files in model dir:", list(model_dir.iterdir()))
    sys.exit(1)


def preprocess_image(image_path: str) -> np.ndarray:
    """Preprocess an image the same way the browser does."""
    img = Image.open(image_path).convert("RGB")
    print(f"Original image size: {img.size}")

    # Resize to model input size (224x224)
    img = img.resize((224, 224), Image.BILINEAR)

    # Convert to numpy array and normalize to [0, 1]
    img_array = np.array(img, dtype=np.float32) / 255.0

    # Add batch dimension
    img_array = np.expand_dims(img_array, axis=0)

    print(f"Preprocessed shape: {img_array.shape}")
    print(f"Value range: [{img_array.min():.3f}, {img_array.max():.3f}]")

    return img_array


def load_ground_truth(image_path: str) -> dict | None:
    """Load ground truth corners from accompanying JSON file."""
    json_path = Path(image_path).with_suffix(".json")
    if json_path.exists():
        with open(json_path) as f:
            return json.load(f)
    return None


def main():
    if len(sys.argv) < 2:
        print(__doc__)

        # Try to find a sample image
        boundary_frames_dir = Path(__file__).parent.parent / "data/vision-training/boundary-frames"
        if boundary_frames_dir.exists():
            for device_dir in boundary_frames_dir.iterdir():
                if device_dir.is_dir():
                    for png in device_dir.glob("*.png"):
                        print(f"\nExample: python {sys.argv[0]} {png}")
                        break
                    break
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(f"Image not found: {image_path}")
        sys.exit(1)

    # Load model
    model, model_type = load_model()
    print(f"Model loaded ({model_type})")

    # Preprocess image
    input_data = preprocess_image(image_path)

    # Run inference
    print("\nRunning inference...")
    if model_type == "saved_model":
        # For SavedModel, use the serving signature
        infer = model.signatures["serving_default"]
        # Get the input tensor name
        input_name = list(infer.structured_input_signature[1].keys())[0]
        result = infer(**{input_name: tf.constant(input_data)})
        # Get output
        output_name = list(result.keys())[0]
        predictions = result[output_name].numpy()[0]
    else:
        # For Keras model
        predictions = model.predict(input_data, verbose=0)[0]

    print(f"\nRaw predictions: {predictions}")
    print(f"Predictions length: {len(predictions)}")

    # Parse corners (order: topLeft, topRight, bottomLeft, bottomRight)
    corners = {
        "topLeft": {"x": float(predictions[0]), "y": float(predictions[1])},
        "topRight": {"x": float(predictions[2]), "y": float(predictions[3])},
        "bottomLeft": {"x": float(predictions[4]), "y": float(predictions[5])},
        "bottomRight": {"x": float(predictions[6]), "y": float(predictions[7])},
    }

    print("\nParsed corners:")
    for name, coord in corners.items():
        print(f"  {name}: ({coord['x']:.4f}, {coord['y']:.4f})")

    # Load and compare with ground truth
    ground_truth = load_ground_truth(image_path)
    if ground_truth:
        print("\nGround truth corners:")
        for name in ["topLeft", "topRight", "bottomLeft", "bottomRight"]:
            gt = ground_truth["corners"][name]
            pred = corners[name]
            error_x = abs(pred["x"] - gt["x"])
            error_y = abs(pred["y"] - gt["y"])
            print(f"  {name}: ({gt['x']:.4f}, {gt['y']:.4f}) | error: ({error_x:.4f}, {error_y:.4f})")

        # Calculate overall error
        total_error = 0
        for name in ["topLeft", "topRight", "bottomLeft", "bottomRight"]:
            gt = ground_truth["corners"][name]
            pred = corners[name]
            total_error += abs(pred["x"] - gt["x"]) + abs(pred["y"] - gt["y"])
        avg_error = total_error / 8
        print(f"\nAverage coordinate error: {avg_error:.4f}")
    else:
        print("\nNo ground truth JSON file found.")

    # Basic sanity checks
    print("\nSanity checks:")
    checks_passed = True

    # Check 1: Top left should be to the left of top right
    if corners["topLeft"]["x"] >= corners["topRight"]["x"]:
        print("  ❌ topLeft.x >= topRight.x (left should be less than right)")
        checks_passed = False
    else:
        print("  ✓ topLeft.x < topRight.x")

    # Check 2: Bottom left should be to the left of bottom right
    if corners["bottomLeft"]["x"] >= corners["bottomRight"]["x"]:
        print("  ❌ bottomLeft.x >= bottomRight.x")
        checks_passed = False
    else:
        print("  ✓ bottomLeft.x < bottomRight.x")

    # Check 3: Top should be above bottom (y increases downward)
    if corners["topLeft"]["y"] >= corners["bottomLeft"]["y"]:
        print("  ❌ topLeft.y >= bottomLeft.y (top should be above bottom)")
        checks_passed = False
    else:
        print("  ✓ topLeft.y < bottomLeft.y")

    if corners["topRight"]["y"] >= corners["bottomRight"]["y"]:
        print("  ❌ topRight.y >= bottomRight.y")
        checks_passed = False
    else:
        print("  ✓ topRight.y < bottomRight.y")

    # Check 4: Reasonable size
    width = (corners["topRight"]["x"] - corners["topLeft"]["x"] +
             corners["bottomRight"]["x"] - corners["bottomLeft"]["x"]) / 2
    height = (corners["bottomLeft"]["y"] - corners["topLeft"]["y"] +
              corners["bottomRight"]["y"] - corners["topRight"]["y"]) / 2

    print(f"\n  Average width: {width:.4f}")
    print(f"  Average height: {height:.4f}")

    if width < 0.1:
        print("  ❌ Width too small (<0.1)")
        checks_passed = False
    if height < 0.1:
        print("  ❌ Height too small (<0.1)")
        checks_passed = False

    print(f"\nOverall: {'✓ PASS' if checks_passed else '❌ FAIL'}")


if __name__ == "__main__":
    main()
