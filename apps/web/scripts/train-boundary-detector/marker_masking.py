"""
Marker masking for boundary detector training.

This module provides functions to mask out ArUco markers from training images,
forcing the model to learn abacus frame edges instead of marker patterns.

CRITICAL: This code is shared between:
1. Training augmentation pipeline (train_model.py)
2. Preview API endpoint (for UI visualization)

Keep these in sync!
"""

import numpy as np
from typing import List, Tuple
import cv2


def estimate_marker_size(
    corners: List[Tuple[float, float]],
    image_width: int,
    image_height: int,
    size_factor: float = 0.18
) -> int:
    """
    Estimate marker size based on the quad dimensions.

    Args:
        corners: List of 4 (x, y) tuples in order [TL, TR, BL, BR], normalized 0-1
        image_width: Image width in pixels
        image_height: Image height in pixels
        size_factor: Marker size as fraction of shorter quad edge (default 12%)

    Returns:
        Estimated marker size in pixels
    """
    # Convert normalized to pixel coordinates
    tl = (corners[0][0] * image_width, corners[0][1] * image_height)
    tr = (corners[1][0] * image_width, corners[1][1] * image_height)
    bl = (corners[2][0] * image_width, corners[2][1] * image_height)
    br = (corners[3][0] * image_width, corners[3][1] * image_height)

    # Calculate edge lengths
    top_edge = np.sqrt((tr[0] - tl[0])**2 + (tr[1] - tl[1])**2)
    bottom_edge = np.sqrt((br[0] - bl[0])**2 + (br[1] - bl[1])**2)
    left_edge = np.sqrt((bl[0] - tl[0])**2 + (bl[1] - tl[1])**2)
    right_edge = np.sqrt((br[0] - tr[0])**2 + (br[1] - tr[1])**2)

    # Use shorter edge to estimate marker size
    shorter_edge = min(top_edge, bottom_edge, left_edge, right_edge)
    marker_size = int(shorter_edge * size_factor)

    # Clamp to reasonable range
    return max(20, min(marker_size, 150))


def get_rotated_mask_polygon(
    corner: Tuple[float, float],
    quad_center: Tuple[float, float],
    marker_size: int,
    image_width: int,
    image_height: int,
    expansion: float = 2.0,
    rotation_angle: float = 0.0
) -> np.ndarray:
    """
    Calculate a rotated polygon mask for a single corner marker.

    The mask is a rotated rectangle aligned with the quad orientation,
    extending outward from the corner.

    Args:
        corner: (x, y) normalized corner position
        quad_center: (x, y) normalized center of the quad
        marker_size: Size of marker in pixels
        image_width: Image width
        image_height: Image height
        expansion: How much larger than marker size to mask
        rotation_angle: Angle in radians to rotate the mask

    Returns:
        numpy array of 4 points defining the rotated rectangle [(x,y), ...]
    """
    # Convert to pixels
    cx = corner[0] * image_width
    cy = corner[1] * image_height
    center_x = quad_center[0] * image_width
    center_y = quad_center[1] * image_height

    # Direction from center to corner (outward direction)
    dx = cx - center_x
    dy = cy - center_y
    length = np.sqrt(dx**2 + dy**2)
    if length > 0:
        dx /= length
        dy /= length

    # Mask size
    mask_size = int(marker_size * expansion)
    half_size = mask_size // 2

    # Center the mask slightly outward from the corner point
    offset_x = dx * marker_size * 0.4
    offset_y = dy * marker_size * 0.4
    mask_cx = cx + offset_x
    mask_cy = cy + offset_y

    # Create a square centered at mask center, then rotate
    # The rotation aligns with the outward direction from quad center
    angle = np.arctan2(dy, dx)

    # Four corners of the square before rotation (relative to mask center)
    corners_rel = np.array([
        [-half_size, -half_size],
        [half_size, -half_size],
        [half_size, half_size],
        [-half_size, half_size]
    ], dtype=np.float32)

    # Rotation matrix
    cos_a = np.cos(angle)
    sin_a = np.sin(angle)
    rot_matrix = np.array([
        [cos_a, -sin_a],
        [sin_a, cos_a]
    ])

    # Rotate and translate to mask center
    rotated_corners = corners_rel @ rot_matrix.T
    rotated_corners[:, 0] += mask_cx
    rotated_corners[:, 1] += mask_cy

    return rotated_corners.astype(np.int32)


def get_marker_mask_region(
    corner: Tuple[float, float],
    quad_center: Tuple[float, float],
    marker_size: int,
    image_width: int,
    image_height: int,
    expansion: float = 2.0
) -> Tuple[int, int, int, int]:
    """
    Calculate the bounding box region for a corner marker mask.
    Used for visualization/reporting. The actual mask uses rotated polygons.

    Returns:
        (x1, y1, x2, y2) bounding box of the mask region
    """
    polygon = get_rotated_mask_polygon(
        corner, quad_center, marker_size, image_width, image_height, expansion
    )
    x1 = max(0, int(polygon[:, 0].min()))
    y1 = max(0, int(polygon[:, 1].min()))
    x2 = min(image_width, int(polygon[:, 0].max()))
    y2 = min(image_height, int(polygon[:, 1].max()))
    return (x1, y1, x2, y2)


def mask_markers(
    image: np.ndarray,
    corners: List[Tuple[float, float]],
    method: str = "noise",
    marker_size_factor: float = 0.18,
    expansion: float = 2.0
) -> np.ndarray:
    """
    Mask out ArUco markers from an image using rotated polygons.

    Args:
        image: Input image as numpy array (H, W, 3), uint8 or float32
        corners: List of 4 (x, y) tuples in order [TL, TR, BL, BR], normalized 0-1
        method: Masking method - "noise", "blur", "black", or "inpaint"
        marker_size_factor: Marker size as fraction of shorter quad edge
        expansion: How much larger than estimated marker to mask

    Returns:
        Image with markers masked out
    """
    if len(corners) != 4:
        raise ValueError(f"Expected 4 corners, got {len(corners)}")

    # Work with a copy
    result = image.copy()
    h, w = image.shape[:2]

    # Determine if image is float or uint8
    is_float = image.dtype == np.float32 or image.dtype == np.float64

    # Calculate quad center
    center_x = sum(c[0] for c in corners) / 4
    center_y = sum(c[1] for c in corners) / 4
    quad_center = (center_x, center_y)

    # Estimate marker size
    marker_size = estimate_marker_size(corners, w, h, marker_size_factor)

    # Mask each corner using rotated polygons
    for corner in corners:
        # Get the rotated polygon for this corner
        polygon = get_rotated_mask_polygon(
            corner, quad_center, marker_size, w, h, expansion
        )

        # Get bounding box for the polygon
        x1 = max(0, int(polygon[:, 0].min()))
        y1 = max(0, int(polygon[:, 1].min()))
        x2 = min(w, int(polygon[:, 0].max()))
        y2 = min(h, int(polygon[:, 1].max()))

        if x2 <= x1 or y2 <= y1:
            continue

        region_h = y2 - y1
        region_w = x2 - x1

        # Create a mask for just this polygon
        poly_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(poly_mask, [polygon], 255)

        if method == "noise":
            # Fill with heavily blurred version + subtle noise
            kernel_size = max(31, (min(region_w, region_h) // 2) | 1)  # Ensure odd

            # Create blurred version of the entire region
            blurred = cv2.GaussianBlur(result, (kernel_size, kernel_size), 0)
            blurred = cv2.GaussianBlur(blurred, (kernel_size, kernel_size), 0)

            if is_float:
                noise = (np.random.rand(h, w, 3).astype(np.float32) - 0.5) * 0.1
                fill = np.clip(blurred + noise, 0, 1)
            else:
                noise = (np.random.rand(h, w, 3) - 0.5) * 30
                fill = np.clip(blurred.astype(np.float32) + noise, 0, 255).astype(np.uint8)

            # Apply fill only where mask is set
            mask_3ch = poly_mask[:, :, np.newaxis].astype(np.float32) / 255.0
            if is_float:
                result = result * (1 - mask_3ch) + fill * mask_3ch
            else:
                result = (result.astype(np.float32) * (1 - mask_3ch) + fill.astype(np.float32) * mask_3ch).astype(np.uint8)

        elif method == "blur":
            kernel_size = max(31, (min(region_w, region_h) // 2) | 1)
            blurred = cv2.GaussianBlur(result, (kernel_size, kernel_size), 0)
            blurred = cv2.GaussianBlur(blurred, (kernel_size, kernel_size), 0)

            mask_3ch = poly_mask[:, :, np.newaxis].astype(np.float32) / 255.0
            if is_float:
                result = result * (1 - mask_3ch) + blurred * mask_3ch
            else:
                result = (result.astype(np.float32) * (1 - mask_3ch) + blurred.astype(np.float32) * mask_3ch).astype(np.uint8)

        elif method == "black":
            if is_float:
                result[poly_mask > 0] = 0.0
            else:
                result[poly_mask > 0] = 0

        elif method == "inpaint":
            if is_float:
                temp = (result * 255).astype(np.uint8)
            else:
                temp = result.copy()

            inpainted = cv2.inpaint(temp, poly_mask, inpaintRadius=7, flags=cv2.INPAINT_TELEA)

            if is_float:
                result = inpainted.astype(np.float32) / 255.0
            else:
                result = inpainted

    return result


def mask_markers_with_visualization(
    image: np.ndarray,
    corners: List[Tuple[float, float]],
    method: str = "noise",
    marker_size_factor: float = 0.18,
    expansion: float = 2.0
) -> Tuple[np.ndarray, np.ndarray, List[Tuple[int, int, int, int]]]:
    """
    Mask markers and return visualization data.

    Returns:
        Tuple of (masked_image, mask_overlay, mask_regions)
        - masked_image: The image with markers masked
        - mask_overlay: Binary mask showing masked regions (for visualization)
        - mask_regions: List of (x1, y1, x2, y2) bounding boxes for each masked region
    """
    if len(corners) != 4:
        raise ValueError(f"Expected 4 corners, got {len(corners)}")

    h, w = image.shape[:2]

    # Calculate quad center
    center_x = sum(c[0] for c in corners) / 4
    center_y = sum(c[1] for c in corners) / 4
    quad_center = (center_x, center_y)

    # Estimate marker size
    marker_size = estimate_marker_size(corners, w, h, marker_size_factor)

    # Get mask regions (bounding boxes) and create mask overlay with rotated polygons
    mask_regions = []
    mask_overlay = np.zeros((h, w), dtype=np.uint8)

    for corner in corners:
        # Get rotated polygon
        polygon = get_rotated_mask_polygon(
            corner, quad_center, marker_size, w, h, expansion
        )

        # Fill the polygon in the overlay
        cv2.fillPoly(mask_overlay, [polygon], 255)

        # Get bounding box for reporting
        region = get_marker_mask_region(
            corner, quad_center, marker_size, w, h, expansion
        )
        mask_regions.append(region)

    # Apply masking
    masked_image = mask_markers(image, corners, method, marker_size_factor, expansion)

    return masked_image, mask_overlay, mask_regions


if __name__ == "__main__":
    # Test/demo code
    import sys
    import json
    import base64
    from PIL import Image
    import io

    # Read from stdin if no command line arg (preferred for large images)
    if len(sys.argv) >= 2:
        input_json = sys.argv[1]
    else:
        input_json = sys.stdin.read()

    if not input_json.strip():
        print("Usage: python marker_masking.py <json_input>", file=sys.stderr)
        print("  Or: echo '<json_input>' | python marker_masking.py", file=sys.stderr)
        print("  Input JSON: {image_base64, corners, method?}", file=sys.stderr)
        print("  Output JSON: {masked_image_base64, mask_regions}", file=sys.stderr)
        sys.exit(1)

    # Parse input
    input_data = json.loads(input_json)

    # Decode image
    image_bytes = base64.b64decode(input_data["image_base64"])
    image = np.array(Image.open(io.BytesIO(image_bytes)).convert("RGB"))

    # Get corners (already normalized 0-1)
    corners = [(c["x"], c["y"]) for c in input_data["corners"]]

    # Get method
    method = input_data.get("method", "noise")

    # Apply masking
    masked, mask_overlay, regions = mask_markers_with_visualization(
        image, corners, method=method
    )

    # Encode result
    masked_pil = Image.fromarray(masked)
    buffer = io.BytesIO()
    masked_pil.save(buffer, format="PNG")
    masked_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    # Output result
    result = {
        "masked_image_base64": masked_base64,
        "mask_regions": [{"x1": r[0], "y1": r[1], "x2": r[2], "y2": r[3]} for r in regions]
    }
    print(json.dumps(result))
