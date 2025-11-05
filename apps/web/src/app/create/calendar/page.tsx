'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { css } from '../../../../styled-system/css'
import { useAbacusConfig } from '@soroban/abacus-react'
import { PageWithNav } from '@/components/PageWithNav'
import { CalendarConfigPanel } from './components/CalendarConfigPanel'
import { CalendarPreview } from './components/CalendarPreview'

export default function CalendarCreatorPage() {
  const t = useTranslations('calendar')
  const currentDate = new Date()
  const abacusConfig = useAbacusConfig()
  const [month, setMonth] = useState(currentDate.getMonth() + 1) // 1-12
  const [year, setYear] = useState(currentDate.getFullYear())
  const [format, setFormat] = useState<'monthly' | 'daily'>('monthly')
  const [paperSize, setPaperSize] = useState<'us-letter' | 'a4' | 'a3' | 'tabloid'>('us-letter')
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewSvg, setPreviewSvg] = useState<string | null>(null)

  // Detect default paper size based on user's locale (client-side only)
  useEffect(() => {
    // Get user's locale
    const locale = navigator.language || navigator.languages?.[0] || 'en-US'
    const country = locale.split('-')[1]?.toUpperCase()

    // Countries that use US Letter (8.5" × 11")
    const letterCountries = ['US', 'CA', 'MX', 'GT', 'PA', 'DO', 'PR', 'PH']

    const detectedSize = letterCountries.includes(country || '') ? 'us-letter' : 'a4'
    setPaperSize(detectedSize)
  }, [])

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/create/calendar/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month,
          year,
          format,
          paperSize,
          abacusConfig,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to generate calendar')
      }

      const data = await response.json()

      // Convert base64 PDF to blob and trigger download
      const pdfBytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0))
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error generating calendar:', error)
      alert(
        `Failed to generate calendar: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <PageWithNav navTitle="Create" navEmoji="📅">
      <div
        data-component="calendar-creator"
        className={`with-fixed-nav ${css({
          minHeight: '100vh',
          bg: 'gray.900',
          color: 'white',
          padding: '2rem',
        })}`}
      >
        <div
          className={css({
            maxWidth: '1400px',
            margin: '0 auto',
          })}
        >
          {/* Header */}
          <header
            data-section="page-header"
            className={css({
              textAlign: 'center',
              marginBottom: '3rem',
            })}
          >
            <h1
              className={css({
                fontSize: '2.5rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
                color: 'yellow.400',
              })}
            >
              {t('pageTitle')}
            </h1>
            <p
              className={css({
                fontSize: '1.125rem',
                color: 'gray.300',
              })}
            >
              {t('pageSubtitle')}
            </p>
          </header>

          {/* Main Content */}
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: { base: '1fr', lg: '350px 1fr' },
              gap: '2rem',
            })}
          >
            {/* Configuration Panel */}
            <CalendarConfigPanel
              month={month}
              year={year}
              format={format}
              paperSize={paperSize}
              isGenerating={isGenerating}
              onMonthChange={setMonth}
              onYearChange={setYear}
              onFormatChange={setFormat}
              onPaperSizeChange={setPaperSize}
              onGenerate={handleGenerate}
            />

            {/* Preview */}
            <CalendarPreview month={month} year={year} format={format} previewSvg={previewSvg} />
          </div>
        </div>
      </div>
    </PageWithNav>
  )
}
