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

// Draw a music staff with a note
function drawMusicCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  position: number,
  clef: 'treble' | 'bass',
  showNoteName: boolean
) {
  const lineGap = height * 0.08
  const staffTop = y + height * 0.3
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
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  const clefText = clef === 'treble' ? 'G' : 'F'
  doc.text(clefText, staffLeft + 5, staffTop + lineGap * 4)

  // Calculate note Y position
  const noteY = staffTop + (8 - position) * lineGap
  const noteX = staffLeft + staffWidth * 0.55

  // Draw ledger lines if needed
  doc.setLineWidth(0.3)
  if (position < 0) {
    // Ledger lines below
    let ledgerPos = -2
    while (ledgerPos >= position) {
      const ledgerY = staffTop + (8 - ledgerPos) * lineGap
      doc.line(noteX - 8, ledgerY, noteX + 8, ledgerY)
      ledgerPos -= 2
    }
  }
  if (position > 8) {
    // Ledger lines above
    let ledgerPos = 10
    while (ledgerPos <= position) {
      const ledgerY = staffTop + (8 - ledgerPos) * lineGap
      doc.line(noteX - 8, ledgerY, noteX + 8, ledgerY)
      ledgerPos += 2
    }
  }

  // Draw note (filled ellipse)
  doc.setFillColor('0')
  doc.ellipse(noteX, noteY, 4, 3, 'F')

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

      drawMusicCard(doc, x, y, cardWidth, cardHeight, note.position, note.clef, showNoteNames)
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
