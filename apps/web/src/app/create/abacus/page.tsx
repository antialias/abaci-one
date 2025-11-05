'use client'

import { useTranslations } from 'next-intl'
import { JobMonitor } from '@/components/3d-print/JobMonitor'
import { PageWithNav } from '@/components/PageWithNav'
import { STLPreview } from '@/components/3d-print/STLPreview'
import { useState } from 'react'
import { css } from '../../../../styled-system/css'

export default function ThreeDPrintPage() {
  const t = useTranslations('create.abacus')
  // New unified parameter system
  const [columns, setColumns] = useState(4)
  const [scaleFactor, setScaleFactor] = useState(1.5)
  const [widthMm, setWidthMm] = useState<number | undefined>(undefined)
  const [format, setFormat] = useState<'stl' | '3mf' | 'scad'>('stl')

  // 3MF color options
  const [frameColor, setFrameColor] = useState('#8b7355')
  const [heavenBeadColor, setHeavenBeadColor] = useState('#e8d5c4')
  const [earthBeadColor, setEarthBeadColor] = useState('#6b5444')
  const [decorationColor, setDecorationColor] = useState('#d4af37')

  const [jobId, setJobId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    setIsComplete(false)

    try {
      const response = await fetch('/api/abacus/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns,
          scaleFactor,
          widthMm,
          format,
          // Include 3MF colors if format is 3mf
          ...(format === '3mf' && {
            frameColor,
            heavenBeadColor,
            earthBeadColor,
            decorationColor,
          }),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate file')
      }

      const data = await response.json()
      setJobId(data.jobId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsGenerating(false)
    }
  }

  const handleJobComplete = () => {
    setIsComplete(true)
    setIsGenerating(false)
  }

  const handleDownload = () => {
    if (!jobId) return
    window.location.href = `/api/abacus/download/${jobId}`
  }

  return (
    <PageWithNav navTitle={t('navTitle')} navEmoji="🖨️">
      <div
        data-component="3d-print-page"
        className={css({
          maxWidth: '1200px',
          mx: 'auto',
          p: 6,
        })}
      >
        <h1
          className={css({
            fontSize: '3xl',
            fontWeight: 'bold',
            mb: 2,
          })}
        >
          {t('pageTitle')}
        </h1>

        <p className={css({ mb: 6, color: 'gray.600' })}>{t('pageSubtitle')}</p>

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', md: '1fr 1fr' },
          gap: 8,
        })}
      >
        {/* Left column: Controls */}
        <div data-section="controls">
          <div
            className={css({
              bg: 'white',
              p: 6,
              borderRadius: '8px',
              boxShadow: 'md',
            })}
          >
            <h2
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                mb: 4,
              })}
            >
              {t('customizationTitle')}
            </h2>

            {/* Number of Columns */}
            <div data-setting="columns" className={css({ mb: 4 })}>
              <label
                className={css({
                  display: 'block',
                  fontWeight: 'medium',
                  mb: 2,
                })}
              >
                {t('columns.label', { count: columns })}
              </label>
              <input
                type="range"
                min="1"
                max="13"
                step="1"
                value={columns}
                onChange={(e) => setColumns(Number.parseInt(e.target.value, 10))}
                className={css({ width: '100%' })}
              />
              <div
                className={css({
                  fontSize: 'sm',
                  color: 'gray.500',
                  mt: 1,
                })}
              >
                {t('columns.help')}
              </div>
            </div>

            {/* Scale Factor */}
            <div data-setting="scale-factor" className={css({ mb: 4 })}>
              <label
                className={css({
                  display: 'block',
                  fontWeight: 'medium',
                  mb: 2,
                })}
              >
                {t('scaleFactor.label', { factor: scaleFactor.toFixed(1) })}
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={scaleFactor}
                onChange={(e) => setScaleFactor(Number.parseFloat(e.target.value))}
                className={css({ width: '100%' })}
              />
              <div
                className={css({
                  fontSize: 'sm',
                  color: 'gray.500',
                  mt: 1,
                })}
              >
                {t('scaleFactor.help')}
              </div>
            </div>

            {/* Optional Width in mm */}
            <div data-setting="width-mm" className={css({ mb: 4 })}>
              <label
                className={css({
                  display: 'block',
                  fontWeight: 'medium',
                  mb: 2,
                })}
              >
                {t('widthMm.label')}
              </label>
              <input
                type="number"
                min="50"
                max="500"
                step="1"
                value={widthMm ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  setWidthMm(value ? Number.parseFloat(value) : undefined)
                }}
                placeholder={t('widthMm.placeholder')}
                className={css({
                  width: '100%',
                  px: 3,
                  py: 2,
                  border: '1px solid',
                  borderColor: 'gray.300',
                  borderRadius: '4px',
                  _focus: {
                    outline: 'none',
                    borderColor: 'blue.500',
                  },
                })}
              />
              <div
                className={css({
                  fontSize: 'sm',
                  color: 'gray.500',
                  mt: 1,
                })}
              >
                {t('widthMm.help')}
              </div>
            </div>

            {/* Format Selection */}
            <div data-setting="format" className={css({ mb: format === '3mf' ? 4 : 6 })}>
              <label
                className={css({
                  display: 'block',
                  fontWeight: 'medium',
                  mb: 2,
                })}
              >
                {t('format.label')}
              </label>
              <div className={css({ display: 'flex', gap: 2, flexWrap: 'wrap' })}>
                <button
                  type="button"
                  onClick={() => setFormat('stl')}
                  className={css({
                    px: 4,
                    py: 2,
                    borderRadius: '4px',
                    border: '2px solid',
                    borderColor: format === 'stl' ? 'blue.600' : 'gray.300',
                    bg: format === 'stl' ? 'blue.50' : 'white',
                    color: format === 'stl' ? 'blue.700' : 'gray.700',
                    cursor: 'pointer',
                    fontWeight: format === 'stl' ? 'bold' : 'normal',
                    _hover: { bg: format === 'stl' ? 'blue.100' : 'gray.50' },
                  })}
                >
                  STL
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('3mf')}
                  className={css({
                    px: 4,
                    py: 2,
                    borderRadius: '4px',
                    border: '2px solid',
                    borderColor: format === '3mf' ? 'blue.600' : 'gray.300',
                    bg: format === '3mf' ? 'blue.50' : 'white',
                    color: format === '3mf' ? 'blue.700' : 'gray.700',
                    cursor: 'pointer',
                    fontWeight: format === '3mf' ? 'bold' : 'normal',
                    _hover: { bg: format === '3mf' ? 'blue.100' : 'gray.50' },
                  })}
                >
                  3MF
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('scad')}
                  className={css({
                    px: 4,
                    py: 2,
                    borderRadius: '4px',
                    border: '2px solid',
                    borderColor: format === 'scad' ? 'blue.600' : 'gray.300',
                    bg: format === 'scad' ? 'blue.50' : 'white',
                    color: format === 'scad' ? 'blue.700' : 'gray.700',
                    cursor: 'pointer',
                    fontWeight: format === 'scad' ? 'bold' : 'normal',
                    _hover: { bg: format === 'scad' ? 'blue.100' : 'gray.50' },
                  })}
                >
                  OpenSCAD
                </button>
              </div>
            </div>

            {/* 3MF Color Options */}
            {format === '3mf' && (
              <div data-section="3mf-colors" className={css({ mb: 6 })}>
                <h3
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'bold',
                    mb: 3,
                  })}
                >
                  {t('colors.title')}
                </h3>

                {/* Frame Color */}
                <div data-setting="frame-color" className={css({ mb: 3 })}>
                  <label
                    className={css({
                      display: 'block',
                      fontWeight: 'medium',
                      mb: 1,
                    })}
                  >
                    {t('colors.frame')}
                  </label>
                  <div className={css({ display: 'flex', gap: 2, alignItems: 'center' })}>
                    <input
                      type="color"
                      value={frameColor}
                      onChange={(e) => setFrameColor(e.target.value)}
                      className={css({ width: '60px', height: '40px', cursor: 'pointer' })}
                    />
                    <input
                      type="text"
                      value={frameColor}
                      onChange={(e) => setFrameColor(e.target.value)}
                      placeholder="#8b7355"
                      className={css({
                        flex: 1,
                        px: 3,
                        py: 2,
                        border: '1px solid',
                        borderColor: 'gray.300',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      })}
                    />
                  </div>
                </div>

                {/* Heaven Bead Color */}
                <div data-setting="heaven-bead-color" className={css({ mb: 3 })}>
                  <label
                    className={css({
                      display: 'block',
                      fontWeight: 'medium',
                      mb: 1,
                    })}
                  >
                    {t('colors.heavenBead')}
                  </label>
                  <div className={css({ display: 'flex', gap: 2, alignItems: 'center' })}>
                    <input
                      type="color"
                      value={heavenBeadColor}
                      onChange={(e) => setHeavenBeadColor(e.target.value)}
                      className={css({ width: '60px', height: '40px', cursor: 'pointer' })}
                    />
                    <input
                      type="text"
                      value={heavenBeadColor}
                      onChange={(e) => setHeavenBeadColor(e.target.value)}
                      placeholder="#e8d5c4"
                      className={css({
                        flex: 1,
                        px: 3,
                        py: 2,
                        border: '1px solid',
                        borderColor: 'gray.300',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      })}
                    />
                  </div>
                </div>

                {/* Earth Bead Color */}
                <div data-setting="earth-bead-color" className={css({ mb: 3 })}>
                  <label
                    className={css({
                      display: 'block',
                      fontWeight: 'medium',
                      mb: 1,
                    })}
                  >
                    {t('colors.earthBead')}
                  </label>
                  <div className={css({ display: 'flex', gap: 2, alignItems: 'center' })}>
                    <input
                      type="color"
                      value={earthBeadColor}
                      onChange={(e) => setEarthBeadColor(e.target.value)}
                      className={css({ width: '60px', height: '40px', cursor: 'pointer' })}
                    />
                    <input
                      type="text"
                      value={earthBeadColor}
                      onChange={(e) => setEarthBeadColor(e.target.value)}
                      placeholder="#6b5444"
                      className={css({
                        flex: 1,
                        px: 3,
                        py: 2,
                        border: '1px solid',
                        borderColor: 'gray.300',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      })}
                    />
                  </div>
                </div>

                {/* Decoration Color */}
                <div data-setting="decoration-color" className={css({ mb: 0 })}>
                  <label
                    className={css({
                      display: 'block',
                      fontWeight: 'medium',
                      mb: 1,
                    })}
                  >
                    {t('colors.decoration')}
                  </label>
                  <div className={css({ display: 'flex', gap: 2, alignItems: 'center' })}>
                    <input
                      type="color"
                      value={decorationColor}
                      onChange={(e) => setDecorationColor(e.target.value)}
                      className={css({ width: '60px', height: '40px', cursor: 'pointer' })}
                    />
                    <input
                      type="text"
                      value={decorationColor}
                      onChange={(e) => setDecorationColor(e.target.value)}
                      placeholder="#d4af37"
                      className={css({
                        flex: 1,
                        px: 3,
                        py: 2,
                        border: '1px solid',
                        borderColor: 'gray.300',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              data-action="generate"
              className={css({
                width: '100%',
                px: 6,
                py: 3,
                bg: 'blue.600',
                color: 'white',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.6 : 1,
                _hover: { bg: isGenerating ? 'blue.600' : 'blue.700' },
              })}
            >
              {isGenerating ? t('generate.generating') : t('generate.button')}
            </button>

            {/* Job Status */}
            {jobId && !isComplete && (
              <div className={css({ mt: 4 })}>
                <JobMonitor jobId={jobId} onComplete={handleJobComplete} />
              </div>
            )}

            {/* Download Button */}
            {isComplete && (
              <button
                type="button"
                onClick={handleDownload}
                data-action="download"
                className={css({
                  width: '100%',
                  mt: 4,
                  px: 6,
                  py: 3,
                  bg: 'green.600',
                  color: 'white',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  _hover: { bg: 'green.700' },
                })}
              >
                {t('download', { format: format.toUpperCase() })}
              </button>
            )}

            {/* Error Message */}
            {error && (
              <div
                data-status="error"
                className={css({
                  mt: 4,
                  p: 4,
                  bg: 'red.100',
                  borderRadius: '4px',
                  color: 'red.700',
                })}
              >
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Preview */}
        <div data-section="preview">
          <div
            className={css({
              bg: 'white',
              p: 6,
              borderRadius: '8px',
              boxShadow: 'md',
            })}
          >
            <h2
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                mb: 4,
              })}
            >
              {t('preview.title')}
            </h2>
            <STLPreview columns={columns} scaleFactor={scaleFactor} />
            <div
              className={css({
                mt: 4,
                fontSize: 'sm',
                color: 'gray.600',
              })}
            >
              <p className={css({ mb: 2 })}>{t('preview.liveDescription')}</p>
              <p className={css({ mb: 2 })}>{t('preview.note')}</p>
              <p>{t('preview.instructions')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </PageWithNav>
  )
}
