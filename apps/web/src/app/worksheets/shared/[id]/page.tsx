'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { css } from '@styled/css'
import { stack } from '@styled/patterns'
import type { WorksheetFormState } from '@/app/create/worksheets/types'

interface ShareData {
  id: string
  worksheetType: string
  config: WorksheetFormState
  createdAt: string
  views: number
  title: string | null
}

export default function SharedWorksheetPage() {
  const params = useParams()
  const router = useRouter()
  const shareId = params.id as string

  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchShare = async () => {
      try {
        const response = await fetch(`/api/worksheets/share/${shareId}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Shared worksheet not found')
          } else {
            setError('Failed to load shared worksheet')
          }
          return
        }

        const data = await response.json()
        setShareData(data)
      } catch (err) {
        console.error('Error fetching shared worksheet:', err)
        setError('Failed to load shared worksheet')
      } finally {
        setLoading(false)
      }
    }

    fetchShare()
  }, [shareId])

  const handleOpenInEditor = () => {
    if (!shareData) return

    // Navigate to the worksheet creator with the share ID
    // The server-side page will load the config from the database
    router.push(`/create/worksheets?share=${shareData.id}`)
  }

  if (loading) {
    return (
      <div
        className={css({
          minH: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.50',
        })}
      >
        <div className={stack({ gap: '4', alignItems: 'center' })}>
          <div
            className={css({
              w: '16',
              h: '16',
              border: '4px solid',
              borderColor: 'gray.300',
              borderTopColor: 'brand.600',
              rounded: 'full',
              animation: 'spin 1s linear infinite',
            })}
          />
          <p className={css({ fontSize: 'lg', color: 'gray.600' })}>Loading shared worksheet...</p>
        </div>
      </div>
    )
  }

  if (error || !shareData) {
    return (
      <div
        className={css({
          minH: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.50',
          p: '4',
        })}
      >
        <div
          className={css({
            maxW: 'md',
            w: 'full',
            bg: 'white',
            rounded: 'xl',
            shadow: 'xl',
            p: '8',
          })}
        >
          <div className={stack({ gap: '4', alignItems: 'center' })}>
            <div className={css({ fontSize: '4xl' })}>❌</div>
            <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'gray.900' })}>
              {error || 'Not Found'}
            </h1>
            <p className={css({ fontSize: 'md', color: 'gray.600', textAlign: 'center' })}>
              This shared worksheet link may have expired or been removed.
            </p>
            <button
              onClick={() => router.push('/create/worksheets')}
              className={css({
                px: '6',
                py: '3',
                bg: 'brand.600',
                color: 'white',
                fontSize: 'md',
                fontWeight: 'bold',
                rounded: 'lg',
                cursor: 'pointer',
                transition: 'all 0.2s',
                _hover: {
                  bg: 'brand.700',
                },
              })}
            >
              Create Your Own Worksheet
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={css({
        minH: '100vh',
        bg: 'gray.50',
        p: '8',
      })}
    >
      <div
        className={css({
          maxW: '4xl',
          mx: 'auto',
        })}
      >
        <div
          className={css({
            bg: 'white',
            rounded: 'xl',
            shadow: 'xl',
            p: '8',
          })}
        >
          <div className={stack({ gap: '6' })}>
            {/* Header */}
            <div className={stack({ gap: '2' })}>
              <h1 className={css({ fontSize: '3xl', fontWeight: 'bold', color: 'gray.900' })}>
                Shared Worksheet
              </h1>
              {shareData.title && (
                <p className={css({ fontSize: 'lg', color: 'gray.700' })}>{shareData.title}</p>
              )}
              <div
                className={css({
                  display: 'flex',
                  gap: '4',
                  fontSize: 'sm',
                  color: 'gray.500',
                })}
              >
                <span>Type: {shareData.worksheetType}</span>
                <span>•</span>
                <span>Views: {shareData.views}</span>
                <span>•</span>
                <span>Created: {new Date(shareData.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Configuration Summary */}
            <div
              className={css({
                bg: 'gray.50',
                rounded: 'lg',
                p: '6',
                border: '2px solid',
                borderColor: 'gray.200',
              })}
            >
              <h2
                className={css({
                  fontSize: 'xl',
                  fontWeight: 'bold',
                  color: 'gray.900',
                  mb: '4',
                })}
              >
                Configuration
              </h2>
              <div className={stack({ gap: '2' })}>
                <div className={css({ display: 'grid', gridTemplateColumns: '2', gap: '4' })}>
                  <ConfigItem label="Operator" value={shareData.config.operator || 'addition'} />
                  <ConfigItem
                    label="Problems per page"
                    value={shareData.config.problemsPerPage.toString()}
                  />
                  <ConfigItem label="Pages" value={shareData.config.pages.toString()} />
                  <ConfigItem
                    label="Digit range"
                    value={`${shareData.config.digitRange.min}-${shareData.config.digitRange.max}`}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div
              className={css({
                display: 'flex',
                gap: '4',
                flexWrap: 'wrap',
              })}
            >
              <button
                onClick={handleOpenInEditor}
                className={css({
                  flex: '1',
                  px: '6',
                  py: '4',
                  bg: 'brand.600',
                  color: 'white',
                  fontSize: 'md',
                  fontWeight: 'bold',
                  rounded: 'lg',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2',
                  _hover: {
                    bg: 'brand.700',
                    transform: 'translateY(-1px)',
                  },
                })}
              >
                <span>✏️</span>
                <span>Open in Editor</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={stack({ gap: '1' })}>
      <dt className={css({ fontSize: 'xs', fontWeight: 'semibold', color: 'gray.500' })}>
        {label}
      </dt>
      <dd className={css({ fontSize: 'md', color: 'gray.900' })}>{value}</dd>
    </div>
  )
}
