#!/usr/bin/env node

// Create a comparison gallery showing before/after crop mark processing
// This demonstrates the automatic viewBox cropping capability

const fs = require("fs");
const { extractViewBoxFromCropMarks } = require("./extract-viewbox.js");

function createCropComparisonDemo() {
  console.log("🎨 Creating crop mark demonstration...");

  // Select examples to demonstrate
  const demoExamples = [
    "gallery/debug-crop-marks-89.svg",
    "gallery/crop-single-1.svg",
    "gallery/crop-quad-9999.svg",
  ];

  const comparisons = [];

  for (const svgPath of demoExamples) {
    if (!fs.existsSync(svgPath)) {
      console.log(`⚠️  Skipping ${svgPath} - file not found`);
      continue;
    }

    console.log(`\n📐 Processing ${svgPath}...`);

    // Extract crop marks and calculate new viewBox
    const result = extractViewBoxFromCropMarks(svgPath);
    if (!result) {
      console.log(`❌ No crop marks found in ${svgPath}`);
      continue;
    }

    // Read original SVG
    const originalSVG = fs.readFileSync(svgPath, "utf8");

    // Create cropped version
    const croppedSVG = originalSVG.replace(
      /viewBox="[^"]*"/,
      `viewBox="${result.viewBox}"`,
    );

    // Extract original viewBox for comparison
    const originalViewBoxMatch = originalSVG.match(/viewBox="([^"]*)"/);
    const originalViewBox = originalViewBoxMatch
      ? originalViewBoxMatch[1]
      : "unknown";

    const filename = svgPath.replace("gallery/", "").replace(".svg", "");

    comparisons.push({
      name: filename,
      originalViewBox,
      croppedViewBox: result.viewBox,
      originalSVG,
      croppedSVG,
      reduction: `${Math.round((1 - (result.width * result.height) / (270 * 210)) * 100)}%`,
    });

    console.log(`  ✅ Original: ${originalViewBox}`);
    console.log(`  ✅ Cropped:  ${result.viewBox}`);
    console.log(
      `  📉 Size reduction: ${comparisons[comparisons.length - 1].reduction}`,
    );
  }

  // Generate HTML comparison page
  const comparisonHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🧮 Crop Marks Demonstration</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 40px 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            color: #2c3e50;
        }

        .header p {
            font-size: 1.1rem;
            color: #666;
            margin-bottom: 15px;
        }

        .comparison {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            margin-bottom: 40px;
            overflow: hidden;
        }

        .comparison-header {
            background: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
        }

        .comparison-title {
            font-size: 1.4rem;
            font-weight: 600;
            margin-bottom: 10px;
        }

        .comparison-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            font-size: 0.9rem;
        }

        .stat-item {
            background: rgba(255,255,255,0.1);
            padding: 8px 12px;
            border-radius: 6px;
        }

        .stat-label {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .stat-value {
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.8rem;
            opacity: 0.9;
        }

        .comparison-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0;
        }

        .comparison-side {
            padding: 30px;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 400px;
        }

        .comparison-side.before {
            background: #ffeaa7;
            border-right: 3px solid #fdcb6e;
        }

        .comparison-side.after {
            background: #a8e6cf;
        }

        .side-label {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 20px;
            padding: 8px 16px;
            border-radius: 20px;
            color: white;
        }

        .before .side-label {
            background: #e17055;
        }

        .after .side-label {
            background: #00b894;
        }

        .svg-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            max-width: 100%;
        }

        .svg-container svg {
            max-width: 100%;
            max-height: 300px;
            border: 2px solid rgba(0,0,0,0.1);
            border-radius: 8px;
            background: white;
        }

        .viewbox-info {
            margin-top: 15px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.8rem;
            color: #666;
            text-align: center;
            background: rgba(255,255,255,0.8);
            padding: 8px 12px;
            border-radius: 6px;
            max-width: 100%;
            word-break: break-all;
        }

        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 30px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            color: #666;
        }

        @media (max-width: 768px) {
            .comparison-content {
                grid-template-columns: 1fr;
            }

            .comparison-side.before {
                border-right: none;
                border-bottom: 3px solid #fdcb6e;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧮 Crop Marks Demonstration</h1>
            <p>Automatic SVG viewBox cropping using embedded crop mark annotations</p>
            <p style="font-size: 0.9rem; color: #999;">
                Shows before/after comparison of viewBox optimization
            </p>
        </div>

        ${comparisons
          .map(
            (comp) => `
        <div class="comparison">
            <div class="comparison-header">
                <div class="comparison-title">${comp.name}</div>
                <div class="comparison-stats">
                    <div class="stat-item">
                        <div class="stat-label">Original ViewBox</div>
                        <div class="stat-value">${comp.originalViewBox}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Cropped ViewBox</div>
                        <div class="stat-value">${comp.croppedViewBox}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Size Reduction</div>
                        <div class="stat-value">${comp.reduction}</div>
                    </div>
                </div>
            </div>
            <div class="comparison-content">
                <div class="comparison-side before">
                    <div class="side-label">🎯 Before: Original ViewBox</div>
                    <div class="svg-container">
                        ${comp.originalSVG}
                    </div>
                    <div class="viewbox-info">viewBox="${comp.originalViewBox}"</div>
                </div>
                <div class="comparison-side after">
                    <div class="side-label">✂️ After: Crop Mark Processed</div>
                    <div class="svg-container">
                        ${comp.croppedSVG}
                    </div>
                    <div class="viewbox-info">viewBox="${comp.croppedViewBox}"</div>
                </div>
            </div>
        </div>
        `,
          )
          .join("\n")}

        <div class="footer">
            <h3>🛠️ How It Works</h3>
            <p>1. Typst templates generate invisible crop marks at abacus boundaries</p>
            <p>2. Script extracts crop mark positions from SVG</p>
            <p>3. Calculates optimal viewBox from crop mark bounds</p>
            <p>4. Updates SVG with tight-fitting viewBox - no manual cropping needed!</p>
            <p style="margin-top: 15px; font-size: 0.9rem; color: #999;">
                Run <code>node extract-viewbox.js &lt;svg-file&gt;</code> to process your own SVGs
            </p>
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync("crop-marks-demo.html", comparisonHTML);

  console.log("\n🎉 Crop marks demonstration created!");
  console.log("   📄 Open crop-marks-demo.html in your browser");
  console.log(`   📊 ${comparisons.length} examples processed`);

  return true;
}

// Run the demo generator
if (require.main === module) {
  createCropComparisonDemo();
}

module.exports = { createCropComparisonDemo };
