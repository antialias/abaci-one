#!/usr/bin/env node

// Simple Node.js script to generate actual SVGs for the gallery
// Run with: node generate-gallery.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const examples = [
    {
        id: 'basic-5',
        title: 'Basic Number 5',
        description: 'Simple representation of 5 with default settings',
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

function createTypstFile(example) {
    const { number, config } = example;

    // Calculate canvas size based on number length and scale
    const digits = String(number).length;
    const width = Math.max(200, digits * 80 * (config.base_size || 1.0));
    const height = Math.max(150, 120 * (config.base_size || 1.0));

    const content = `#import "../flashcards.typ": draw-soroban

#set page(width: ${width}pt, height: ${height}pt, margin: 12pt, fill: white)

#align(center + horizon)[
  #draw-soroban(
    ${number},
    columns: ${config.columns || 'auto'},
    bead-shape: "${config.bead_shape || 'diamond'}",
    color-scheme: "${config.color_scheme || 'monochrome'}",
    ${config.color_palette ? `color-palette: "${config.color_palette}",` : ''}
    ${config.show_empty ? 'show-empty: true,' : ''}
    ${config.hide_inactive ? 'hide-inactive: true,' : ''}
    ${config.show_crop_marks ? 'show-crop-marks: true,' : ''}
    ${config.crop_margin ? `crop-margin: ${config.crop_margin},` : ''}
    base-size: ${config.base_size || 1.0}
  )
]`;

    return content;
}

function generateExample(example) {
    console.log(`🎨 Generating ${example.title}...`);

    try {
        // Create temporary Typst file
        const typstFile = `gallery/temp-${example.id}.typ`;
        const svgFile = `gallery/${example.id}.svg`;

        // Ensure gallery directory exists
        if (!fs.existsSync('gallery')) {
            fs.mkdirSync('gallery');
        }

        // Write Typst file
        const typstContent = createTypstFile(example);
        fs.writeFileSync(typstFile, typstContent);

        // Compile to SVG using Typst CLI
        try {
            execSync(`typst compile --root . --format svg "${typstFile}" "${svgFile}"`, {
                stdio: 'pipe'
            });
            console.log(`✅ Generated ${example.title} -> ${svgFile}`);
        } catch (typstError) {
            console.error(`❌ Typst compilation failed for ${example.title}:`);
            console.error(typstError.message);
            return false;
        }

        // Clean up temp file
        fs.unlinkSync(typstFile);

        return true;

    } catch (error) {
        console.error(`❌ Error generating ${example.title}:`, error.message);
        return false;
    }
}

function updateGalleryHtml() {
    console.log('📝 Updating gallery.html with generated SVGs...');

    try {
        let htmlContent = fs.readFileSync('gallery.html', 'utf8');

        // Replace the generateTypstSvg function to load actual SVG files
        const svgLoaderFunction = `
        function generateTypstSvg(example) {
            // Load the actual generated SVG file
            const svgPath = 'gallery/' + example.id + '.svg';

            // In a real browser environment, you'd need to fetch the SVG
            // For now, this is a placeholder that would be handled differently
            return \`
                <div style="text-align: center;">
                    <img src="\${svgPath}" alt="Soroban for \${example.number}"
                         style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;">
                    <div style="margin-top: 10px; font-size: 0.8rem; color: #666;">
                        SVG: \${svgPath}
                    </div>
                </div>
            \`;
        }`;

        // This is a placeholder - in reality you'd want a more sophisticated approach
        console.log('📄 HTML gallery template is ready - manually integrate SVG loading as needed');

    } catch (error) {
        console.error('❌ Error updating gallery.html:', error.message);
    }
}

async function main() {
    console.log('🚀 Starting Soroban Templates Gallery Generation\n');

    // Check if typst is available
    try {
        execSync('typst --version', { stdio: 'pipe' });
        console.log('✅ Typst CLI found');
    } catch (error) {
        console.error('❌ Typst CLI not found. Please install Typst first.');
        console.error('   Visit: https://typst.app/download/');
        process.exit(1);
    }

    // Check if flashcards.typ exists
    if (!fs.existsSync('flashcards.typ')) {
        console.error('❌ flashcards.typ not found. Make sure you\'re running this from the templates directory.');
        process.exit(1);
    }

    console.log(`📊 Generating ${examples.length} gallery examples...\n`);

    let successful = 0;
    let failed = 0;

    for (const example of examples) {
        if (generateExample(example)) {
            successful++;
        } else {
            failed++;
        }
    }

    console.log('\n📈 Generation Summary:');
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📁 Output directory: gallery/`);

    if (successful > 0) {
        console.log('\n🎉 Gallery generation complete!');
        console.log('   📁 SVG files are in the gallery/ directory');

        // List generated files
        if (fs.existsSync('gallery')) {
            const files = fs.readdirSync('gallery').filter(f => f.endsWith('.svg'));
            if (files.length > 0) {
                console.log('\n📄 Generated SVG files:');
                files.forEach(file => {
                    console.log(`   - gallery/${file}`);
                });
            }
        }
    }
}

// Run the generator
if (require.main === module) {
    main().catch(console.error);
}