'use client'

// Stick-on ArUco marker sheet — the "mark an abacus you already own" output of
// /create/abacus. Lifted from the former /create/vision-markers page so both
// abacus-making paths (3D print vs. paper markers) live on one surface. Prints
// the four corner markers (IDs 0-3) the app's vision pipeline rectifies against
// (lib/vision/arucoDetection.ts). The `columnCount` is what the camera read-back
// warps to — it must match the abacus these markers get stuck onto.

import { jsPDF } from 'jspdf'
import { useCallback, useEffect, useState } from 'react'
import {
  generateMarkerSVG,
  getMarkerPositionLabel,
  loadAruco,
  MARKER_IDS,
} from '@/lib/vision/arucoDetection'
import { css } from '../../../../styled-system/css'

const MARKER_SIZE_MM = 20 // default marker tile edge, in mm
const CYAN_GRADIENT = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
const PAPER_SIZES = {
  letter: {
    width: 215.9,
    height: 279.4,
    label: 'US Letter',
    format: 'letter' as const,
  },
  a4: {
    width: 210,
    height: 297,
    label: 'A4',
    format: 'a4' as const,
  },
} as const

type PaperSize = keyof typeof PAPER_SIZES

// order the corner markers read top-left → top-right → bottom-left → bottom-right
const CORNER_ORDER = [
  MARKER_IDS.TOP_LEFT,
  MARKER_IDS.TOP_RIGHT,
  MARKER_IDS.BOTTOM_LEFT,
  MARKER_IDS.BOTTOM_RIGHT,
]

export interface AbacusMarkerSheetProps {
  /** Columns on the abacus these markers get attached to — the count the camera
   *  read-back rectifies against. Purely informational copy here. */
  columnCount?: number
}

/**
 * Printable ArUco corner markers for turning an existing abacus into a
 * camera-trackable one. PDF for paper printing, SVGs for laser/inlay use.
 */
export function AbacusMarkerSheet({ columnCount }: AbacusMarkerSheetProps) {
  const [markerSize, setMarkerSize] = useState(MARKER_SIZE_MM)
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Load js-aruco2 on mount
  useEffect(() => {
    loadAruco()
      .then(() => setIsLibraryLoaded(true))
      .catch((err) => console.error('Failed to load ArUco library:', err))
  }, [])

  // Rasterize an SVG marker to a PNG data URL for embedding in the PDF
  const svgToDataUrl = useCallback((svgString: string): Promise<string> => {
    return new Promise((resolve) => {
      const blob = new Blob([svgString], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width * 2 // higher resolution
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

  // Printable PDF: all four markers on one page at true size
  const handleDownloadPrintable = useCallback(
    async (paperSize: PaperSize) => {
      const paper = PAPER_SIZES[paperSize]
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: paper.format })

      const pageWidth = paper.width
      const pageHeight = paper.height
      const margin = 20

      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Abacus Vision Calibration Markers', pageWidth / 2, margin, { align: 'center' })

      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Cut out and place on abacus corners. Print at 100% scale.', pageWidth / 2, margin + 8, {
        align: 'center',
      })

      // 2×2 grid of markers
      const spacing = 15
      const gridWidth = markerSize * 2 + spacing
      const startX = (pageWidth - gridWidth) / 2
      const startY = margin + 25

      const markerPositions = [
        { id: MARKER_IDS.TOP_LEFT, x: startX, y: startY },
        { id: MARKER_IDS.TOP_RIGHT, x: startX + markerSize + spacing, y: startY },
        { id: MARKER_IDS.BOTTOM_LEFT, x: startX, y: startY + markerSize + spacing + 15 },
        {
          id: MARKER_IDS.BOTTOM_RIGHT,
          x: startX + markerSize + spacing,
          y: startY + markerSize + spacing + 15,
        },
      ]

      for (const { id, x, y } of markerPositions) {
        const svg = generateMarkerSVG(id, 200)
        const dataUrl = await svgToDataUrl(svg)
        pdf.addImage(dataUrl, 'PNG', x, y, markerSize, markerSize)

        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'bold')
        pdf.text(getMarkerPositionLabel(id), x + markerSize / 2, y + markerSize + 5, {
          align: 'center',
        })
        pdf.setFontSize(7)
        pdf.setFont('helvetica', 'normal')
        pdf.text(`ID: ${id}`, x + markerSize / 2, y + markerSize + 9, { align: 'center' })
      }

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

      pdf.setFontSize(7)
      pdf.setTextColor(128)
      pdf.text(`Marker size: ${markerSize}mm × ${markerSize}mm | abaci.one`, pageWidth / 2, pageHeight - 10, {
        align: 'center',
      })

      pdf.save(`abacus-vision-markers-${paperSize}.pdf`)
    },
    [markerSize, svgToDataUrl]
  )

  // Individual marker SVG (for laser engraving / inlays)
  const handleDownloadMarkerSVG = useCallback(
    (markerId: number) => {
      const svg = generateMarkerSVG(markerId, markerSize * 10) // 10× for good resolution
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

  const handleDownloadAllSVGs = useCallback(() => {
    for (const id of CORNER_ORDER) {
      setTimeout(() => handleDownloadMarkerSVG(id), id * 200) // stagger downloads
    }
  }, [handleDownloadMarkerSVG])

  return (
    <div
      data-component="abacus-marker-sheet"
      className={css({ display: 'flex', flexDirection: 'column', gap: { base: 4, md: 5 } })}
    >
      {/* Primary card: preview + print controls in one cohesive block */}
      <div
        data-element="marker-print-card"
        className={css({
          bg: 'bg.surface',
          borderRadius: '2xl',
          border: '1px solid',
          borderColor: 'border.default',
          p: { base: 5, md: 6 },
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        })}
      >
        <div>
          <h3 className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'text.primary', mb: 1 })}>
            Print your markers
          </h3>
          <p className={css({ fontSize: 'sm', color: 'text.secondary', lineHeight: '1.6' })}>
            Print all four at 100% scale on sticker paper (or plain paper + double-sided tape) and
            place one on each corner of your abacus frame.
          </p>
        </div>

        {/* Column-match callout — the one shared parameter that matters here */}
        {columnCount ? (
          <div
            data-element="marker-column-note"
            className={css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: 3,
              borderLeft: '3px solid',
              borderColor: 'cyan.500',
              borderRadius: 'md',
              px: 4,
              py: 3,
              fontSize: 'sm',
              color: 'text.primary',
              lineHeight: '1.5',
            })}
            style={{ background: 'rgba(6, 182, 212, 0.08)' }}
          >
            <span aria-hidden="true" className={css({ fontSize: 'lg', lineHeight: '1' })}>
              📷
            </span>
            <span>
              These read back your <strong>{columnCount}-column</strong> abacus. If your physical
              abacus has a different number of columns,{' '}
              <a
                href="/settings"
                className={css({ color: 'cyan.600', fontWeight: 'medium', _hover: { textDecoration: 'underline' } })}
              >
                update it in Settings
              </a>{' '}
              first.
            </span>
          </div>
        ) : null}

        {/* Marker preview — the four corner tiles (kept on white for ArUco contrast) */}
        <div
          data-element="marker-preview"
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            gap: 3,
          })}
        >
          {!isLibraryLoaded
            ? CORNER_ORDER.map((id) => (
                <div
                  key={id}
                  className={css({
                    aspectRatio: '1',
                    borderRadius: 'lg',
                    bg: 'bg.canvas',
                    border: '1px solid',
                    borderColor: 'border.default',
                  })}
                />
              ))
            : CORNER_ORDER.map((id) => (
                <div
                  key={id}
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                  })}
                >
                  <div
                    // trusted, locally-generated ArUco SVG (no user input)
                    dangerouslySetInnerHTML={{ __html: generateMarkerSVG(id, 96) }}
                    className={css({
                      bg: 'white',
                      p: 2,
                      borderRadius: 'lg',
                      border: '1px solid',
                      borderColor: 'border.default',
                      lineHeight: '0',
                    })}
                  />
                  <span className={css({ fontSize: 'xs', fontWeight: 'medium', color: 'text.primary' })}>
                    {getMarkerPositionLabel(id)}
                  </span>
                </div>
              ))}
        </div>

        {/* Controls: size + download */}
        <div
          className={css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 3,
            pt: 1,
          })}
        >
          <label
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 'sm',
              color: 'text.secondary',
            })}
          >
            Marker size
            <input
              type="number"
              data-action="set-marker-size"
              value={markerSize}
              onChange={(e) => setMarkerSize(Number(e.target.value))}
              min={10}
              max={50}
              className={css({
                width: '64px',
                px: 2,
                py: 1,
                bg: 'bg.canvas',
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'border.default',
                borderRadius: 'md',
                fontSize: 'sm',
              })}
            />
            mm
          </label>

          <div className={css({ flex: 1 })} />

          {(Object.keys(PAPER_SIZES) as PaperSize[]).map((size) => (
            <button
              key={size}
              type="button"
              data-action="download-markers-pdf"
              onClick={() => handleDownloadPrintable(size)}
              disabled={!isLibraryLoaded}
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                px: 5,
                py: '10px',
                color: 'white',
                borderRadius: 'lg',
                fontWeight: 'bold',
                fontSize: 'sm',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 15px rgba(6, 182, 212, 0.3)',
                _hover: { transform: 'translateY(-1px)' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed', transform: 'none' },
              })}
              style={{ background: CYAN_GRADIENT }}
            >
              ⬇ Download {PAPER_SIZES[size].label} PDF
            </button>
          ))}
        </div>
      </div>

      {/* Placement instructions — subtle, on-theme */}
      <div
        data-element="marker-placement-instructions"
        className={css({
          bg: 'bg.surface',
          borderRadius: '2xl',
          border: '1px solid',
          borderColor: 'border.default',
          borderLeft: '3px solid',
          borderLeftColor: 'cyan.500',
          p: { base: 5, md: 6 },
        })}
      >
        <h3 className={css({ fontSize: 'md', fontWeight: 'bold', mb: 3, color: 'text.primary' })}>
          For a clean read
        </h3>
        <ul
          className={css({
            listStyleType: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            fontSize: 'sm',
            color: 'text.secondary',
            lineHeight: '1.55',
          })}
        >
          <li>
            <strong className={css({ color: 'text.primary' })}>Print at 100% scale</strong> — turn
            off "Fit to Page"; exact size matters for detection.
          </li>
          <li>
            <strong className={css({ color: 'text.primary' })}>Leave a white border</strong> — cut
            with a 2–3mm white margin around each marker.
          </li>
          <li>
            <strong className={css({ color: 'text.primary' })}>Match the corners</strong> —
            top-left → top-left, and so on around the frame (IDs 0·1·2·3).
          </li>
          <li>
            <strong className={css({ color: 'text.primary' })}>Keep them flat</strong> — flat,
            unwrinkled markers detect reliably.
          </li>
        </ul>
      </div>

      {/* Advanced: vector files for laser / inlay (tucked away) */}
      <div
        data-element="marker-advanced"
        className={css({
          bg: 'bg.surface',
          borderRadius: '2xl',
          border: '1px solid',
          borderColor: 'border.default',
          overflow: 'hidden',
        })}
      >
        <button
          type="button"
          data-action="toggle-advanced-markers"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
          className={css({
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: { base: 5, md: 6 },
            py: 4,
            bg: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'sm',
            fontWeight: 'semibold',
            color: 'text.primary',
          })}
        >
          <span>Vector files for laser cutting / inlays</span>
          <span aria-hidden="true" className={css({ color: 'text.secondary' })}>
            {advancedOpen ? '▾' : '▸'}
          </span>
        </button>
        {advancedOpen && (
          <div className={css({ px: { base: 5, md: 6 }, pb: 5, pt: 1 })}>
            <p className={css({ fontSize: 'sm', color: 'text.secondary', mb: 4, lineHeight: '1.6' })}>
              Individual SVGs — an alternative to paper or to the baked-in markers on a 3D-printed
              frame.
            </p>
            <div className={css({ display: 'flex', gap: 2, flexWrap: 'wrap' })}>
              <button
                type="button"
                data-action="download-all-svgs"
                onClick={handleDownloadAllSVGs}
                disabled={!isLibraryLoaded}
                className={neutralBtn}
              >
                Download all SVGs
              </button>
              {CORNER_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-action="download-marker-svg"
                  onClick={() => handleDownloadMarkerSVG(id)}
                  disabled={!isLibraryLoaded}
                  className={neutralBtn}
                >
                  {getMarkerPositionLabel(id)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const neutralBtn = css({
  px: 3,
  py: 2,
  bg: 'bg.canvas',
  color: 'text.primary',
  borderRadius: 'lg',
  fontSize: 'sm',
  fontWeight: 'medium',
  border: '1px solid',
  borderColor: 'border.default',
  cursor: 'pointer',
  _hover: { borderColor: 'border.emphasized' },
  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
})
