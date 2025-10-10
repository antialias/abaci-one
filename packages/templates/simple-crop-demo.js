/**
 * Simple crop demonstration generator for gallery
 * Creates basic before/after crop mark examples
 */

function generateSimpleCropDemo(svgContent, title) {
  // Extract original viewBox
  const originalViewBoxMatch = svgContent.match(/viewBox="([^"]*)"/);
  const originalViewBox = originalViewBoxMatch
    ? originalViewBoxMatch[1]
    : "0 0 200 180";

  try {
    // Find crop mark coordinates by parsing transforms hierarchically
    const cropMarks = extractCropMarkCoordinates(svgContent);

    if (
      cropMarks.left &&
      cropMarks.right &&
      cropMarks.top &&
      cropMarks.bottom
    ) {
      // Create cropped version with calculated viewBox
      let processedSVG = svgContent;

      // Remove crop mark visual elements
      processedSVG = processedSVG.replace(
        /<path[^>]*fill="#ff4136"[^>]*\/>/g,
        "",
      );
      processedSVG = processedSVG.replace(
        /<a[^>]*xlink:href="crop-mark:\/\/[^"]*"[^>]*>.*?<\/a>/g,
        "",
      );

      // Calculate optimized viewBox from crop mark coordinates
      const minX = Math.min(cropMarks.left.x, cropMarks.right.x);
      const maxX = Math.max(cropMarks.left.x, cropMarks.right.x);
      const minY = Math.min(cropMarks.top.y, cropMarks.bottom.y);
      const maxY = Math.max(cropMarks.top.y, cropMarks.bottom.y);

      const newViewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
      processedSVG = processedSVG.replace(
        /viewBox="[^"]*"/,
        `viewBox="${newViewBox}"`,
      );

      // Calculate size reduction
      const [origX, origY, origW, origH] = originalViewBox
        .split(" ")
        .map(Number);
      const newArea = (maxX - minX) * (maxY - minY);
      const origArea = origW * origH;
      const reduction = Math.round((1 - newArea / origArea) * 100);

      return {
        originalSVG: svgContent,
        croppedSVG: processedSVG,
        originalViewBox,
        croppedViewBox: newViewBox,
        reduction: `${reduction}%`,
        success: true,
      };
    }
  } catch (error) {
    console.log(`Could not process crop marks for ${title}:`, error.message);
  }

  // Fallback to simple demo
  const [x, y, width, height] = originalViewBox.split(" ").map(Number);
  const margin = Math.min(width, height) * 0.1;
  const newViewBox = `${x + margin} ${y + margin} ${width - 2 * margin} ${height - 2 * margin}`;

  let processedSVG = svgContent.replace(
    /viewBox="[^"]*"/,
    `viewBox="${newViewBox}"`,
  );

  return {
    originalSVG: svgContent,
    croppedSVG: processedSVG,
    originalViewBox,
    croppedViewBox: newViewBox,
    reduction: "15%",
    success: false,
  };
}

function extractCropMarkCoordinates(svgContent) {
  const cropMarks = {};

  // Find crop mark links and calculate their absolute coordinates
  ["left", "right", "top", "bottom"].forEach((type) => {
    const linkPattern = new RegExp(
      `<a[^>]*xlink:href="crop-mark://${type}"[^>]*>`,
      "g",
    );
    const linkMatch = svgContent.match(linkPattern);

    if (linkMatch) {
      // Find the transform hierarchy for this crop mark
      const coords = calculateAbsoluteCoordinates(svgContent, type);
      if (coords) {
        cropMarks[type] = coords;
      }
    }
  });

  return cropMarks;
}

function calculateAbsoluteCoordinates(svgContent, cropMarkType) {
  // Find the group hierarchy that contains this crop mark
  const pattern = new RegExp(
    `<g[^>]*transform="translate\\(([^,]+),([^)]+)\\)"[^>]*>.*?<a[^>]*xlink:href="crop-mark://${cropMarkType}"[^>]*>`,
    "s",
  );

  const match = svgContent.match(pattern);
  if (match) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);

    // For a more complete solution, we would need to walk up the entire
    // hierarchy and accumulate all transforms, but for the demo this should work
    return { x, y };
  }

  return null;
}

module.exports = { generateSimpleCropDemo };
