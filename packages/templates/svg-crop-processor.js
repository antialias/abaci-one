/**
 * @fileoverview SVG Crop Processor - Standalone crop mark extraction and viewBox optimization
 *
 * High-performance, browser-compatible SVG post-processor that extracts crop marks
 * from Typst-generated SVGs and optimizes viewBox dimensions for minimal file sizes.
 *
 * Features:
 * - Works in Node.js and all evergreen browsers
 * - Zero dependencies - pure JavaScript/DOM APIs
 * - Precise coordinate calculation with transform accumulation
 * - Comprehensive error handling with actionable messages
 * - TypeScript definitions included
 * - Optimized for Soroban abacus SVGs with crop marks
 *
 * @author Soroban Flashcards Team
 * @version 1.0.0
 * @license MIT
 */

/**
 * @typedef {Object} CropMark
 * @property {number} x - X coordinate of the crop mark
 * @property {number} y - Y coordinate of the crop mark
 */

/**
 * @typedef {Object} CropResult
 * @property {string} viewBox - Optimized viewBox string "x y width height"
 * @property {number} width - Cropped width
 * @property {number} height - Cropped height
 * @property {number} minX - Left boundary
 * @property {number} minY - Top boundary
 * @property {number} maxX - Right boundary
 * @property {number} maxY - Bottom boundary
 * @property {Object.<string, CropMark>} cropMarks - Detected crop marks by type
 * @property {number} reduction - File size reduction percentage (0-100)
 */

/**
 * @typedef {Object} ProcessResult
 * @property {string} svg - Optimized SVG content with updated viewBox
 * @property {CropResult} cropData - Detailed crop information
 * @property {boolean} success - Whether processing succeeded
 * @property {string[]} warnings - Non-fatal issues encountered
 */

/**
 * Custom error class for SVG crop processing failures.
 */
class SVGCropError extends Error {
  /**
   * @param {string} message - Error description
   * @param {string} code - Error code for programmatic handling
   * @param {Object} [details] - Additional error context
   */
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SVGCropError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Parse SVG content and extract elements with accumulated transforms.
 * Correctly handles nested transform groups to calculate final coordinates.
 *
 * @param {string} svgContent - Raw SVG content as string
 * @returns {Array<Object>} Parsed elements with final transform coordinates
 * @private
 */
function parseSVGWithTransforms(svgContent) {
  const elements = [];
  const lines = svgContent.split('\n');
  const stack = []; // Track parent transforms for accumulation

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.match(/^(\s*)/)[1].length;

    // Handle opening transform groups
    if (line.includes('<g ') && line.includes('transform=')) {
      const transformMatch = line.match(/transform="translate\(([^)]+)\)"/);
      if (!transformMatch) continue;

      const coords = transformMatch[1].split(/[,\s]+/).map(Number);
      const transform = { x: coords[0] || 0, y: coords[1] || 0 };

      // Maintain stack based on indentation (XML nesting level)
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      // Calculate accumulated transform from all parents
      const accumulated = stack.reduce(
        (acc, parent) => ({
          x: acc.x + parent.transform.x,
          y: acc.y + parent.transform.y
        }),
        { x: 0, y: 0 }
      );

      const finalTransform = {
        x: accumulated.x + transform.x,
        y: accumulated.y + transform.y
      };

      stack.push({ indent, transform, finalTransform });

      // Check for crop mark elements (tiny 0.1x0.1 red rectangles)
      // Handle both multi-line and single-line SVG formats
      const checkLine = (lineToCheck, lineIndex) => {
        // Find all crop marks in the line using regex
        // Look for 0.1x0.1 rectangles, not dashed lines
        const cropMarkRegex = /<path[^>]*d="M 0 0 L 0 0\.1 L 0\.1 0\.1 L 0\.1 0 Z "[^>]*fill="#ff4136"[^>]*\/>/g;
        const matches = lineToCheck.match(cropMarkRegex);

        if (matches) {
          // Add one element for each crop mark found
          matches.forEach((match, matchIndex) => {
            elements.push({
              type: 'crop-mark',
              finalTransform,
              line: lineIndex,
              matchIndex,
              raw: match
            });
          });
        }
      };

      // Check current line (for single-line SVGs)
      checkLine(line, i);

      // Check next line (for multi-line SVGs)
      if (i + 1 < lines.length) {
        checkLine(lines[i + 1], i + 1);
      }
    }
  }

  return elements;
}

/**
 * Extract crop mark coordinates by finding crop mark links and walking up the transform hierarchy
 * This approach is more reliable than parsing all transforms
 */
function extractCropMarkCoordinatesFromLinks(svgContent) {
  const cropMarks = {};

  console.log('🔍 === VIEWPORT CROPPING: Starting crop mark extraction ===');

  // Find each crop mark type and calculate its absolute coordinates
  ['left', 'right', 'top', 'bottom'].forEach(type => {
    console.log(`🔍 Looking for crop mark: ${type}`);
    const coords = calculateCropMarkCoordinates(svgContent, type);
    if (coords) {
      console.log(`✅ Found ${type} crop mark at: x=${coords.x}, y=${coords.y}`);
      cropMarks[type] = coords;
    } else {
      console.log(`❌ Could not find ${type} crop mark`);
    }
  });

  console.log('🔍 Final crop marks:', cropMarks);
  return cropMarks;
}

/**
 * Calculate absolute coordinates for a specific crop mark type by finding the specific crop mark position
 */
function calculateCropMarkCoordinates(svgContent, cropMarkType) {
  console.log(`🔍   Calculating coordinates for ${cropMarkType} crop mark`);

  // Find the crop mark link position
  const linkPosition = svgContent.indexOf(`crop-mark://${cropMarkType}`);
  if (linkPosition === -1) {
    console.log(`🔍   ❌ No crop-mark://${cropMarkType} link found in SVG`);
    return null;
  }
  console.log(`🔍   ✅ Found crop-mark://${cropMarkType} link at position ${linkPosition}`);

  // Extract the base page offset from the root page group
  const pageOffsetMatch = svgContent.match(/transform="translate\(([^,]+),([^)]+)\)"[^>]*data-tid="[^"]*"[^>]*class="typst-group"/);
  let baseX = 0;
  let baseY = 0;

  if (pageOffsetMatch) {
    baseX = parseFloat(pageOffsetMatch[1]) || 0;
    baseY = parseFloat(pageOffsetMatch[2]) || 0;
    console.log(`🔍   📄 Found page offset: baseX=${baseX}, baseY=${baseY}`);
  } else {
    console.log(`🔍   📄 No page offset found, using baseX=0, baseY=0`);
  }

  // Look backward from the crop mark link to find ALL containing transforms
  const beforeLink = svgContent.substring(0, linkPosition);
  const transformPattern = /transform="translate\(([^,]+),([^)]+)\)"/g;
  let match;
  let totalX = baseX;
  let totalY = baseY;

  console.log(`🔍   🔍 Scanning for transforms before position ${linkPosition}...`);

  // Find all transforms that could apply to this crop mark
  const transforms = [];
  while ((match = transformPattern.exec(beforeLink)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const pos = match.index;

    // Skip zero transforms
    if (x !== 0 || y !== 0) {
      transforms.push({ x, y, pos });
      console.log(`🔍     Found non-zero transform at pos ${pos}: translate(${x}, ${y})`);
    } else {
      console.log(`🔍     Skipped zero transform at pos ${pos}: translate(${x}, ${y})`);
    }
  }

  console.log(`🔍   Found ${transforms.length} non-zero transforms`);

  // Get the most recent non-zero transform before the crop mark
  if (transforms.length > 0) {
    // Sort by position and take the last one
    transforms.sort((a, b) => b.pos - a.pos);
    const lastTransform = transforms[0];

    console.log(`🔍   📐 Applying last transform: translate(${lastTransform.x}, ${lastTransform.y})`);
    totalX += lastTransform.x;
    totalY += lastTransform.y;
  } else {
    console.log(`🔍   📐 No non-zero transforms found, using only base offset`);
  }

  console.log(`🔍   🎯 Final coordinates for ${cropMarkType}: x=${totalX}, y=${totalY}`);
  return { x: totalX, y: totalY };
}

/**
 * Extract crop marks from SVG content and calculate optimal viewBox.
 *
 * @param {string} svgContent - Raw SVG content as string
 * @returns {CropResult} Crop analysis results
 * @throws {SVGCropError} When crop marks cannot be found or processed
 */
function extractCropMarks(svgContent) {
  if (typeof svgContent !== 'string') {
    throw new SVGCropError(
      'SVG content must be a string',
      'INVALID_INPUT',
      { received: typeof svgContent }
    );
  }

  if (!svgContent.trim()) {
    throw new SVGCropError(
      'SVG content is empty',
      'EMPTY_INPUT'
    );
  }

  // Validate SVG structure
  if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
    throw new SVGCropError(
      'Invalid SVG format - missing <svg> tags',
      'INVALID_SVG_FORMAT'
    );
  }

  // Extract current viewBox for comparison
  const viewBoxMatch = svgContent.match(/viewBox="([^"]*)"/);
  const originalViewBox = viewBoxMatch ? viewBoxMatch[1] : null;

  // Extract crop mark coordinates using link-based approach
  const cropMarks = extractCropMarkCoordinatesFromLinks(svgContent);

  if (Object.keys(cropMarks).length === 0) {
    throw new SVGCropError(
      'No crop marks found in SVG. Ensure the SVG was generated with crop marks enabled.',
      'NO_CROP_MARKS',
      {
        originalViewBox,
        hint: 'Add crop marks to your Typst template using the crop mark system'
      }
    );
  }

  if (Object.keys(cropMarks).length < 4) {
    throw new SVGCropError(
      `Insufficient crop marks found (${Object.keys(cropMarks).length}/4). Need left, right, top, and bottom markers.`,
      'INSUFFICIENT_CROP_MARKS',
      {
        found: Object.keys(cropMarks),
        required: ['left', 'right', 'top', 'bottom']
      }
    );
  }

  // Calculate viewBox boundaries
  const positions = Object.values(cropMarks);
  console.log('🔍 === VIEWPORT CROPPING: Calculating viewBox boundaries ===');
  console.log('🔍 Crop mark positions:', positions);

  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));
  const maxY = Math.max(...positions.map(p => p.y));

  console.log(`🔍 Calculated boundaries: minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}`);

  const width = maxX - minX;
  const height = maxY - minY;

  console.log(`🔍 Calculated dimensions: width=${width}, height=${height}`);

  // Validate calculated dimensions
  if (width <= 0 || height <= 0) {
    console.error(`🔍 ❌ Invalid dimensions: width=${width}, height=${height}`);
    throw new SVGCropError(
      `Invalid crop dimensions calculated: ${width} × ${height}`,
      'INVALID_DIMENSIONS',
      {
        minX, maxX, minY, maxY, width, height,
        cropMarks,
        hint: 'Check that crop marks are positioned correctly'
      }
    );
  }

  const viewBox = `${minX} ${minY} ${width} ${height}`;
  console.log(`🔍 Final viewBox: "${viewBox}"`);
  console.log('🔍 === VIEWPORT CROPPING: Complete ===');

  // Calculate file size reduction estimate
  let reduction = 0;
  if (originalViewBox) {
    const originalParts = originalViewBox.split(' ').map(Number);
    if (originalParts.length === 4) {
      const originalArea = originalParts[2] * originalParts[3];
      const newArea = width * height;
      reduction = Math.round(((originalArea - newArea) / originalArea) * 100);
    }
  }

  return {
    viewBox,
    width,
    height,
    minX,
    minY,
    maxX,
    maxY,
    cropMarks,
    reduction: Math.max(0, reduction)
  };
}

/**
 * Extract bead annotation data from link elements and convert to data attributes.
 * Processes SVG links with bead:// protocol and converts them to data attributes.
 *
 * @param {string} svgContent - Raw SVG content as string
 * @returns {Object} Extraction results
 * @private
 */
function extractBeadAnnotations(svgContent) {
  const beadLinks = [];
  const warnings = [];

  // Find all bead links - both <a> elements and xlink:href attributes
  const linkPatterns = [
    // SVG <a> elements with href
    /<a[^>]+href="bead:\/\/([^"]+)"[^>]*>(.*?)<\/a>/gs,
    // Elements with xlink:href
    /<[^>]+xlink:href="bead:\/\/([^"]+)"[^>]*>/g
  ];

  let processedSVG = svgContent;

  linkPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(svgContent)) !== null) {
      const beadId = match[1];
      const linkElement = match[0];
      const innerContent = match[2] || ''; // For <a> elements

      // Parse the bead ID to extract meaningful data
      const beadData = parseBeadId(beadId);

      beadLinks.push({
        id: beadId,
        data: beadData,
        originalElement: linkElement,
        innerContent
      });

      // Convert link to data attributes on the inner element
      if (innerContent) {
        // For <a> wrapper elements, extract inner content and add data attributes
        const dataAttributes = createDataAttributes(beadData);
        const updatedInner = addDataAttributesToElement(innerContent, dataAttributes);
        processedSVG = processedSVG.replace(linkElement, updatedInner);
      } else {
        // For xlink:href attributes, convert to data attributes on the same element
        const dataAttributes = createDataAttributes(beadData);
        const updatedElement = linkElement.replace(/xlink:href="bead:\/\/[^"]+"/, '')
          .replace(/>$/, dataAttributes + '>');
        processedSVG = processedSVG.replace(linkElement, updatedElement);
      }
    }
  });

  if (beadLinks.length === 0) {
    warnings.push('No bead annotations found - SVG may not contain interactive beads');
  }

  return {
    processedSVG,
    beadLinks,
    warnings,
    count: beadLinks.length
  };
}

/**
 * Parse a bead ID string into structured data.
 * Handles IDs like "heaven-col1-active1" or "earth-col2-pos3-active0"
 *
 * @param {string} beadId - Bead identifier string
 * @returns {Object} Parsed bead data
 * @private
 */
function parseBeadId(beadId) {
  const data = { id: beadId };

  // Extract bead type (heaven/earth)
  if (beadId.includes('heaven-')) {
    data.type = 'heaven';
    data.position = 'heaven';
  } else if (beadId.includes('earth-')) {
    data.type = 'earth';
    data.position = 'earth';
  }

  // Extract column/place value
  const colMatch = beadId.match(/col(\d+)/);
  if (colMatch) {
    data.column = parseInt(colMatch[1]);
    data.placeValue = data.column;
  }

  // Extract position (for earth beads)
  const posMatch = beadId.match(/pos(\d+)/);
  if (posMatch) {
    data.earthPosition = parseInt(posMatch[1]);
  }

  // Extract active state
  const activeMatch = beadId.match(/active(\d+)/);
  if (activeMatch) {
    data.active = activeMatch[1] === '1';
    data.state = data.active ? 'active' : 'inactive';
  }

  return data;
}

/**
 * Create data attribute string from bead data.
 *
 * @param {Object} beadData - Parsed bead data
 * @returns {string} Data attributes string
 * @private
 */
function createDataAttributes(beadData) {
  const attributes = [];

  Object.entries(beadData).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const attrName = `data-bead-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      const attrValue = String(value).replace(/"/g, '&quot;');
      attributes.push(`${attrName}="${attrValue}"`);
    }
  });

  return attributes.length > 0 ? ' ' + attributes.join(' ') : '';
}

/**
 * Add data attributes to an SVG element string.
 *
 * @param {string} elementString - SVG element as string
 * @param {string} dataAttributes - Data attributes to add
 * @returns {string} Updated element string
 * @private
 */
function addDataAttributesToElement(elementString, dataAttributes) {
  if (!dataAttributes.trim()) return elementString;

  // Find the first opening tag and add attributes
  return elementString.replace(/(<[^>]+?)(\s*\/?>)/, `$1${dataAttributes}$2`);
}

/**
 * Process SVG content by extracting crop marks and optimizing viewBox.
 * Returns both the optimized SVG and detailed crop information.
 *
 * @param {string} svgContent - Raw SVG content as string
 * @param {Object} [options] - Processing options
 * @param {boolean} [options.removeCropMarks=false] - Remove crop mark elements from output
 * @param {boolean} [options.preserveAspectRatio=true] - Update width/height to match viewBox
 * @param {boolean} [options.extractBeadAnnotations=true] - Convert bead links to data attributes
 * @returns {ProcessResult} Complete processing results
 * @throws {SVGCropError} When processing fails
 *
 * @example
 * ```javascript
 * const { processSVG } = require('@soroban/templates/svg-crop-processor');
 *
 * const result = processSVG(svgContent, {
 *   extractBeadAnnotations: true // Convert bead links to data attributes
 * });
 * console.log(`Reduced size by ${result.cropData.reduction}%`);
 * console.log(`Found ${result.beadData.count} interactive beads`);
 *
 * // Save optimized SVG
 * fs.writeFileSync('optimized.svg', result.svg);
 * ```
 */
function processSVG(svgContent, options = {}) {
  const {
    removeCropMarks = false,
    preserveAspectRatio = true,
    extractBeadAnnotations: shouldExtractBeadAnnotations = true
  } = options;

  const warnings = [];

  try {
    // Extract crop information
    const cropData = extractCropMarks(svgContent);

    // Extract bead annotations if requested
    let beadData = null;
    let workingSVG = svgContent;

    if (shouldExtractBeadAnnotations) {
      const beadResult = extractBeadAnnotations(svgContent);
      beadData = {
        count: beadResult.count,
        beads: beadResult.beadLinks.map(link => link.data),
        links: beadResult.beadLinks
      };
      workingSVG = beadResult.processedSVG;
      warnings.push(...beadResult.warnings);
    }

    // Update SVG with optimized viewBox
    let optimizedSVG = workingSVG.replace(
      /viewBox="[^"]*"/,
      `viewBox="${cropData.viewBox}"`
    );

    // Update width and height attributes to match viewBox aspect ratio
    if (preserveAspectRatio) {
      optimizedSVG = optimizedSVG.replace(
        /width="[^"]*"/,
        `width="${cropData.width}pt"`
      );

      optimizedSVG = optimizedSVG.replace(
        /height="[^"]*"/,
        `height="${cropData.height}pt"`
      );
    }

    // Remove crop marks if requested (not recommended for debugging)
    if (removeCropMarks) {
      warnings.push('Crop marks removed - debugging may be more difficult');
      // Remove crop mark elements (lines with 0.1x0.1 red rectangles)
      optimizedSVG = optimizedSVG.replace(
        /.*fill="#ff4136".*0\.1 0\.1.*/g,
        ''
      );
    }

    return {
      svg: optimizedSVG,
      cropData,
      beadData,
      success: true,
      warnings
    };

  } catch (error) {
    if (error instanceof SVGCropError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new SVGCropError(
      `Unexpected error during SVG processing: ${error.message}`,
      'PROCESSING_ERROR',
      { originalError: error.message }
    );
  }
}

/**
 * Browser-compatible file processing function.
 * Processes File objects or Blob objects directly in the browser.
 *
 * @param {File|Blob} file - SVG file to process
 * @param {Object} [options] - Processing options
 * @returns {Promise<ProcessResult>} Processing results
 * @throws {SVGCropError} When processing fails
 *
 * @example
 * ```javascript
 * // In browser with file input
 * const fileInput = document.getElementById('svg-upload');
 * fileInput.addEventListener('change', async (e) => {
 *   const file = e.target.files[0];
 *   try {
 *     const result = await processSVGFile(file);
 *     console.log(`Optimized! Reduction: ${result.cropData.reduction}%`);
 *   } catch (error) {
 *     console.error('Processing failed:', error.message);
 *   }
 * });
 * ```
 */
async function processSVGFile(file, options = {}) {
  if (typeof File !== 'undefined' && !(file instanceof File) &&
      typeof Blob !== 'undefined' && !(file instanceof Blob)) {
    throw new SVGCropError(
      'Expected File or Blob object',
      'INVALID_FILE_TYPE',
      { received: typeof file }
    );
  }

  try {
    const svgContent = await file.text();
    return processSVG(svgContent, options);
  } catch (error) {
    if (error instanceof SVGCropError) {
      throw error;
    }

    throw new SVGCropError(
      `Failed to read file: ${error.message}`,
      'FILE_READ_ERROR',
      { originalError: error.message }
    );
  }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    processSVG,
    processSVGFile,
    extractCropMarks,
    extractBeadAnnotations,
    SVGCropError
  };
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.SorobanSVGCropProcessor = {
    processSVG,
    processSVGFile,
    extractCropMarks,
    extractBeadAnnotations,
    SVGCropError
  };
}