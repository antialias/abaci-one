'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AppNavBar } from '@/components/AppNavBar'
import { postcardKeys } from '@/lib/queryKeys'
import { css } from '../../../../../styled-system/css'
import { vstack } from '../../../../../styled-system/patterns'

interface Props {
  params: { postcardId: string }
}

export default function PostcardDetailPage({ params }: Props) {
  const { postcardId } = params
  const queryClient = useQueryClient()

  const { data: postcard, isLoading } = useQuery({
    queryKey: postcardKeys.detail(postcardId),
    queryFn: async () => {
      const res = await fetch(`/api/postcards?ids=${postcardId}`)
      if (!res.ok) throw new Error('Failed to fetch postcard')
      const data = await res.json()
      return data.postcards?.[0] ?? null
    },
  })

  // Mark as read
  useEffect(() => {
    if (postcard && !postcard.isRead) {
      fetch(`/api/postcards/${postcardId}/read`, { method: 'POST' }).then(() => {
        queryClient.invalidateQueries({ queryKey: postcardKeys.all })
      })
    }
  }, [postcard, postcardId, queryClient])

  const displayNum = postcard
    ? Number.isInteger(postcard.callerNumber)
      ? postcard.callerNumber.toString()
      : postcard.callerNumber.toPrecision(4)
    : '…'

  return (
    <div
      data-component="postcard-detail-page"
      className={vstack({ alignItems: 'stretch', minH: '100vh', bg: 'gray.50' })}
    >
      <AppNavBar
        navSlot={
          <Link
            href="/my-stuff"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(55, 65, 81, 1)',
              textDecoration: 'none',
            }}
          >
            ← My Stuff
          </Link>
        }
      />

      <main
        className={vstack({
          alignItems: 'center',
          maxW: '640px',
          w: '100%',
          mx: 'auto',
          px: '16px',
          pt: 'calc(var(--app-nav-height) + 32px)',
          pb: '48px',
          gap: '24px',
        })}
      >
        {isLoading ? (
          <p className={css({ color: 'gray.400', fontSize: '14px', pt: '80px' })}>Loading…</p>
        ) : !postcard ? (
          <p className={css({ color: 'gray.500', fontSize: '15px', pt: '80px' })}>
            Postcard not found.
          </p>
        ) : (
          <>
            <h1
              className={css({
                fontSize: '22px',
                fontWeight: '800',
                color: 'gray.900',
                textAlign: 'center',
              })}
            >
              Postcard from #{displayNum}
            </h1>

            {postcard.status === 'ready' && postcard.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={postcard.imageUrl}
                alt={`Postcard from number ${displayNum}`}
                className={css({
                  w: '100%',
                  maxW: '560px',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                  border: '1px solid token(colors.gray.200)',
                })}
              />
            ) : postcard.status === 'generating' || postcard.status === 'pending' ? (
              <div
                className={css({
                  w: '100%',
                  maxW: '560px',
                  aspectRatio: '4/3',
                  borderRadius: '16px',
                  bg: 'gray.100',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'gray.400',
                  fontSize: '15px',
                  fontStyle: 'italic',
                })}
              >
                Your postcard is being created…
              </div>
            ) : (
              <div
                className={css({
                  w: '100%',
                  maxW: '560px',
                  aspectRatio: '4/3',
                  borderRadius: '16px',
                  bg: 'red.50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'red.400',
                  fontSize: '15px',
                })}
              >
                Something went wrong creating your postcard.
              </div>
            )}

            {/* Moment captions */}
            {postcard.manifest?.moments && postcard.manifest.moments.length > 0 && (
              <div
                className={vstack({
                  alignItems: 'stretch',
                  gap: '12px',
                  w: '100%',
                  maxW: '560px',
                })}
              >
                <h2
                  className={css({
                    fontSize: '15px',
                    fontWeight: '700',
                    color: 'gray.600',
                  })}
                >
                  Memorable moments
                </h2>
                {postcard.manifest.moments.map(
                  (m: { rank: number; caption: string; category: string }, i: number) => (
                    <div
                      key={i}
                      className={css({
                        p: '12px 16px',
                        bg: 'white',
                        borderRadius: '10px',
                        border: '1px solid token(colors.gray.200)',
                        fontSize: '14px',
                        color: 'gray.700',
                      })}
                    >
                      <span
                        className={css({
                          fontSize: '11px',
                          fontWeight: '600',
                          color: 'gray.400',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        })}
                      >
                        {m.category}
                      </span>
                      <p className={css({ mt: '4px' })}>{m.caption}</p>
                    </div>
                  )
                )}
              </div>
            )}

            {postcard.manifest?.sessionSummary && (
              <p
                className={css({
                  fontSize: '14px',
                  color: 'gray.500',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  maxW: '480px',
                })}
              >
                &ldquo;{postcard.manifest.sessionSummary}&rdquo;
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
