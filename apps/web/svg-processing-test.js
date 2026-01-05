#!/usr/bin/env node

// Test script to verify SVG processing is working
// This will test both browser-side and server-side processing

const { generateSorobanSVG } = require('./src/lib/typst-soroban.ts')

async function testSVGProcessing() {
  console.log('🧪 Testing SVG processing...\n')

  // Test configuration
  const testConfig = {
    number: 23,
    width: '120pt',
    height: '160pt',
    beadShape: 'diamond',
    colorScheme: 'place-value',
    hideInactiveBeads: false,
    enableServerFallback: false,
  }

  try {
    console.log('📋 Test Configuration:')
    console.log(JSON.stringify(testConfig, null, 2))
    console.log('\n🚀 Generating SVG...\n')

    const svg = await generateSorobanSVG(testConfig)

    console.log('✅ SVG generated successfully!')
    console.log(`📏 SVG length: ${svg.length} characters`)

    // Check for processing evidence
    console.log('\n🔍 Checking for processing evidence:')

    // Check viewBox
    const viewBoxMatch = svg.match(/viewBox="([^"]*)"/)
    if (viewBoxMatch) {
      console.log(`✓ ViewBox found: ${viewBoxMatch[1]}`)
    } else {
      console.log('❌ No viewBox found')
    }

    // Check for crop marks (should be present but could be removed)
    const hasCropMarks = svg.includes('crop-mark://')
    console.log(
      `${hasCropMarks ? '✓' : '❌'} Crop marks: ${hasCropMarks ? 'present' : 'not found'}`
    )

    // Check for bead data attributes (evidence of processing)
    const hasBeadData = svg.includes('data-bead-')
    console.log(
      `${hasBeadData ? '✓' : '❌'} Bead data attributes: ${hasBeadData ? 'present' : 'not found'}`
    )

    // Check for original typst elements vs processed elements
    const hasTypstGroups = svg.includes('class="typst-group"')
    console.log(
      `${hasTypstGroups ? '✓' : '❌'} Typst groups: ${hasTypstGroups ? 'present' : 'not found'}`
    )

    // Extract some sample data attributes to verify processing
    const dataAttrMatches = svg.match(/data-bead-[^=]+=["'][^"']*["']/g)
    if (dataAttrMatches && dataAttrMatches.length > 0) {
      console.log(`✓ Found ${dataAttrMatches.length} bead data attributes:`)
      dataAttrMatches.slice(0, 3).forEach((attr) => {
        console.log(`  - ${attr}`)
      })
      if (dataAttrMatches.length > 3) {
        console.log(`  - ... and ${dataAttrMatches.length - 3} more`)
      }
    }

    // Check for size optimization evidence
    const dimensions = svg.match(/width="([^"]*)".*height="([^"]*)"/)
    if (dimensions) {
      console.log(`✓ Dimensions: ${dimensions[1]} × ${dimensions[2]}`)
    }

    console.log('\n📊 Summary:')
    console.log(`- SVG generation: ✅ SUCCESS`)
    console.log(`- ViewBox optimization: ${viewBoxMatch ? '✅' : '❌'}`)
    console.log(`- Bead annotation processing: ${hasBeadData ? '✅' : '❌'}`)
    console.log(`- Crop mark detection: ${hasCropMarks ? '✅' : '❌'}`)

    if (hasBeadData && viewBoxMatch) {
      console.log('\n🎯 CONCLUSION: SVG processor is working correctly!')
      console.log('   - ViewBox has been optimized for cropping')
      console.log('   - Bead annotations have been extracted and converted to data attributes')
    } else {
      console.log('\n⚠️  CONCLUSION: SVG processor may not be working as expected')
      console.log('   - Check the processSVG function calls in the generation pipeline')
    }

    // Save a sample for manual inspection
    require('fs').writeFileSync('./sample-processed.svg', svg)
    console.log('\n💾 Sample SVG saved to ./sample-processed.svg for manual inspection')
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Stack:', error.stack)
  }
}

// Run the test
testSVGProcessing().catch(console.error)
