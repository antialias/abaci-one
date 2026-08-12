import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { jsPDF } from 'jspdf'

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
 * Ceiling on `lineGap` as a fraction of card height. Without it a narrow range
 * (beginner is only 10 half-spaces) would scale the staff up to fill the card,
 * and a staff taller than it is wide stops reading as notation. 0.08 is the
 * scale every card used before the range-aware fit, so beginner decks look
 * unchanged and only the ranges that used to overflow get smaller.
 */
const MAX_LINE_GAP_RATIO = 0.08

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
interface StaffGeometry {
  lineGap: number
  /** Offset from the card's top edge to the TOP staff line (position 8). */
  staffTopOffset: number
}

function computeStaffGeometry(
  height: number,
  minPosition: number,
  maxPosition: number
): StaffGeometry {
  // The staff itself always shows, so the drawn extent is the union of the
  // staff (0..8) and the deck's range.
  const topUnit = Math.max(maxPosition, 8)
  const bottomUnit = Math.min(minPosition, 0)
  const spanUnits = topUnit - bottomUnit

  const band = height - LABEL_BAND * 2
  // A note head is one staff space tall, i.e. 2 half-spaces, so it overhangs
  // its own position by one `lineGap` at each end: `span + 2` units of room.
  const lineGap = Math.min(band / (spanUnits + 2), height * MAX_LINE_GAP_RATIO)

  const contentHeight = (spanUnits + 2) * lineGap
  const contentTop = LABEL_BAND + (band - contentHeight) / 2

  // Place the topmost drawn position one lineGap below the content top.
  const staffTopOffset = contentTop + lineGap - (8 - topUnit) * lineGap
  return { lineGap, staffTopOffset }
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
  geometry: StaffGeometry
) {
  const { lineGap } = geometry
  const staffTop = y + geometry.staffTopOffset
  const staffWidth = width * 0.85
  const staffLeft = x + (width - staffWidth) / 2

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

  // Draw clef (using text since we can't embed Bravura easily)
  doc.setFontSize(Math.max(8, lineGap * 4))
  doc.setFont('helvetica', 'bold')
  const clefText = clef === 'treble' ? 'G' : 'F'
  doc.text(clefText, staffLeft + lineGap, staffTop + lineGap * 6)

  // Calculate note Y position
  const noteY = staffTop + (8 - position) * lineGap
  const noteX = staffLeft + staffWidth * 0.55

  // Note heads are one staff space tall and slightly wider than they are high.
  const noteRy = lineGap
  const noteRx = lineGap * 1.3
  const ledgerHalf = noteRx * 1.7

  // Draw ledger lines if needed
  doc.setLineWidth(0.3)
  if (position < 0) {
    // Ledger lines below
    let ledgerPos = -2
    while (ledgerPos >= position) {
      const ledgerY = staffTop + (8 - ledgerPos) * lineGap
      doc.line(noteX - ledgerHalf, ledgerY, noteX + ledgerHalf, ledgerY)
      ledgerPos -= 2
    }
  }
  if (position > 8) {
    // Ledger lines above
    let ledgerPos = 10
    while (ledgerPos <= position) {
      const ledgerY = staffTop + (8 - ledgerPos) * lineGap
      doc.line(noteX - ledgerHalf, ledgerY, noteX + ledgerHalf, ledgerY)
      ledgerPos += 2
    }
  }

  // Draw note (filled ellipse)
  doc.setFillColor('0')
  doc.ellipse(noteX, noteY, noteRx, noteRy, 'F')

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
    const positions = notes.map((n) => n.position)
    const geometry = computeStaffGeometry(
      cardHeight,
      Math.min(...positions),
      Math.max(...positions)
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
