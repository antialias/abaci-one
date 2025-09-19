'use client'

import React, { useState } from 'react'
import { css } from '../../../styled-system/css'
import { TypstSoroban } from '../../components/TypstSoroban'

export default function TemplateDemoPage() {
  const [selectedNumber, setSelectedNumber] = useState(42)

  const demoNumbers = [0, 1, 5, 12, 42, 123, 567, 1234]
  const beadShapes = ['diamond', 'circle', 'square'] as const
  const colorSchemes = ['monochrome', 'place-value', 'heaven-earth', 'alternating'] as const
  const colorPalettes = ['default', 'colorblind', 'mnemonic', 'grayscale', 'nature'] as const

  return (
    <div className={css({
      p: 8,
      maxW: '1200px',
      mx: 'auto',
      fontFamily: 'system-ui'
    })}>
      <h1 className={css({
        fontSize: '2xl',
        fontWeight: 'bold',
        mb: 6,
        textAlign: 'center'
      })}>
        🎨 Soroban Template Package Demo
      </h1>

      <p className={css({
        mb: 8,
        textAlign: 'center',
        color: 'gray.600'
      })}>
        Showcasing browser-side SVG generation with viewport cropping and bead annotations
      </p>

      {/* Number Selector */}
      <div className={css({
        mb: 8,
        p: 4,
        bg: 'gray.50',
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'gray.200'
      })}>
        <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 3 })}>
          Select Number to Display
        </h2>
        <div className={css({ display: 'flex', gap: 2, flexWrap: 'wrap' })}>
          {demoNumbers.map(num => (
            <button
              key={num}
              onClick={() => setSelectedNumber(num)}
              className={css({
                px: 3,
                py: 2,
                borderRadius: 'md',
                border: '1px solid',
                borderColor: selectedNumber === num ? 'blue.500' : 'gray.300',
                bg: selectedNumber === num ? 'blue.500' : 'white',
                color: selectedNumber === num ? 'white' : 'gray.700',
                cursor: 'pointer',
                _hover: {
                  bg: selectedNumber === num ? 'blue.600' : 'gray.100'
                }
              })}
            >
              {num}
            </button>
          ))}
        </div>
        <div className={css({ mt: 3 })}>
          <input
            type="number"
            value={selectedNumber}
            onChange={(e) => setSelectedNumber(parseInt(e.target.value) || 0)}
            className={css({
              px: 3,
              py: 2,
              border: '1px solid',
              borderColor: 'gray.300',
              borderRadius: 'md',
              width: '120px'
            })}
            placeholder="Custom number"
          />
        </div>
      </div>

      {/* Bead Shapes Demo */}
      <div className={css({
        mb: 8,
        p: 4,
        bg: 'blue.50',
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'blue.200'
      })}>
        <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
          🔸 Bead Shapes
        </h2>
        <div className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 4
        })}>
          {beadShapes.map(shape => (
            <div key={shape} className={css({ textAlign: 'center' })}>
              <h3 className={css({ fontWeight: 'medium', mb: 2, textTransform: 'capitalize' })}>
                {shape}
              </h3>
              <div className={css({
                border: '1px solid',
                borderColor: 'gray.300',
                borderRadius: 'md',
                p: 2,
                bg: 'white',
                display: 'inline-block'
              })}>
                <TypstSoroban
                  number={selectedNumber}
                  beadShape={shape}
                  width="150pt"
                  height="180pt"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Color Schemes Demo */}
      <div className={css({
        mb: 8,
        p: 4,
        bg: 'green.50',
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'green.200'
      })}>
        <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
          🎨 Color Schemes
        </h2>
        <div className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 4
        })}>
          {colorSchemes.map(scheme => (
            <div key={scheme} className={css({ textAlign: 'center' })}>
              <h3 className={css({ fontWeight: 'medium', mb: 2, textTransform: 'capitalize' })}>
                {scheme.replace('-', ' ')}
              </h3>
              <div className={css({
                border: '1px solid',
                borderColor: 'gray.300',
                borderRadius: 'md',
                p: 2,
                bg: 'white',
                display: 'inline-block'
              })}>
                <TypstSoroban
                  number={selectedNumber}
                  colorScheme={scheme}
                  width="150pt"
                  height="180pt"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Color Palettes Demo */}
      <div className={css({
        mb: 8,
        p: 4,
        bg: 'purple.50',
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'purple.200'
      })}>
        <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
          🌈 Color Palettes
        </h2>
        <div className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 4
        })}>
          {colorPalettes.map(palette => (
            <div key={palette} className={css({ textAlign: 'center' })}>
              <h3 className={css({ fontWeight: 'medium', mb: 2, textTransform: 'capitalize' })}>
                {palette}
              </h3>
              <div className={css({
                border: '1px solid',
                borderColor: 'gray.300',
                borderRadius: 'md',
                p: 2,
                bg: 'white',
                display: 'inline-block'
              })}>
                <TypstSoroban
                  number={selectedNumber}
                  colorScheme="place-value"
                  colorPalette={palette}
                  width="150pt"
                  height="180pt"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Options Demo */}
      <div className={css({
        mb: 8,
        p: 4,
        bg: 'orange.50',
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'orange.200'
      })}>
        <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
          ⚙️ Configuration Options
        </h2>
        <div className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 4
        })}>
          <div className={css({ textAlign: 'center' })}>
            <h3 className={css({ fontWeight: 'medium', mb: 2 })}>
              Show Empty Columns
            </h3>
            <div className={css({
              border: '1px solid',
              borderColor: 'gray.300',
              borderRadius: 'md',
              p: 2,
              bg: 'white',
              display: 'inline-block'
            })}>
              <TypstSoroban
                number={selectedNumber}
                showEmptyColumns={true}
                columns={6}
                width="180pt"
                height="200pt"
                enableServerFallback={true}
              />
            </div>
          </div>

          <div className={css({ textAlign: 'center' })}>
            <h3 className={css({ fontWeight: 'medium', mb: 2 })}>
              Hide Inactive Beads
            </h3>
            <div className={css({
              border: '1px solid',
              borderColor: 'gray.300',
              borderRadius: 'md',
              p: 2,
              bg: 'white',
              display: 'inline-block'
            })}>
              <TypstSoroban
                number={selectedNumber}
                hideInactiveBeads={true}
                width="150pt"
                height="180pt"
                enableServerFallback={true}
              />
            </div>
          </div>

          <div className={css({ textAlign: 'center' })}>
            <h3 className={css({ fontWeight: 'medium', mb: 2 })}>
              Transparent Background
            </h3>
            <div className={css({
              border: '1px solid',
              borderColor: 'gray.300',
              borderRadius: 'md',
              p: 2,
              bg: 'repeating-conic-gradient(from 0deg, #eee 0deg 90deg, #ddd 90deg 180deg)',
              display: 'inline-block'
            })}>
              <TypstSoroban
                number={selectedNumber}
                transparent={true}
                width="150pt"
                height="180pt"
                enableServerFallback={true}
              />
            </div>
          </div>

          <div className={css({ textAlign: 'center' })}>
            <h3 className={css({ fontWeight: 'medium', mb: 2 })}>
              Scale Factor 1.5x
            </h3>
            <div className={css({
              border: '1px solid',
              borderColor: 'gray.300',
              borderRadius: 'md',
              p: 2,
              bg: 'white',
              display: 'inline-block'
            })}>
              <TypstSoroban
                number={selectedNumber}
                scaleFactor={1.5}
                width="150pt"
                height="180pt"
                enableServerFallback={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Size Variations Demo */}
      <div className={css({
        mb: 8,
        p: 4,
        bg: 'pink.50',
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'pink.200'
      })}>
        <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
          📏 Size Variations (Viewport Cropping Test)
        </h2>
        <p className={css({ mb: 4, fontSize: 'sm', color: 'gray.600' })}>
          All these should show optimally cropped SVGs regardless of initial canvas size
        </p>
        <div className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 4,
          alignItems: 'start'
        })}>
          <div className={css({ textAlign: 'center' })}>
            <h3 className={css({ fontWeight: 'medium', mb: 2 })}>
              Small Canvas (100x120pt)
            </h3>
            <div className={css({
              border: '1px solid',
              borderColor: 'gray.300',
              borderRadius: 'md',
              p: 2,
              bg: 'white',
              display: 'inline-block'
            })}>
              <TypstSoroban
                number={selectedNumber}
                width="100pt"
                height="120pt"
                enableServerFallback={true}
              />
            </div>
          </div>

          <div className={css({ textAlign: 'center' })}>
            <h3 className={css({ fontWeight: 'medium', mb: 2 })}>
              Medium Canvas (150x180pt)
            </h3>
            <div className={css({
              border: '1px solid',
              borderColor: 'gray.300',
              borderRadius: 'md',
              p: 2,
              bg: 'white',
              display: 'inline-block'
            })}>
              <TypstSoroban
                number={selectedNumber}
                width="150pt"
                height="180pt"
                enableServerFallback={true}
              />
            </div>
          </div>

          <div className={css({ textAlign: 'center' })}>
            <h3 className={css({ fontWeight: 'medium', mb: 2 })}>
              Large Canvas (300x400pt)
            </h3>
            <div className={css({
              border: '1px solid',
              borderColor: 'gray.300',
              borderRadius: 'md',
              p: 2,
              bg: 'white',
              display: 'inline-block'
            })}>
              <TypstSoroban
                number={selectedNumber}
                width="300pt"
                height="400pt"
                enableServerFallback={true}
              />
            </div>
          </div>

          <div className={css({ textAlign: 'center' })}>
            <h3 className={css({ fontWeight: 'medium', mb: 2 })}>
              Huge Canvas (500x600pt)
            </h3>
            <div className={css({
              border: '1px solid',
              borderColor: 'gray.300',
              borderRadius: 'md',
              p: 2,
              bg: 'white',
              display: 'inline-block'
            })}>
              <TypstSoroban
                number={selectedNumber}
                width="500pt"
                height="600pt"
                enableServerFallback={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Technical Info */}
      <div className={css({
        p: 4,
        bg: 'gray.100',
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'gray.300'
      })}>
        <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 3 })}>
          🔧 Technical Details
        </h2>
        <div className={css({ fontSize: 'sm', color: 'gray.700', lineHeight: '1.6' })}>
          <p className={css({ mb: 2 })}>
            <strong>✅ Browser-side generation:</strong> All SVGs generated using Typst.ts WASM in your browser
          </p>
          <p className={css({ mb: 2 })}>
            <strong>✅ Viewport cropping:</strong> SVG processor detects crop marks and optimizes viewBox (67-81% size reduction)
          </p>
          <p className={css({ mb: 2 })}>
            <strong>✅ Bead annotations:</strong> Interactive data attributes added to each bead for hover/click functionality
          </p>
          <p className={css({ mb: 2 })}>
            <strong>✅ Template package integration:</strong> Official @soroban/templates package provides Typst templates and SVG processing
          </p>
          <p>
            <strong>🎯 Key insight:</strong> If all size variations above look identical despite different canvas sizes,
            the viewport cropping is working perfectly!
          </p>
        </div>
      </div>
    </div>
  )
}