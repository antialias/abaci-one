/**
 * API Route: Generate Flowchart PDF
 *
 * Takes mermaid content, renders it to SVG, and generates a print-ready PDF using Typst.
 * Includes a branded QR code linking to a remix version of the flowchart.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import QRCode from 'qrcode'

interface FlowchartPDFRequest {
  /** Mermaid flowchart content */
  mermaidContent: string
  /** Title for the PDF */
  title: string
  /** Optional description */
  description?: string
  /** Paper size */
  paperSize?: 'letter' | 'a4'
  /** Orientation */
  orientation?: 'portrait' | 'landscape'
  /** Flowchart ID (for built-in flowcharts) */
  flowchartId?: string
  /** Workshop session ID (for draft flowcharts) */
  sessionId?: string
}

export async function POST(request: NextRequest) {
  const tmpFiles: string[] = []

  try {
    const body: FlowchartPDFRequest = await request.json()
    const {
      mermaidContent,
      title,
      description,
      paperSize = 'letter',
      orientation = 'portrait',
      flowchartId,
      sessionId,
    } = body

    if (!mermaidContent || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: mermaidContent and title' },
        { status: 400 }
      )
    }

    // Build the remix URL based on what IDs we have
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('host') || 'abaci.one'
    const baseUrl = `${protocol}://${host}`

    let remixUrl: string | undefined
    if (flowchartId) {
      // Built-in flowchart - link to create a remix session
      remixUrl = `${baseUrl}/flowchart?remix=${flowchartId}`
    } else if (sessionId) {
      // Workshop session - link to the session
      remixUrl = `${baseUrl}/flowchart/workshop/${sessionId}`
    }

    // Create temp directory for this request
    const tmpDir = os.tmpdir()
    const timestamp = Date.now()

    // Render mermaid to PNG (not SVG, because Typst doesn't support foreignObject in SVG)
    const mermaidFile = path.join(tmpDir, `mermaid-${timestamp}.mmd`)
    const pngFile = path.join(tmpDir, `flowchart-${timestamp}.png`)
    const qrSvgFile = path.join(tmpDir, `qr-${timestamp}.svg`)
    const typstFile = path.join(tmpDir, `flowchart-${timestamp}.typ`)
    const pdfFile = path.join(tmpDir, `flowchart-${timestamp}.pdf`)

    tmpFiles.push(mermaidFile, pngFile, qrSvgFile, typstFile, pdfFile)

    // Write mermaid content
    await fs.writeFile(mermaidFile, mermaidContent, 'utf-8')

    // Run mermaid-cli to generate PNG with high resolution for print quality
    try {
      execSync(
        `npx --yes @mermaid-js/mermaid-cli --input "${mermaidFile}" --output "${pngFile}" --backgroundColor white --scale 3`,
        {
          timeout: 60000, // 60 second timeout
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      )
    } catch (error) {
      console.error('Mermaid CLI error:', error)
      return NextResponse.json({ error: 'Failed to render flowchart diagram' }, { status: 500 })
    }

    // Generate QR code SVG if we have a remix URL
    let qrSvgPath: string | undefined
    if (remixUrl) {
      const qrSvg = await generateQRCodeSVG(remixUrl, 200)
      await fs.writeFile(qrSvgFile, qrSvg, 'utf-8')
      qrSvgPath = qrSvgFile
    }

    // Generate Typst source - use just filenames since all files are in the same temp directory
    const typstSource = generateTypstSource(
      path.basename(pngFile),
      title,
      description,
      paperSize,
      orientation,
      qrSvgPath ? path.basename(qrSvgPath) : undefined,
      host
    )
    await fs.writeFile(typstFile, typstSource, 'utf-8')

    // Compile with Typst
    let pdfBuffer: Buffer
    try {
      execSync(`typst compile "${typstFile}" "${pdfFile}"`, {
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      pdfBuffer = await fs.readFile(pdfFile)
    } catch (error) {
      console.error('Typst compilation error:', error)
      const stderr =
        error instanceof Error && 'stderr' in error
          ? String((error as NodeJS.ErrnoException & { stderr?: Buffer }).stderr)
          : 'Unknown compilation error'

      return NextResponse.json({ error: 'PDF generation failed', details: stderr }, { status: 500 })
    }

    // Return PDF - convert Buffer to Uint8Array for NextResponse
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${title.toLowerCase().replace(/\s+/g, '-')}-flowchart.pdf"`,
      },
    })
  } catch (error) {
    console.error('Flowchart PDF generation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  } finally {
    // Cleanup temp files
    for (const file of tmpFiles) {
      try {
        await fs.unlink(file)
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Generate a flowchart-themed icon SVG for the QR code center
 */
function generateFlowchartIcon(size: number): string {
  const s = size
  const strokeWidth = s * 0.08
  const boxSize = s * 0.25
  const centerX = s / 2
  const centerY = s / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect x="0" y="0" width="${s}" height="${s}" fill="white"/>
    <!-- Top box -->
    <rect x="${centerX - boxSize / 2}" y="${s * 0.15}" width="${boxSize}" height="${boxSize * 0.7}" rx="2" fill="#4F46E5" />
    <!-- Arrow down -->
    <line x1="${centerX}" y1="${s * 0.15 + boxSize * 0.7}" x2="${centerX}" y2="${centerY}" stroke="#4F46E5" stroke-width="${strokeWidth}" />
    <!-- Diamond (decision) -->
    <polygon points="${centerX},${centerY - boxSize * 0.35} ${centerX + boxSize * 0.35},${centerY} ${centerX},${centerY + boxSize * 0.35} ${centerX - boxSize * 0.35},${centerY}" fill="#4F46E5" />
    <!-- Arrow down from diamond -->
    <line x1="${centerX}" y1="${centerY + boxSize * 0.35}" x2="${centerX}" y2="${s * 0.85 - boxSize * 0.7}" stroke="#4F46E5" stroke-width="${strokeWidth}" />
    <!-- Bottom box -->
    <rect x="${centerX - boxSize / 2}" y="${s * 0.85 - boxSize * 0.7}" width="${boxSize}" height="${boxSize * 0.7}" rx="2" fill="#4F46E5" />
  </svg>`
}

/**
 * Generate a QR code as an SVG string with a flowchart logo in the center
 */
async function generateQRCodeSVG(url: string, size = 100): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: 'svg',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'H', // High error correction for logo overlay
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })

  // Add flowchart logo to the center
  const logoSize = Math.round(size * 0.22)
  const logoOffset = Math.round((size - logoSize) / 2)
  const logoSvg = generateFlowchartIcon(logoSize)

  // Extract just the content of the logo SVG (without the outer svg tags)
  const logoContent = logoSvg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')

  // Insert logo into QR code SVG (before closing </svg> tag)
  const svgWithLogo = svg.replace(
    '</svg>',
    `<g transform="translate(${logoOffset}, ${logoOffset})">${logoContent}</g></svg>`
  )

  return svgWithLogo
}

/**
 * Generate Typst source for the flowchart PDF
 */
function generateTypstSource(
  imagePath: string,
  title: string,
  description: string | undefined,
  paperSize: 'letter' | 'a4',
  orientation: 'portrait' | 'landscape',
  qrSvgPath?: string,
  domain?: string
): string {
  // Paper dimensions
  const papers = {
    letter: { width: '8.5in', height: '11in' },
    a4: { width: '210mm', height: '297mm' },
  }

  const paper = papers[paperSize]
  const width = orientation === 'portrait' ? paper.width : paper.height
  const height = orientation === 'portrait' ? paper.height : paper.width

  // Escape special characters in title and description for Typst
  const escapeTypst = (str: string) => str.replace(/[#$@\\]/g, '\\$&').replace(/"/g, '\\"')
  const safeTitle = escapeTypst(title)
  const safeDescription = description ? escapeTypst(description) : ''
  const safeDomain = domain ? escapeTypst(domain) : 'abaci.one'

  return `
#set page(width: ${width}, height: ${height}, margin: 0.75in)
#set text(size: 11pt)

// Title
#align(center)[
  #text(size: 20pt, weight: "bold")[${safeTitle}]
]

#v(0.3in)

${
  safeDescription
    ? `
// Description
#align(center)[
  #text(size: 11pt, fill: rgb("#666666"))[${safeDescription}]
]

#v(0.3in)
`
    : ''
}

// Flowchart diagram
#align(center)[
  #image("${imagePath}", width: 90%)
]

#v(1fr)

// Footer with QR code
#grid(
  columns: (1fr, auto),
  align: (left + bottom, right + bottom),
  [
    #text(size: 8pt, fill: rgb("#999999"))[Generated by ${safeDomain}]
  ],
  [
    ${
      qrSvgPath
        ? `
    #stack(dir: ttb, spacing: 4pt,
      image("${qrSvgPath}", width: 0.6in, height: 0.6in),
      text(size: 6pt, fill: rgb("#666666"))[Scan to remix]
    )
    `
        : ''
    }
  ]
)
`
}
