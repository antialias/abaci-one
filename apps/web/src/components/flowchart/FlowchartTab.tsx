'use client'

import { useState, useCallback } from 'react'
import type { ExecutableFlowchart } from '@/lib/flowcharts/schema'
import { downloadFlowchartPDF } from '@/lib/flowcharts/pdf-export'
import { MermaidViewer } from './MermaidViewer'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

interface FlowchartTabProps {
  /** The loaded flowchart to display */
  flowchart: ExecutableFlowchart
  /** Optional share URL for the flowchart */
  shareUrl?: string
}

/**
 * Tab content for viewing the flowchart diagram and downloading PDF.
 */
export function FlowchartTab({ flowchart, shareUrl }: FlowchartTabProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const handleDownloadPDF = useCallback(async () => {
    setIsExporting(true)
    try {
      await downloadFlowchartPDF(flowchart.rawMermaid, {
        title: flowchart.definition.title,
        flowchartId: flowchart.definition.id,
      })
    } catch (err) {
      console.error('Failed to export PDF:', err)
    } finally {
      setIsExporting(false)
    }
  }, [flowchart])

  const handleShare = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy share URL:', err)
    }
  }, [shareUrl])

  return (
    <div data-component="flowchart-tab" className={vstack({ gap: '4', alignItems: 'stretch' })}>
      {/* Mermaid Diagram */}
      <div
        data-element="diagram-container"
        className={css({
          borderRadius: 'lg',
          border: '1px solid',
          borderColor: { base: 'gray.200', _dark: 'gray.700' },
          backgroundColor: { base: 'gray.50', _dark: 'gray.900' },
          overflow: 'auto',
          maxHeight: '400px',
          padding: '4',
        })}
      >
        <MermaidViewer mermaidContent={flowchart.rawMermaid} />
      </div>

      {/* Action buttons */}
      <div className={hstack({ gap: '3', justifyContent: 'center' })}>
        <button
          data-action="download-pdf"
          onClick={handleDownloadPDF}
          disabled={isExporting}
          className={css({
            padding: '2 4',
            fontSize: 'sm',
            fontWeight: 'medium',
            borderRadius: 'lg',
            border: 'none',
            cursor: isExporting ? 'wait' : 'pointer',
            transition: 'all 0.15s',
            backgroundColor: { base: 'blue.500', _dark: 'blue.600' },
            color: 'white',
            opacity: isExporting ? 0.7 : 1,
            _hover: {
              backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
            },
            _disabled: {
              cursor: 'not-allowed',
            },
          })}
        >
          {isExporting ? 'Exporting...' : 'Download PDF'}
        </button>

        {shareUrl && (
          <button
            data-action="copy-link"
            onClick={handleShare}
            className={css({
              padding: '2 4',
              fontSize: 'sm',
              fontWeight: 'medium',
              borderRadius: 'lg',
              border: '1px solid',
              borderColor: shareCopied
                ? { base: 'green.400', _dark: 'green.500' }
                : { base: 'gray.300', _dark: 'gray.600' },
              cursor: 'pointer',
              transition: 'all 0.15s',
              backgroundColor: shareCopied
                ? { base: 'green.50', _dark: 'green.900/30' }
                : { base: 'white', _dark: 'gray.800' },
              color: shareCopied
                ? { base: 'green.700', _dark: 'green.300' }
                : { base: 'gray.700', _dark: 'gray.300' },
              _hover: {
                borderColor: { base: 'blue.400', _dark: 'blue.500' },
                color: { base: 'blue.600', _dark: 'blue.400' },
              },
            })}
          >
            {shareCopied ? 'Copied!' : 'Copy Link'}
          </button>
        )}
      </div>
    </div>
  )
}
