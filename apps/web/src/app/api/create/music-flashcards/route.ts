import { jsPDF } from 'jspdf'
import { NextResponse } from 'next/server'
import {
  clefExtent,
  clefGlyph,
  fitStaff,
  halfSpaceForWidth,
  ledgerHalfWidth,
  noteExtent,
  placeClef,
  placeNotehead,
  positionY,
  STAFF_EXTENT,
  type StaffMetrics,
  stemRect,
  traceGlyph,
  unionExtents,
} from '@/components/music/glyphPath'
import { SMUFL_GLYPHS } from '@/components/music/smuflGlyphs'
import { withAuth } from '@/lib/auth/withAuth'

interface MusicFlashcardRequest {
  clef: 'treble' | 'bass' | 'both'
  lowNote: number // position relative to bottom line (0 = E for treble, G for bass)
  highNote: number
  layout: '1-up' | '4-up' | '6-up'
  showNoteNames: boolean
}

// Note names for treble clef (position 0 = E)
const TREBLE_NOTES = ['E', 'F', 'G', 'A', 'B', 'C', 'D']
// Note names for bass clef (position 0 = G)
const BASS_NOTES = ['G', 'A', 'B', 'C', 'D', 'E', 'F']

// Get note name from position
function getNoteName(position: number, clef: 'treble' | 'bass'): string {
  const notes = clef === 'treble' ? TREBLE_NOTES : BASS_NOTES
  // Handle negative positions (below staff)
  const adjustedPos = ((position % 7) + 7) % 7
  const noteName = notes[adjustedPos]

  // Special naming for certain positions
  if (clef === 'treble') {
    if (position === -2) return 'C' // Middle C
    if (position === 10) return 'A' // High A
  }
  if (clef === 'bass') {
    if (position === 10) return 'C' // Middle C
  }

  return noteName
}

/** mm of card reserved at the top for the clef label, and at the bottom for the note name. */
const LABEL_BAND = 9

/**
 * Ceiling on `lineGap` as a fraction of card height, so a staff never grows
 * taller than it is wide — at that point it stops reading as notation.
 */
const MAX_LINE_GAP_RATIO = 0.08

/** Fraction of the card width the staff spans. */
const STAFF_WIDTH_RATIO = 0.85

/**
 * How the staff is scaled and placed inside a card.
 *
 * Positions are counted in half-spaces from the bottom staff line, so the five
 * lines sit at 0/2/4/6/8 and everything outside that needs ledger lines. The
 * card therefore has to be sized for the DECK's full range, not for the staff:
 * a "G below the staff" card (position -5) reaches five half-spaces past the
 * bottom line, and the old fixed `height * 0.08` scale put it below the card
 * border entirely. Computing this once per deck also keeps every card's staff
 * identical, which matters when a learner compares two cards side by side.
 */
/**
 * Scale and placement for every card in a deck, measured from the card's own
 * top-left corner. `staffTop` is therefore an offset, not an absolute y.
 */
function computeStaffGeometry(
  width: number,
  height: number,
  positions: number[],
  clefs: Array<'treble' | 'bass'>
): StaffMetrics {
  // Everything drawn has to fit, and the notes are not the tallest thing on the
  // card. A real G clef reaches from roughly position -3 to +11, almost twice
  // the staff's own height, and a stem adds three and a half spaces past its
  // notehead. Sizing to the staff and note range alone — which is what this did
  // while the clef was a Helvetica letter — pushes the clef off the card.
  return fitStaff({
    top: LABEL_BAND,
    availableHeight: height - LABEL_BAND * 2,
    extent: unionExtents(STAFF_EXTENT, ...clefs.map(clefExtent), ...positions.map(noteExtent)),
    maxHalfSpace: [
      halfSpaceForWidth(width * STAFF_WIDTH_RATIO), // leave the note room beside the clef
      height * MAX_LINE_GAP_RATIO,
    ],
  })
}

// Draw a music staff with a note
function drawMusicCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  position: number,
  clef: 'treble' | 'bass',
  showNoteName: boolean,
  geometry: StaffMetrics
) {
  const lineGap = geometry.halfSpace
  const staffWidth = width * STAFF_WIDTH_RATIO
  const staffLeft = x + (width - staffWidth) / 2
  // The deck geometry is relative to a card's top-left corner; place it.
  const metrics: StaffMetrics = { ...geometry, staffTop: y + geometry.staffTop }
  const staffTop = metrics.staffTop

  // Draw card border
  doc.setDrawColor(180)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, width, height, 3, 3, 'S')

  // Draw 5 staff lines
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  for (let i = 0; i < 5; i++) {
    const lineY = staffTop + i * lineGap * 2
    doc.line(staffLeft, lineY, staffLeft + staffWidth, lineY)
  }

  // Draw the clef from its Bravura outline. One fill across every subpath keeps
  // the counters (the eye of the G clef) hollow via nonzero winding.
  doc.setFillColor(0, 0, 0)
  const clefAt = placeClef(metrics, clef, staffLeft + lineGap)
  traceGlyph(clefGlyph(clef).commands, clefAt, doc)
  doc.fill()

  // Centre the note in what the clef leaves of the staff. A fixed fraction of
  // the staff width (this was 0.55) put the note underneath the clef as soon as
  // the clef became a real glyph rather than a letter.
  const glyph = clefGlyph(clef)
  const clefRight = clefAt.x + glyph.bbox.right * clefAt.scale
  const noteX = (clefRight + lineGap * 2 + staffLeft + staffWidth) / 2
  const ledgerHalf = ledgerHalfWidth(metrics)

  // Draw ledger lines if needed
  doc.setLineWidth(0.3)
  if (position < 0) {
    // Ledger lines below
    let ledgerPos = -2
    while (ledgerPos >= position) {
      const ledgerY = positionY(metrics, ledgerPos)
      doc.line(noteX - ledgerHalf, ledgerY, noteX + ledgerHalf, ledgerY)
      ledgerPos -= 2
    }
  }
  if (position > 8) {
    // Ledger lines above
    let ledgerPos = 10
    while (ledgerPos <= position) {
      const ledgerY = positionY(metrics, ledgerPos)
      doc.line(noteX - ledgerHalf, ledgerY, noteX + ledgerHalf, ledgerY)
      ledgerPos += 2
    }
  }

  // Draw the note. This was an upright filled ellipse with no stem, which is
  // not a note of any duration; it is now Bravura's quarter-note head (already
  // carrying the correct tilt) with a stem attached at the font's own anchor.
  doc.setFillColor(0, 0, 0)
  const headAt = placeNotehead(metrics, position, noteX)
  traceGlyph(SMUFL_GLYPHS.noteheadBlack.commands, headAt, doc)
  doc.fill()

  const stem = stemRect(metrics, position, headAt)
  doc.rect(stem.x, stem.y, stem.width, stem.height, 'F')

  // Draw note name in corner if requested
  if (showNoteName) {
    const noteName = getNoteName(position, clef)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150)
    doc.text(noteName, x + width - 8, y + height - 5)
    doc.setTextColor(0)
  }

  // Draw clef label at top
  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text(clef.toUpperCase(), x + 5, y + 8)
  doc.setTextColor(0)
}

export const POST = withAuth(async (request) => {
  try {
    const body: MusicFlashcardRequest = await request.json()
    const { clef, lowNote, highNote, layout, showNoteNames } = body

    // Generate list of notes
    const notes: Array<{ position: number; clef: 'treble' | 'bass' }> = []

    const addNotesForClef = (c: 'treble' | 'bass') => {
      for (let pos = lowNote; pos <= highNote; pos++) {
        notes.push({ position: pos, clef: c })
      }
    }

    if (clef === 'both') {
      addNotesForClef('treble')
      addNotesForClef('bass')
    } else {
      addNotesForClef(clef)
    }

    // An inverted range would otherwise produce a zero-card PDF with NaN
    // geometry rather than telling the caller what was wrong.
    if (notes.length === 0) {
      return NextResponse.json(
        { error: `Empty note range: lowNote (${lowNote}) is above highNote (${highNote}).` },
        { status: 400 }
      )
    }

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    })

    const pageWidth = 215.9 // Letter width in mm
    const pageHeight = 279.4 // Letter height in mm
    const margin = 12

    // Layout configuration
    let cols: number, rows: number, cardWidth: number, cardHeight: number

    switch (layout) {
      case '1-up':
        cols = 1
        rows = 1
        cardWidth = pageWidth - margin * 2
        cardHeight = pageHeight * 0.4
        break
      case '6-up':
        cols = 2
        rows = 3
        cardWidth = (pageWidth - margin * 3) / 2
        cardHeight = (pageHeight - margin * 4) / 3
        break
      case '4-up':
      default:
        cols = 2
        rows = 2
        cardWidth = (pageWidth - margin * 3) / 2
        cardHeight = (pageHeight - margin * 3) / 2
        break
    }

    const cardsPerPage = cols * rows
    let cardIndex = 0

    // One geometry for the whole deck: every card is the same card size, and a
    // staff that changed scale per note would make the deck unreadable.
    const geometry = computeStaffGeometry(
      cardWidth,
      cardHeight,
      notes.map((n) => n.position),
      [...new Set(notes.map((n) => n.clef))]
    )

    for (const note of notes) {
      // New page if needed
      if (cardIndex > 0 && cardIndex % cardsPerPage === 0) {
        doc.addPage()
      }

      const pageCardIndex = cardIndex % cardsPerPage
      const col = pageCardIndex % cols
      const row = Math.floor(pageCardIndex / cols)

      const x = margin + col * (cardWidth + margin)
      const y = margin + row * (cardHeight + margin)

      drawMusicCard(
        doc,
        x,
        y,
        cardWidth,
        cardHeight,
        note.position,
        note.clef,
        showNoteNames,
        geometry
      )
      cardIndex++
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="music-flashcards-${clef}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Music flashcard generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
})
