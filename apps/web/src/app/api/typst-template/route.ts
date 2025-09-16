import { NextResponse } from 'next/server'
import fs from 'fs'
import { getTemplatePath } from '@soroban/templates'

// API endpoint to serve the flashcards.typ template content
export async function GET() {
  try {
    const templatePath = getTemplatePath('flashcards.typ');
    const flashcardsTemplate = fs.readFileSync(templatePath, 'utf-8')

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