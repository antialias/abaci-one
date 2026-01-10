"""
Pipeline preview for boundary detector training.

Shows the image at each step of the preprocessing pipeline:
1. Raw image (loaded)
2. Marker masking (ArUco markers obscured)
3. Color augmentation (brightness/contrast/saturation variations)
4. Resize (to 224x224)
5. Normalize (to [0, 1] range)

CRITICAL: This uses the EXACT SAME code as train_model.py to ensure
the preview matches exactly what goes through the training pipeline.
"""

import numpy as np
from typing import List, Tuple, Dict, Any
import cv2
from PIL import Image as PILImage

# Import the actual training functions
from marker_masking import mask_markers


def augment_brightness(image: np.ndarray, factor: float) -> np.ndarray:
    """Adjust image brightness. Same as train_model.py."""
    img_float = image.astype(np.float32)
    adjusted = img_float * factor
    return np.clip(adjusted, 0, 255).astype(np.uint8)


def augment_contrast(image: np.ndarray, factor: float) -> np.ndarray:
    """Adjust image contrast. Same as train_model.py."""
    img_float = image.astype(np.float32)
    mean = np.mean(img_float, axis=(0, 1), keepdims=True)
    adjusted = (img_float - mean) * factor + mean
    return np.clip(adjusted, 0, 255).astype(np.uint8)


def augment_saturation(image: np.ndarray, factor: float) -> np.ndarray:
    """Adjust image saturation. Same as train_model.py."""
    hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[:, :, 1] *= factor
    hsv[:, :, 1] = np.clip(hsv[:, :, 1], 0, 255)
    hsv = hsv.astype(np.uint8)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)


def resize_sample(image: np.ndarray, image_size: int = 224) -> np.ndarray:
    """Resize image to target size. Same as train_model.py."""
    img = PILImage.fromarray(image.astype(np.uint8))
    img = img.resize((image_size, image_size), PILImage.BILINEAR)
    return np.array(img)


def apply_color_augmentation_with_labels(image: np.ndarray) -> List[Dict[str, Any]]:
    """
    Apply color augmentation and return labeled results.
    Same logic as train_model.py but with labels for preview.
    """
    # Use fixed factors for preview (not random) so user can see the range
    augmented = []

    # Original (always included)
    augmented.append({
        "image": image.copy(),
        "label": "Original",
        "description": "Unmodified (always included in training)"
    })

    # Brightness variations (training uses 0.7-1.3)
    augmented.append({
        "image": augment_brightness(image, 0.7),
        "label": "Brightness 0.7",
        "description": "Darker (min brightness factor)"
    })
    augmented.append({
        "image": augment_brightness(image, 1.3),
        "label": "Brightness 1.3",
        "description": "Brighter (max brightness factor)"
    })

    # Contrast variations (training uses 0.7-1.3)
    augmented.append({
        "image": augment_contrast(image, 0.7),
        "label": "Contrast 0.7",
        "description": "Lower contrast (min contrast factor)"
    })
    augmented.append({
        "image": augment_contrast(image, 1.3),
        "label": "Contrast 1.3",
        "description": "Higher contrast (max contrast factor)"
    })

    # Saturation variations (training uses 0.5-1.5)
    augmented.append({
        "image": augment_saturation(image, 0.5),
        "label": "Saturation 0.5",
        "description": "Desaturated (min saturation factor)"
    })
    augmented.append({
        "image": augment_saturation(image, 1.5),
        "label": "Saturation 1.5",
        "description": "Saturated (max saturation factor)"
    })

    # Combined (show extreme examples)
    combined_dark = augment_brightness(image.copy(), 0.8)
    combined_dark = augment_contrast(combined_dark, 0.8)
    combined_dark = augment_saturation(combined_dark, 0.7)
    augmented.append({
        "image": combined_dark,
        "label": "Combined (dark)",
        "description": "B:0.8 C:0.8 S:0.7 - challenging dark case"
    })

    combined_bright = augment_brightness(image.copy(), 1.2)
    combined_bright = augment_contrast(combined_bright, 1.2)
    combined_bright = augment_saturation(combined_bright, 1.3)
    augmented.append({
        "image": combined_bright,
        "label": "Combined (bright)",
        "description": "B:1.2 C:1.2 S:1.3 - challenging bright case"
    })

    return augmented


def generate_pipeline_preview(
    image: np.ndarray,
    corners: List[Tuple[float, float]],
    apply_masking: bool = True,
    apply_augmentation: bool = True,
    target_size: int = 224
) -> Dict[str, Any]:
    """
    Generate a preview showing the image at each step of the preprocessing pipeline.

    Args:
        image: Input image as numpy array (H, W, 3), uint8, RGB
        corners: List of 4 (x, y) tuples in order [TL, TR, BL, BR], normalized 0-1
        apply_masking: Whether to show marker masking step
        apply_augmentation: Whether to show color augmentation step
        target_size: Target image size for resize step

    Returns:
        Dictionary with pipeline steps and their outputs
    """
    pipeline = {
        "steps": []
    }

    current_image = image.copy()

    # Step 1: Raw image
    pipeline["steps"].append({
        "step": 1,
        "name": "raw",
        "title": "Raw Image",
        "description": "Original image as loaded from disk",
        "image": current_image.copy()
    })

    # Step 2: Marker masking
    if apply_masking:
        try:
            masked_image = mask_markers(current_image, corners, method="noise")
            current_image = masked_image
            pipeline["steps"].append({
                "step": 2,
                "name": "masked",
                "title": "Marker Masking",
                "description": "ArUco markers obscured with noise to prevent model from learning marker patterns",
                "image": current_image.copy()
            })
        except Exception as e:
            pipeline["steps"].append({
                "step": 2,
                "name": "masked",
                "title": "Marker Masking",
                "description": f"FAILED: {str(e)}",
                "image": current_image.copy(),
                "error": str(e)
            })

    # Step 3: Color augmentation (show multiple variants)
    if apply_augmentation:
        augmented_variants = apply_color_augmentation_with_labels(current_image)
        pipeline["steps"].append({
            "step": 3,
            "name": "augmented",
            "title": "Color Augmentation",
            "description": "Random brightness/contrast/saturation variations. Training generates 9 versions per image (1 original + 8 augmented).",
            "variants": augmented_variants
        })
        # Continue pipeline with original (non-augmented) for remaining steps
        # since augmentation produces multiple variants

    # Step 4: Resize
    resized_image = resize_sample(current_image, target_size)
    pipeline["steps"].append({
        "step": 4,
        "name": "resized",
        "title": f"Resize ({target_size}x{target_size})",
        "description": f"Resized from {image.shape[1]}x{image.shape[0]} to {target_size}x{target_size} using bilinear interpolation",
        "image": resized_image.copy(),
        "original_size": f"{image.shape[1]}x{image.shape[0]}",
        "target_size": f"{target_size}x{target_size}"
    })

    # Step 5: Normalize
    # Note: We can't really "show" normalization since it changes the data type
    # but we include it in the pipeline for completeness
    normalized_image = resized_image.astype(np.float32) / 255.0
    # Convert back to uint8 for display
    normalized_display = (normalized_image * 255).astype(np.uint8)
    pipeline["steps"].append({
        "step": 5,
        "name": "normalized",
        "title": "Normalize [0, 1]",
        "description": "Pixel values divided by 255 to normalize to [0, 1] range for neural network input",
        "image": normalized_display,
        "note": "Display shows uint8 representation; actual training uses float32 in [0,1]"
    })

    return pipeline


if __name__ == "__main__":
    import sys
    import json
    import base64
    import io

    # Read from stdin
    if len(sys.argv) >= 2:
        input_json = sys.argv[1]
    else:
        input_json = sys.stdin.read()

    if not input_json.strip():
        print("Usage: python pipeline_preview.py <json_input>", file=sys.stderr)
        print("  Or: echo '<json_input>' | python pipeline_preview.py", file=sys.stderr)
        print("  Input JSON: {image_base64, corners, apply_masking?, apply_augmentation?}", file=sys.stderr)
        print("  Output JSON: {steps: [{step, name, title, description, image_base64?, variants?}]}", file=sys.stderr)
        sys.exit(1)

    # Parse input
    input_data = json.loads(input_json)

    # Decode image (RGB from browser)
    image_bytes = base64.b64decode(input_data["image_base64"])
    pil_image = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")
    image = np.array(pil_image)

    # Get corners
    corners_raw = input_data["corners"]
    corners = [(c["x"], c["y"]) for c in corners_raw]

    # Options
    apply_masking = input_data.get("apply_masking", True)
    apply_augmentation = input_data.get("apply_augmentation", True)
    target_size = input_data.get("target_size", 224)

    # Generate pipeline preview
    pipeline = generate_pipeline_preview(
        image, corners, apply_masking, apply_augmentation, target_size
    )

    # Convert images to base64
    def encode_image(img: np.ndarray) -> str:
        pil_img = PILImage.fromarray(img.astype(np.uint8))
        buffer = io.BytesIO()
        pil_img.save(buffer, format="JPEG", quality=85)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    # Build output
    result = {"steps": []}

    for step in pipeline["steps"]:
        step_output = {
            "step": step["step"],
            "name": step["name"],
            "title": step["title"],
            "description": step["description"]
        }

        # Handle single image steps
        if "image" in step:
            step_output["image_base64"] = encode_image(step["image"])

        # Handle augmentation variants
        if "variants" in step:
            step_output["variants"] = [
                {
                    "image_base64": encode_image(v["image"]),
                    "label": v["label"],
                    "description": v["description"]
                }
                for v in step["variants"]
            ]

        # Copy any extra fields
        for key in ["error", "note", "original_size", "target_size"]:
            if key in step:
                step_output[key] = step[key]

        result["steps"].append(step_output)

    print(json.dumps(result))
