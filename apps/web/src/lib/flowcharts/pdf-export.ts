/**
 * PDF Export for Flowcharts
 *
 * Client-side utility that calls the server-side API to generate
 * print-ready PDFs from Mermaid flowchart content using Typst.
 */

export interface FlowchartPDFOptions {
  /** Title to display on the PDF */
  title: string
  /** Optional description */
  description?: string
  /** Paper size */
  paperSize?: 'letter' | 'a4'
  /** Orientation */
  orientation?: 'portrait' | 'landscape'
  /** Flowchart ID (for built-in flowcharts, used for QR code remix link) */
  flowchartId?: string
  /** Workshop session ID (for draft flowcharts, used for QR code link) */
  sessionId?: string
}

/**
 * Downloads a flowchart as a PDF
 *
 * Sends the mermaid content to the server, which renders it to SVG
 * and generates a PDF using Typst. Includes a QR code for remixing.
 */
export async function downloadFlowchartPDF(
  mermaidContent: string,
  options: FlowchartPDFOptions
): Promise<void> {
  const response = await fetch('/api/flowcharts/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mermaidContent,
      title: options.title,
      description: options.description,
      paperSize: options.paperSize || 'letter',
      orientation: options.orientation || 'portrait',
      flowchartId: options.flowchartId,
      sessionId: options.sessionId,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to generate PDF')
  }

  // Get the PDF blob and trigger download
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${options.title.toLowerCase().replace(/\s+/g, '-')}-flowchart.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
