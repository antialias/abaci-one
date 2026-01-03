'use client'

import { jsPDF } from 'jspdf'
import { useCallback, useEffect, useState } from 'react'
import {
  generateMarkerSVG,
  getMarkerPositionLabel,
  loadAruco,
  MARKER_IDS,
} from '@/lib/vision/arucoDetection'
import { css } from '../../../../styled-system/css'

const MARKER_SIZE_MM = 20 // Default marker size in mm
const PAPER_SIZES = {
  letter: {
    width: 215.9,
    height: 279.4,
    label: 'US Letter (8.5" × 11")',
    format: 'letter' as const,
  },
  a4: {
    width: 210,
    height: 297,
    label: 'A4 (210mm × 297mm)',
    format: 'a4' as const,
  },
} as const

type PaperSize = keyof typeof PAPER_SIZES

/**
 * Vision Markers Download Page
 *
 * Provides printable ArUco markers for automatic abacus calibration.
 * Users can download PDFs for printing or SVGs for 3D printing integration.
 */
export default function VisionMarkersPage() {
  const [markerSize, setMarkerSize] = useState(MARKER_SIZE_MM)
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false)

  // Load js-aruco2 library on mount
  useEffect(() => {
    loadAruco()
      .then(() => setIsLibraryLoaded(true))
      .catch((err) => console.error('Failed to load ArUco library:', err))
  }, [])

  // Convert SVG to data URL for embedding in PDF
  const svgToDataUrl = useCallback((svgString: string): Promise<string> => {
    return new Promise((resolve) => {
      const blob = new Blob([svgString], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width * 2 // Higher resolution
        canvas.height = img.height * 2
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = url
    })
  }, [])

  // Download handler for printable PDF
  const handleDownloadPrintable = useCallback(
    async (paperSize: PaperSize) => {
      const paper = PAPER_SIZES[paperSize]
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: paper.format,
      })

      const pageWidth = paper.width
      const pageHeight = paper.height
      const margin = 20

      // Title
      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Abacus Vision Calibration Markers', pageWidth / 2, margin, {
        align: 'center',
      })

      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      pdf.text(
        'Cut out and place on abacus corners. Print at 100% scale.',
        pageWidth / 2,
        margin + 8,
        { align: 'center' }
      )

      // Calculate marker positions (2x2 grid)
      const spacing = 15
      const gridWidth = markerSize * 2 + spacing
      const startX = (pageWidth - gridWidth) / 2
      const startY = margin + 25

      const markerPositions = [
        { id: MARKER_IDS.TOP_LEFT, x: startX, y: startY },
        {
          id: MARKER_IDS.TOP_RIGHT,
          x: startX + markerSize + spacing,
          y: startY,
        },
        {
          id: MARKER_IDS.BOTTOM_LEFT,
          x: startX,
          y: startY + markerSize + spacing + 15,
        },
        {
          id: MARKER_IDS.BOTTOM_RIGHT,
          x: startX + markerSize + spacing,
          y: startY + markerSize + spacing + 15,
        },
      ]

      // Add each marker as an image
      for (const { id, x, y } of markerPositions) {
        const svg = generateMarkerSVG(id, 200)
        const dataUrl = await svgToDataUrl(svg)
        pdf.addImage(dataUrl, 'PNG', x, y, markerSize, markerSize)

        // Add label below marker
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'bold')
        pdf.text(getMarkerPositionLabel(id), x + markerSize / 2, y + markerSize + 5, {
          align: 'center',
        })
        pdf.setFontSize(7)
        pdf.setFont('helvetica', 'normal')
        pdf.text(`ID: ${id}`, x + markerSize / 2, y + markerSize + 9, {
          align: 'center',
        })
      }

      // Instructions
      const instructionsY = startY + markerSize * 2 + spacing + 40
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Instructions:', margin, instructionsY)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      const instructions = [
        '1. Print this page at 100% scale (no scaling/fit to page)',
        '2. Cut out each marker with a small white border (2-3mm)',
        '3. Attach to the corresponding corner of your abacus frame',
        '4. Use adhesive paper or double-sided tape for best results',
      ]
      instructions.forEach((text, i) => {
        pdf.text(text, margin, instructionsY + 6 + i * 5)
      })

      // Footer
      pdf.setFontSize(7)
      pdf.setTextColor(128)
      pdf.text(
        `Marker size: ${markerSize}mm × ${markerSize}mm | abaci.one`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )

      // Save the PDF
      pdf.save(`abacus-vision-markers-${paperSize}.pdf`)
    },
    [markerSize, svgToDataUrl]
  )

  // Download handler for individual marker SVG
  const handleDownloadMarkerSVG = useCallback(
    (markerId: number) => {
      const svg = generateMarkerSVG(markerId, markerSize * 10) // 10x for good resolution
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aruco-marker-${markerId}-${getMarkerPositionLabel(markerId).toLowerCase().replace(' ', '-')}.svg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    [markerSize]
  )

  // Download all markers as a ZIP-like bundle (actually just all SVGs)
  const handleDownloadAllSVGs = useCallback(() => {
    const markerIds = [
      MARKER_IDS.TOP_LEFT,
      MARKER_IDS.TOP_RIGHT,
      MARKER_IDS.BOTTOM_RIGHT,
      MARKER_IDS.BOTTOM_LEFT,
    ]
    for (const id of markerIds) {
      setTimeout(() => handleDownloadMarkerSVG(id), id * 200) // Stagger downloads
    }
  }, [handleDownloadMarkerSVG])

  return (
    <div
      className={css({
        minHeight: '100vh',
        bg: 'gray.50',
        py: 8,
        px: 4,
      })}
    >
      <div
        className={css({
          maxWidth: '800px',
          mx: 'auto',
        })}
      >
        {/* Header */}
        <div className={css({ textAlign: 'center', mb: 8 })}>
          <h1
            className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'gray.900',
              mb: 2,
            })}
          >
            Abacus Vision Calibration Markers
          </h1>
          <p
            className={css({
              color: 'gray.600',
              maxWidth: '600px',
              mx: 'auto',
            })}
          >
            Download ArUco markers for automatic calibration. Place these markers on the four
            corners of your abacus for instant camera calibration.
          </p>
        </div>

        {/* Marker Preview */}
        <div
          className={css({
            bg: 'white',
            borderRadius: 'xl',
            p: 6,
            shadow: 'md',
            mb: 6,
          })}
        >
          <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>Marker Preview</h2>
          {!isLibraryLoaded ? (
            <div className={css({ textAlign: 'center', py: 8, color: 'gray.500' })}>
              Loading marker library...
            </div>
          ) : (
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 4,
                maxWidth: '400px',
                mx: 'auto',
              })}
            >
              {[
                MARKER_IDS.TOP_LEFT,
                MARKER_IDS.TOP_RIGHT,
                MARKER_IDS.BOTTOM_LEFT,
                MARKER_IDS.BOTTOM_RIGHT,
              ].map((id) => (
                <div
                  key={id}
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 3,
                    border: '1px solid',
                    borderColor: 'gray.200',
                    borderRadius: 'lg',
                  })}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: generateMarkerSVG(id, 80),
                    }}
                    className={css({ mb: 2 })}
                  />
                  <span className={css({ fontSize: 'sm', fontWeight: 'medium' })}>
                    {getMarkerPositionLabel(id)}
                  </span>
                  <span className={css({ fontSize: 'xs', color: 'gray.500' })}>ID: {id}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Download Options */}
        <div
          className={css({
            bg: 'white',
            borderRadius: 'xl',
            p: 6,
            shadow: 'md',
            mb: 6,
          })}
        >
          <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
            Download for Printing
          </h2>
          <p className={css({ color: 'gray.600', fontSize: 'sm', mb: 4 })}>
            Download a printable sheet with all 4 markers. Print at 100% scale on adhesive paper or
            regular paper with double-sided tape.
          </p>

          {/* Size selector */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              mb: 4,
            })}
          >
            <label className={css({ fontSize: 'sm', color: 'gray.700' })}>
              Marker size:
              <input
                type="number"
                value={markerSize}
                onChange={(e) => setMarkerSize(Number(e.target.value))}
                min={10}
                max={50}
                className={css({
                  ml: 2,
                  width: '60px',
                  px: 2,
                  py: 1,
                  border: '1px solid',
                  borderColor: 'gray.300',
                  borderRadius: 'md',
                  fontSize: 'sm',
                })}
              />
              <span className={css({ ml: 1, color: 'gray.500' })}>mm</span>
            </label>
          </div>

          {/* Paper size buttons */}
          <div className={css({ display: 'flex', gap: 3, flexWrap: 'wrap' })}>
            {(Object.keys(PAPER_SIZES) as PaperSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handleDownloadPrintable(size)}
                disabled={!isLibraryLoaded}
                className={css({
                  px: 4,
                  py: 2,
                  bg: 'blue.600',
                  color: 'white',
                  borderRadius: 'lg',
                  fontWeight: 'medium',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: { bg: 'blue.700' },
                  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                Download {PAPER_SIZES[size].label}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Downloads for 3D Printing */}
        <div
          className={css({
            bg: 'white',
            borderRadius: 'xl',
            p: 6,
            shadow: 'md',
            mb: 6,
          })}
        >
          <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
            Vector Files for 3D Printing
          </h2>
          <p className={css({ color: 'gray.600', fontSize: 'sm', mb: 4 })}>
            Download individual SVG files to integrate into your 3D-printed abacus design. These can
            be used for laser engraving or as inlays.
          </p>

          <div className={css({ display: 'flex', gap: 3, flexWrap: 'wrap' })}>
            <button
              type="button"
              onClick={handleDownloadAllSVGs}
              disabled={!isLibraryLoaded}
              className={css({
                px: 4,
                py: 2,
                bg: 'green.600',
                color: 'white',
                borderRadius: 'lg',
                fontWeight: 'medium',
                border: 'none',
                cursor: 'pointer',
                _hover: { bg: 'green.700' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Download All SVGs
            </button>
            {[
              MARKER_IDS.TOP_LEFT,
              MARKER_IDS.TOP_RIGHT,
              MARKER_IDS.BOTTOM_RIGHT,
              MARKER_IDS.BOTTOM_LEFT,
            ].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handleDownloadMarkerSVG(id)}
                disabled={!isLibraryLoaded}
                className={css({
                  px: 3,
                  py: 2,
                  bg: 'gray.100',
                  color: 'gray.700',
                  borderRadius: 'lg',
                  fontSize: 'sm',
                  border: '1px solid',
                  borderColor: 'gray.300',
                  cursor: 'pointer',
                  _hover: { bg: 'gray.200' },
                  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                {getMarkerPositionLabel(id)}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div
          className={css({
            bg: 'blue.50',
            borderRadius: 'xl',
            p: 6,
            border: '1px solid',
            borderColor: 'blue.200',
          })}
        >
          <h2
            className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              mb: 4,
              color: 'blue.900',
            })}
          >
            Placement Instructions
          </h2>
          <ol
            className={css({
              listStyleType: 'decimal',
              pl: 5,
              color: 'blue.800',
              '& li': { mb: 2 },
            })}
          >
            <li>
              <strong>Print at 100% scale</strong> - Do not use "Fit to Page" or any scaling option.
              The markers must be printed at their exact size for accurate detection.
            </li>
            <li>
              <strong>Use adhesive paper</strong> - For best results, print on adhesive-backed paper
              or label sheets. Alternatively, use double-sided tape.
            </li>
            <li>
              <strong>Cut with white border</strong> - Leave a small white border (2-3mm) around
              each marker. This helps with detection.
            </li>
            <li>
              <strong>Place on frame corners</strong> - Attach each marker to the corresponding
              corner of your abacus frame:
              <ul className={css({ listStyleType: 'disc', pl: 5, mt: 1 })}>
                <li>Top-Left marker (ID 0) → top-left corner of frame</li>
                <li>Top-Right marker (ID 1) → top-right corner of frame</li>
                <li>Bottom-Right marker (ID 2) → bottom-right corner of frame</li>
                <li>Bottom-Left marker (ID 3) → bottom-left corner of frame</li>
              </ul>
            </li>
            <li>
              <strong>Keep markers flat</strong> - Ensure markers are flat and not wrinkled for
              reliable detection.
            </li>
          </ol>
        </div>

        {/* Back link */}
        <div className={css({ textAlign: 'center', mt: 8 })}>
          <a
            href="/"
            className={css({
              color: 'blue.600',
              textDecoration: 'underline',
              _hover: { color: 'blue.800' },
            })}
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}
