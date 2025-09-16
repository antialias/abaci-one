#!/usr/bin/env node

// Static site generator for the soroban templates gallery
// Creates a complete HTML page with embedded SVGs

const fs = require('fs');
const path = require('path');

const examples = [
    {
        id: 'basic-5',
        title: 'Basic Number 5',
        description: 'Simple representation of 5 with monochrome diamonds',
        number: 5,
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
        config: {
            bead_shape: 'circle',
            color_scheme: 'place-value',
            show_empty: true,
            base_size: 1.3
        }
    },
    {
        id: 'debug-crop-marks-89',
        title: 'Debug: Crop Marks - 89',
        description: 'Visible red crop marks showing viewBox boundaries',
        number: 89,
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
        config: {
            bead_shape: 'circle',
            color_scheme: 'heaven-earth',
            show_crop_marks: true,
            crop_margin: '12pt',
            base_size: 1.2
        }
    }
];

function buildStaticGallery() {
    console.log('🏗️  Building static soroban gallery...');

    let svgCount = 0;
    let missingCount = 0;

    // Generate the example cards HTML
    const exampleCards = examples.map(example => {
        const svgPath = `gallery/${example.id}.svg`;
        let svgContent = '';

        if (fs.existsSync(svgPath)) {
            svgContent = fs.readFileSync(svgPath, 'utf8');
            svgCount++;
            console.log(`✅ Embedded ${example.id}.svg`);
        } else {
            svgContent = `
                <div style="text-align: center; padding: 40px; color: #666; border: 2px dashed #ddd; border-radius: 8px;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
                    <div>SVG not generated</div>
                    <div style="font-size: 0.8rem; margin-top: 10px;">
                        Run <code>npm run gallery</code> first
                    </div>
                </div>
            `;
            missingCount++;
            console.log(`⚠️  Missing ${svgPath}`);
        }

        const configText = Object.entries(example.config)
            .map(([key, value]) => `<strong>${key}:</strong> <code>${value}</code>`)
            .join('<br>');

        return `
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
    }).join('\n');

    // Create the complete HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🧮 Soroban Templates Gallery</title>
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
            max-width: 1200px;
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

        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 30px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            color: #666;
        }

        .footer h3 {
            color: #2c3e50;
            margin-bottom: 15px;
        }

        .footer p {
            margin-bottom: 10px;
        }

        .footer code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧮 Soroban Templates Gallery</h1>
            <p>Static showcase of soroban template renderings with different configurations</p>
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

        <div class="gallery">
            ${exampleCards}
        </div>

        <div class="footer">
            <h3>🛠️ How to Update This Gallery</h3>
            <p>This is a static gallery generated from your Typst templates.</p>
            <p>To regenerate with fresh examples:</p>
            <p><code>npm run gallery</code> → <code>node build-gallery.js</code></p>
            <p style="margin-top: 15px; font-size: 0.9rem; color: #999;">
                Built with ❤️ using actual <code>flashcards.typ</code> templates and Typst CLI
            </p>
        </div>
    </div>
</body>
</html>`;

    // Write the static gallery
    fs.writeFileSync('gallery-static.html', html);

    console.log('\n📈 Build Summary:');
    console.log(`   ✅ SVGs embedded: ${svgCount}`);
    if (missingCount > 0) {
        console.log(`   ⚠️  SVGs missing: ${missingCount}`);
    }
    console.log(`   📄 Output: gallery-static.html`);

    console.log('\n🎉 Static gallery built successfully!');
    console.log('   📖 Open gallery-static.html in your browser');

    return true;
}

// Run the static site generator
if (require.main === module) {
    buildStaticGallery();
}