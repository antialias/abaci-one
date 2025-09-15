import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// API endpoint to serve the flashcards.typ template content
export async function GET() {
  try {
    const templatesDir = path.join(process.cwd(), '../../packages/core/templates')
    const flashcardsTemplate = fs.readFileSync(path.join(templatesDir, 'flashcards.typ'), 'utf-8')

    return NextResponse.json({
      template: flashcardsTemplate,
      success: true
    })
  } catch (error) {
    console.error('Failed to load typst template:', error)
    return NextResponse.json(
      {
        error: 'Failed to load template',
        success: false
      },
      { status: 500 }
    )
  }
}