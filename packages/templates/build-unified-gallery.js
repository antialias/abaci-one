#!/usr/bin/env node

// Unified gallery builder with tabbed interface
// Combines all examples into one comprehensive showcase

const fs = require('fs');
const { extractViewBoxFromCropMarks } = require('./extract-viewbox.js');

// Import all examples from build-gallery.js
const examples = [
    {
        id: 'basic-5',
        title: 'Basic Number 5',
        description: 'Simple representation of 5 with monochrome diamonds',
        number: 5,
        category: 'basic',
        config: {
            bead_shape: 'diamond',
            color_scheme: 'monochrome',
            base_size: 1.5
        }
    },
    {
        id: 'colorful-123',
        title: 'Colorful 123',
        description: 'Number 123 with place-value colors and diamond beads',
        number: 123,
        category: 'basic',
        config: {
            bead_shape: 'diamond',
            color_scheme: 'place-value',
            base_size: 1.2
        }
    },
    {
        id: 'circles-42',
        title: 'Circle Beads - 42',
        description: 'Number 42 with circular beads and heaven-earth colors',
        number: 42,
        category: 'basic',
        config: {
            bead_shape: 'circle',
            color_scheme: 'heaven-earth',
            base_size: 1.8
        }
    },
    {
        id: 'large-7',
        title: 'Large Scale - 7',
        description: 'Single digit with maximum scale for detail work',
        number: 7,
        category: 'basic',
        config: {
            bead_shape: 'diamond',
            color_scheme: 'place-value',
            base_size: 2.5
        }
    },
    {
        id: 'compact-999',
        title: 'Compact 999',
        description: 'Large number with hidden inactive beads for clean look',
        number: 999,
        category: 'basic',
        config: {
            bead_shape: 'square',
            color_scheme: 'alternating',
            hide_inactive: true,
            base_size: 1.0
        }
    },
    {
        id: 'educational-1234',
        title: 'Educational 1234',
        description: 'Four-digit number showing empty columns for learning',
        number: 1234,
        category: 'basic',
        config: {
            bead_shape: 'circle',
            color_scheme: 'place-value',
            show_empty: true,
            base_size: 1.3
        }
    },
    // Debug examples
    {
        id: 'debug-crop-marks-89',
        title: 'Debug: Crop Marks - 89',
        description: 'Visible red crop marks showing viewBox boundaries',
        number: 89,
        category: 'debug',
        config: {
            bead_shape: 'diamond',
            color_scheme: 'place-value',
            show_crop_marks: true,
            crop_margin: '15pt',
            base_size: 1.5
        }
    },
    {
        id: 'debug-crop-marks-456',
        title: 'Debug: Crop Marks - 456',
        description: 'Three-digit number with visible crop boundaries',
        number: 456,
        category: 'debug',
        config: {
            bead_shape: 'circle',
            color_scheme: 'heaven-earth',
            show_crop_marks: true,
            crop_margin: '12pt',
            base_size: 1.2
        }
    }
];

// Use the same crop examples from build-gallery.js
const cropExamples = [
    {
        id: 'crop-single-1',
        title: 'Crop Marks: Single Digit',
        description: 'Invisible crop marks for automated viewBox processing',
        number: 1,
        config: {
            bead_shape: 'diamond',
            color_scheme: 'monochrome',
            show_crop_marks: true,
            crop_margin: '10pt',
            base_size: 1.0
        }
    },
    {
        id: 'crop-quad-9999',
        title: 'Crop Marks: Four 9s',
        description: 'Large four-digit number with crop boundaries',
        number: 9999,
        config: {
            bead_shape: 'diamond',
            color_scheme: 'place-value',
            show_crop_marks: true,
            crop_margin: '15pt',
            base_size: 0.8
        }
    },
    {
        id: 'crop-large-scale-0',
        title: 'Crop Marks: Large Zero',
        description: 'Zero representation with large scale and crop marks',
        number: 0,
        config: {
            bead_shape: 'square',
            color_scheme: 'monochrome',
            show_crop_marks: true,
            crop_margin: '20pt',
            base_size: 2.0
        }
    },
    {
        id: 'crop-hidden-inactive-555',
        title: 'Crop Marks: Hidden Inactive',
        description: 'Clean layout with hidden inactive beads and crop marks',
        number: 555,
        config: {
            bead_shape: 'diamond',
            color_scheme: 'alternating',
            hide_inactive: true,
            show_crop_marks: true,
            crop_margin: '10pt',
            base_size: 1.5
        }
    },
    {
        id: 'crop-mixed-geometry-321',
        title: 'Crop Marks: Mixed Geometry',
        description: 'Circle beads with heaven-earth colors and crop boundaries',
        number: 321,
        config: {
            bead_shape: 'circle',
            color_scheme: 'heaven-earth',
            show_crop_marks: true,
            crop_margin: '12pt',
            base_size: 1.3
        }
    }
];

// Add category to crop examples
cropExamples.forEach(ex => ex.category = 'crop');

// Combine all examples
const allExamples = [...examples, ...cropExamples];

function buildUnifiedGallery() {
    console.log('🏗️  Building unified soroban gallery...');

    let svgCount = 0;
    let missingCount = 0;
    let cropComparisonData = [];

    // Group examples by category
    const categorized = {
        basic: allExamples.filter(ex => ex.category === 'basic'),
        crop: allExamples.filter(ex => ex.category === 'crop'),
        debug: allExamples.filter(ex => ex.category === 'debug')
    };

    // Generate example cards for each category
    const generateCards = (examples, includeCropComparison = false) => {
        return examples.map(example => {
            const svgPath = `gallery/${example.id}.svg`;
            let svgContent = '';
            let cropData = null;

            if (fs.existsSync(svgPath)) {
                svgContent = fs.readFileSync(svgPath, 'utf8');
                svgCount++;
                console.log(`✅ Embedded ${example.id}.svg`);

                // Generate crop comparison data if requested
                if (includeCropComparison && example.config?.show_crop_marks) {
                    try {
                        const result = extractViewBoxFromCropMarks(svgPath);
                        if (result) {
                            const originalViewBoxMatch = svgContent.match(/viewBox="([^"]*)"/);
                            const originalViewBox = originalViewBoxMatch ? originalViewBoxMatch[1] : 'unknown';

                            let croppedSVG = svgContent.replace(
                                /viewBox="[^"]*"/,
                                `viewBox="${result.viewBox}"`
                            );

                            // Update width and height to match the viewBox dimensions for correct aspect ratio
                            croppedSVG = croppedSVG.replace(
                                /width="[^"]*"/,
                                `width="${result.width}pt"`
                            );

                            croppedSVG = croppedSVG.replace(
                                /height="[^"]*"/,
                                `height="${result.height}pt"`
                            );

                            cropData = {
                                originalViewBox,
                                croppedViewBox: result.viewBox,
                                originalSVG: svgContent,
                                croppedSVG,
                                reduction: `${Math.round((1 - (result.width * result.height) / (270 * 210)) * 100)}%`
                            };
                        }
                    } catch (error) {
                        console.log(`⚠️  Could not generate crop data for ${example.id}`);
                    }
                }
            } else {
                svgContent = `
                    <div style="text-align: center; padding: 40px; color: #666; border: 2px dashed #ddd; border-radius: 8px;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
                        <div>SVG not generated</div>
                    </div>
                `;
                missingCount++;
                console.log(`⚠️  Missing ${svgPath}`);
            }

            const configText = Object.entries(example.config)
                .map(([key, value]) => `<strong>${key}:</strong> <code>${value}</code>`)
                .join('<br>');

            let cardContent = `
                <div class="example-card">
                    <div class="card-header">
                        <div class="card-title">${example.title}</div>
                        <div class="card-description">${example.description}</div>
                        <div class="config-details">
                            <strong>Number:</strong> <code>${example.number}</code><br>
                            ${configText}
                        </div>
                    </div>
                    <div class="card-content">
                        ${svgContent}
                    </div>
                </div>
            `;

            // Add crop comparison if available
            if (cropData) {
                cardContent = `
                    <div class="example-card crop-comparison-card">
                        <div class="card-header">
                            <div class="card-title">${example.title}</div>
                            <div class="card-description">${example.description}</div>
                            <div class="config-details">
                                <strong>Number:</strong> <code>${example.number}</code><br>
                                ${configText}
                            </div>
                        </div>
                        <div class="crop-comparison">
                            <div class="comparison-side before">
                                <div class="side-label">🎯 Before: Original ViewBox</div>
                                <div class="svg-container">${cropData.originalSVG}</div>
                                <div class="viewbox-info">viewBox="${cropData.originalViewBox}"</div>
                            </div>
                            <div class="comparison-side after">
                                <div class="side-label">✂️ After: Crop Mark Processed</div>
                                <div class="svg-container">${cropData.croppedSVG}</div>
                                <div class="viewbox-info">viewBox="${cropData.croppedViewBox}"</div>
                            </div>
                        </div>
                        <div class="crop-stats">
                            <strong>Size Reduction:</strong> ${cropData.reduction}
                        </div>
                    </div>
                `;
            }

            return cardContent;
        }).join('\n');
    };

    const basicCards = generateCards(categorized.basic);
    const cropCards = generateCards(categorized.crop, true); // Include crop comparisons
    const debugCards = generateCards(categorized.debug);

    // Create the complete HTML with tabs
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🧮 Soroban Templates - Complete Gallery</title>
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
            margin-bottom: 20px;
        }

        .stats {
            background: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            text-align: center;
        }

        .stats-info {
            color: #666;
            font-size: 0.9rem;
        }

        /* Tab system */
        .tabs {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
            margin-bottom: 30px;
        }

        .tab-nav {
            display: flex;
            border-bottom: 1px solid #eee;
        }

        .tab-button {
            flex: 1;
            padding: 20px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1.1rem;
            font-weight: 600;
            color: #666;
            transition: all 0.3s;
            position: relative;
        }

        .tab-button:hover {
            background: #f8f9fa;
            color: #333;
        }

        .tab-button.active {
            color: #2c3e50;
            background: #f8f9fa;
        }

        .tab-button.active::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: #3498db;
        }

        .tab-content {
            display: none;
            padding: 30px;
        }

        .tab-content.active {
            display: block;
        }

        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
        }

        .example-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            overflow: hidden;
            transition: transform 0.3s, box-shadow 0.3s;
        }

        .example-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        .crop-comparison-card {
            grid-column: 1 / -1;
            max-width: none;
        }

        .card-header {
            padding: 20px;
            border-bottom: 1px solid #eee;
        }

        .card-title {
            font-size: 1.3rem;
            font-weight: 600;
            margin-bottom: 8px;
            color: #2c3e50;
        }

        .card-description {
            color: #666;
            font-size: 0.95rem;
            margin-bottom: 15px;
        }

        .config-details {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            font-size: 0.85rem;
        }

        .config-details strong {
            color: #2c3e50;
        }

        .config-details code {
            background: #e9ecef;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Consolas', monospace;
            color: #d63384;
        }

        .card-content {
            padding: 20px;
            text-align: center;
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        }

        /* Crop comparison styles */
        .crop-comparison {
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
            width: auto;
            height: auto;
            max-height: 400px;
            border: 2px solid rgba(0,0,0,0.1);
            border-radius: 8px;
            background: white;
            /* Maintain actual proportions to show cropping effect */
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

        .crop-stats {
            padding: 20px;
            text-align: center;
            background: #2c3e50;
            color: white;
            font-size: 1.1rem;
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
            .tab-nav {
                flex-direction: column;
            }

            .crop-comparison {
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
            <h1>🧮 Soroban Templates - Complete Gallery</h1>
            <p>Comprehensive showcase of template renderings, crop marks, and automated viewBox processing</p>
            <p style="font-size: 0.9rem; color: #999;">
                Generated from actual Typst templates using <code>@soroban/templates</code>
            </p>
        </div>

        <div class="stats">
            <div class="stats-info">
                <strong>${svgCount}</strong> examples rendered${missingCount > 0 ? `, <strong>${missingCount}</strong> missing` : ''}
                • Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            </div>
        </div>

        <div class="tabs">
            <div class="tab-nav">
                <button class="tab-button active" onclick="switchTab(event, 'basic')">
                    📚 Basic Examples
                </button>
                <button class="tab-button" onclick="switchTab(event, 'crop')">
                    ✂️ Crop Marks
                </button>
                <button class="tab-button" onclick="switchTab(event, 'debug')">
                    🔧 Debug Tools
                </button>
            </div>

            <div id="basic" class="tab-content active">
                <h2 style="margin-bottom: 20px; color: #2c3e50;">📚 Basic Template Examples</h2>
                <p style="margin-bottom: 30px; color: #666;">Core soroban representations showcasing different configurations, bead shapes, and color schemes.</p>
                <div class="gallery">
                    ${basicCards}
                </div>
            </div>

            <div id="crop" class="tab-content">
                <h2 style="margin-bottom: 20px; color: #2c3e50;">✂️ Crop Marks & ViewBox Processing</h2>
                <p style="margin-bottom: 30px; color: #666;">Examples demonstrating automatic crop mark placement and viewBox optimization. Each example shows before/after comparison with size reduction statistics.</p>
                <div class="gallery">
                    ${cropCards}
                </div>
            </div>

            <div id="debug" class="tab-content">
                <h2 style="margin-bottom: 20px; color: #2c3e50;">🔧 Debug & Development Tools</h2>
                <p style="margin-bottom: 30px; color: #666;">Debug examples with visible crop marks for development and testing purposes.</p>
                <div class="gallery">
                    ${debugCards}
                </div>
            </div>
        </div>

        <div class="footer">
            <h3>🛠️ How to Use This Gallery</h3>
            <p><strong>Basic Examples:</strong> Standard soroban representations for learning and reference</p>
            <p><strong>Crop Marks:</strong> Automated viewBox processing examples with before/after comparisons</p>
            <p><strong>Debug Tools:</strong> Development examples with visible crop boundaries</p>
            <p style="margin-top: 15px; font-size: 0.9rem; color: #999;">
                Built with ❤️ using <code>flashcards.typ</code> templates and Typst CLI
            </p>
        </div>
    </div>

    <script>
        function switchTab(evt, tabName) {
            // Hide all tab content
            const tabContents = document.getElementsByClassName('tab-content');
            for (let i = 0; i < tabContents.length; i++) {
                tabContents[i].classList.remove('active');
            }

            // Remove active class from all tab buttons
            const tabButtons = document.getElementsByClassName('tab-button');
            for (let i = 0; i < tabButtons.length; i++) {
                tabButtons[i].classList.remove('active');
            }

            // Show the selected tab and mark button as active
            document.getElementById(tabName).classList.add('active');
            evt.currentTarget.classList.add('active');
        }
    </script>
</body>
</html>`;

    // Write the unified gallery
    fs.writeFileSync('gallery-unified.html', html);

    console.log('\n📈 Build Summary:');
    console.log(`   ✅ SVGs embedded: ${svgCount}`);
    if (missingCount > 0) {
        console.log(`   ⚠️  SVGs missing: ${missingCount}`);
    }
    console.log(`   📁 Categories: ${Object.keys(categorized).length}`);
    console.log(`   📄 Output: gallery-unified.html`);

    console.log('\n🎉 Unified gallery built successfully!');
    console.log('   📖 Open gallery-unified.html in your browser');

    return true;
}

// Run the unified gallery builder
if (require.main === module) {
    buildUnifiedGallery();
}

module.exports = { buildUnifiedGallery };