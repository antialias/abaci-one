// Test file for typst.ts integration
// This will test if we can render our existing Typst templates using typst.ts

import { $typst } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs'
import fs from 'fs'

async function testBasicTypst() {
  console.log('🧪 Testing basic typst.ts functionality...')

  try {
    // Test basic rendering
    const result = await $typst.svg({ mainContent: 'Hello, typst!' })
    console.log('✅ Basic typst.ts working!')
    console.log('📏 SVG length:', result.length)
    return true
  } catch (error) {
    console.error('❌ Basic typst.ts failed:', error)
    return false
  }
}

async function testSorobanTemplate() {
  console.log('🧮 Testing soroban template rendering...')

  try {
    // Read our existing flashcards.typ template
    const { FLASHCARDS_TEMPLATE, SINGLE_CARD_TEMPLATE } = require('@soroban/templates')
    const flashcardsTemplate = fs.readFileSync(FLASHCARDS_TEMPLATE, 'utf-8')
    const singleCardTemplate = fs.readFileSync(SINGLE_CARD_TEMPLATE, 'utf-8')

    console.log('📁 Templates loaded successfully')
    console.log('📏 flashcards.typ length:', flashcardsTemplate.length)
    console.log('📏 single-card.typ length:', singleCardTemplate.length)

    // Create a simple test document that uses our templates
    const testContent = `
${flashcardsTemplate}

// Test drawing a simple soroban for number 5
#draw-soroban(5, columns: auto, show-empty: false, hide-inactive: false, bead-shape: "diamond", color-scheme: "place-value", base-size: 1.0)
`

    console.log('🎯 Attempting to render soroban for number 5...')

    const result = await $typst.svg({ mainContent: testContent })

    console.log('✅ Soroban template rendering successful!')
    console.log('📏 Generated SVG length:', result.length)
    console.log('🔍 SVG preview:', `${result.substring(0, 200)}...`)

    // Save the result for inspection
    fs.writeFileSync('/tmp/soroban-test.svg', result)
    console.log('💾 Saved test SVG to /tmp/soroban-test.svg')

    return result
  } catch (error) {
    console.error('❌ Soroban template rendering failed:', error)
    console.error('📋 Error details:', error.message)
    return null
  }
}

async function testSingleCard() {
  console.log('🃏 Testing single card template...')

  try {
    // Read templates
    const { FLASHCARDS_TEMPLATE, SINGLE_CARD_TEMPLATE } = require('@soroban/templates')
    const flashcardsTemplate = fs.readFileSync(FLASHCARDS_TEMPLATE, 'utf-8')
    const singleCardTemplate = fs.readFileSync(SINGLE_CARD_TEMPLATE, 'utf-8')

    // Extract just the functions we need from single-card.typ and inline them
    // Remove the import line and create an inlined version
    const singleCardInlined = singleCardTemplate.replace(
      '#import "flashcards.typ": draw-soroban',
      '// Inlined draw-soroban from flashcards.typ'
    )

    // Create test content using inlined single-card template
    const testContent = `
${flashcardsTemplate}
${singleCardInlined}

#set page(
  width: 120pt,
  height: 160pt,
  margin: 0pt,
  fill: white
)

#set text(font: "DejaVu Sans", size: 48pt, fallback: true)

#align(center + horizon)[
  #box(
    width: 120pt - 2 * (120pt * 0.05),
    height: 160pt - 2 * (160pt * 0.05)
  )[
    #align(center + horizon)[
      #scale(x: 100%, y: 100%)[
        #draw-soroban(
          23,
          columns: auto,
          show-empty: false,
          hide-inactive: false,
          bead-shape: "diamond",
          color-scheme: "place-value",
          color-palette: "default",
          base-size: 1.0
        )
      ]
    ]
  ]
]
`

    console.log('🎯 Attempting to render single card for number 23...')

    const result = await $typst.svg({ mainContent: testContent })

    console.log('✅ Single card rendering successful!')
    console.log('📏 Generated SVG length:', result.length)

    // Save the result
    fs.writeFileSync('/tmp/single-card-test.svg', result)
    console.log('💾 Saved single card test SVG to /tmp/single-card-test.svg')

    return result
  } catch (error) {
    console.error('❌ Single card rendering failed:', error)
    console.error('📋 Error details:', error.message)
    return null
  }
}

// Run the tests
async function runTests() {
  console.log('🚀 Starting typst.ts integration tests...\n')

  const basicTest = await testBasicTypst()
  if (!basicTest) {
    console.log('❌ Basic test failed, aborting further tests')
    return
  }

  console.log('\n')
  await testSorobanTemplate()

  console.log('\n')
  await testSingleCard()

  console.log('\n🏁 Tests completed!')
}

runTests().catch(console.error)
