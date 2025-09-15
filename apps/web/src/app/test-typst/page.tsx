'use client'

import { useState } from 'react'
import { TypstSoroban } from '@/components/TypstSoroban'
import { css } from '../../../styled-system/css'
import { container, stack, grid, hstack } from '../../../styled-system/patterns'

export default function TestTypstPage() {
  const [selectedNumber, setSelectedNumber] = useState(23)
  const [generationCount, setGenerationCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)

  const testNumbers = [5, 23, 67, 123, 456]

  return (
    <div className={css({ minH: 'screen', bg: 'gray.50', py: '8' })}>
      <div className={container({ maxW: '6xl', px: '4' })}>
        <div className={stack({ gap: '8' })}>
          {/* Header */}
          <div className={stack({ gap: '4', textAlign: 'center' })}>
            <h1 className={css({
              fontSize: '3xl',
              fontWeight: 'bold',
              color: 'gray.900'
            })}>
              Typst.ts Integration Test
            </h1>
            <p className={css({
              fontSize: 'lg',
              color: 'gray.600'
            })}>
              Testing browser-only Soroban SVG generation (no server fallback)
            </p>
            <div className={hstack({ gap: '6', justify: 'center' })}>
              <div className={css({
                px: '3',
                py: '1',
                bg: 'green.100',
                color: 'green.700',
                rounded: 'full',
                fontSize: 'sm'
              })}>
                Generated: {generationCount}
              </div>
              <div className={css({
                px: '3',
                py: '1',
                bg: errorCount > 0 ? 'red.100' : 'gray.100',
                color: errorCount > 0 ? 'red.700' : 'gray.700',
                rounded: 'full',
                fontSize: 'sm'
              })}>
                Errors: {errorCount}
              </div>
            </div>
          </div>

          {/* Number Selector */}
          <div className={css({
            bg: 'white',
            rounded: 'xl',
            p: '6',
            shadow: 'card'
          })}>
            <h3 className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              mb: '4'
            })}>
              Select Number to Generate
            </h3>
            <div className={hstack({ gap: '3', flexWrap: 'wrap' })}>
              {testNumbers.map((num) => (
                <button
                  key={num}
                  onClick={() => setSelectedNumber(num)}
                  className={css({
                    px: '4',
                    py: '2',
                    rounded: 'lg',
                    border: '2px solid',
                    borderColor: selectedNumber === num ? 'brand.600' : 'gray.200',
                    bg: selectedNumber === num ? 'brand.50' : 'white',
                    color: selectedNumber === num ? 'brand.700' : 'gray.700',
                    fontWeight: 'medium',
                    transition: 'all',
                    _hover: {
                      borderColor: 'brand.400',
                      bg: 'brand.25'
                    }
                  })}
                >
                  {num}
                </button>
              ))}
              <input
                type="number"
                value={selectedNumber}
                onChange={(e) => setSelectedNumber(parseInt(e.target.value) || 0)}
                className={css({
                  w: '20',
                  px: '3',
                  py: '2',
                  border: '2px solid',
                  borderColor: 'gray.200',
                  rounded: 'lg',
                  fontSize: 'sm',
                  _focus: {
                    borderColor: 'brand.400',
                    outline: 'none'
                  }
                })}
                min="0"
                max="9999"
              />
            </div>
          </div>

          {/* Generated Soroban */}
          <div className={css({
            bg: 'white',
            rounded: 'xl',
            p: '6',
            shadow: 'card'
          })}>
            <h3 className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              mb: '4'
            })}>
              Generated Soroban (Number: {selectedNumber})
            </h3>
            <div className={css({
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minH: '300px',
              bg: 'gray.50',
              rounded: 'lg',
              border: '1px solid',
              borderColor: 'gray.200'
            })}>
              <TypstSoroban
                number={selectedNumber}
                width="200pt"
                height="250pt"
                enableServerFallback={false}
                lazy={false}
                onSuccess={() => setGenerationCount(prev => prev + 1)}
                onError={() => setErrorCount(prev => prev + 1)}
                className={css({
                  maxW: 'sm',
                  maxH: '400px'
                })}
              />
            </div>
          </div>

          {/* Test Grid */}
          <div className={css({
            bg: 'white',
            rounded: 'xl',
            p: '6',
            shadow: 'card'
          })}>
            <h3 className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              mb: '4'
            })}>
              Test Grid (Multiple Numbers)
            </h3>
            <div className={grid({
              columns: { base: 2, md: 3, lg: 5 },
              gap: '4'
            })}>
              {testNumbers.map((num, index) => (
                <div
                  key={num}
                  className={css({
                    aspectRatio: '3/4',
                    bg: 'gray.50',
                    rounded: 'lg',
                    border: '1px solid',
                    borderColor: 'gray.200',
                    overflow: 'hidden'
                  })}
                >
                  <div className={css({
                    p: '2',
                    bg: 'white',
                    borderBottom: '1px solid',
                    borderColor: 'gray.200',
                    textAlign: 'center',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1'
                  })}>
                    {num}
                    {index > 1 && <span className={css({ fontSize: 'xs', color: 'blue.600' })}>lazy</span>}
                  </div>
                  <div className={css({ p: '2', h: 'full' })}>
                    <TypstSoroban
                      number={num}
                      width="100pt"
                      height="120pt"
                      enableServerFallback={false}
                      lazy={index > 1} // Make the last 3 components lazy
                      onSuccess={() => setGenerationCount(prev => prev + 1)}
                      onError={() => setErrorCount(prev => prev + 1)}
                      className={css({ w: 'full', h: 'full' })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className={css({
            bg: 'blue.50',
            border: '1px solid',
            borderColor: 'blue.200',
            rounded: 'xl',
            p: '6'
          })}>
            <h3 className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              color: 'blue.900',
              mb: '3'
            })}>
              About This Test
            </h3>
            <div className={stack({ gap: '2' })}>
              <p className={css({ color: 'blue.800', fontSize: 'sm' })}>
                • This page tests the typst.ts integration for generating Soroban SVGs directly in the browser
              </p>
              <p className={css({ color: 'blue.800', fontSize: 'sm' })}>
                • No Python bridge required - everything runs natively in TypeScript/WebAssembly
              </p>
              <p className={css({ color: 'blue.800', fontSize: 'sm' })}>
                • WASM preloading starts automatically in background for better performance
              </p>
              <p className={css({ color: 'blue.800', fontSize: 'sm' })}>
                • Lazy loading demo: Last 3 grid items show placeholders until clicked (progressive enhancement)
              </p>
              <p className={css({ color: 'blue.800', fontSize: 'sm' })}>
                • Global abacus display settings are automatically applied
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}