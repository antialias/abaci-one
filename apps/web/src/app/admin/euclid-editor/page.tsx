'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import {
  PROPOSITION_REFS,
  PROPOSITION_BLOCKS,
} from '@/components/toys/euclid/editor/propositionReference'

interface SavedProof {
  id: number
  filename: string
  savedAt: string
}

export default function EuclidEditorListPage() {
  const [savedProofs, setSavedProofs] = useState<Map<number, SavedProof>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/euclid')
      .then((res) => res.json())
      .then((data) => {
        const map = new Map<number, SavedProof>()
        for (const proof of data.proofs ?? []) {
          map.set(proof.id, proof)
        }
        setSavedProofs(map)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      data-component="euclid-editor-list"
      style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc' }}
    >
      <AppNavBar />
      <AdminNav />

      <div
        className={css({
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '24px',
        })}
      >
        <h1
          className={css({
            fontSize: '24px',
            fontWeight: '600',
            marginBottom: '8px',
          })}
        >
          Euclid Proof Editor
        </h1>
        <p
          className={css({
            color: '#8b949e',
            fontSize: '14px',
            marginBottom: '32px',
          })}
        >
          Interactive proof authoring for all 48 Book I propositions. Click a proposition to open
          the editor.
        </p>

        {loading ? (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : (
          PROPOSITION_BLOCKS.map((block) => (
            <div key={block.name} style={{ marginBottom: 32 }}>
              <h2
                className={css({
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#c9d1d9',
                  marginBottom: '12px',
                  borderBottom: '1px solid #21262d',
                  paddingBottom: '8px',
                })}
              >
                {block.name}
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                {block.propIds.map((id) => {
                  const ref = PROPOSITION_REFS[id]
                  if (!ref) return null
                  const saved = savedProofs.get(id)
                  return (
                    <Link
                      key={id}
                      href={`/admin/euclid-editor/${id}`}
                      data-element="prop-card"
                      className={css({
                        display: 'block',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid #30363d',
                        background: saved ? '#161b22' : '#0d1117',
                        textDecoration: 'none',
                        transition: 'all 0.15s',
                        '&:hover': {
                          background: '#1c2128',
                          borderColor: '#58a6ff',
                        },
                      })}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 22,
                            height: 22,
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background:
                              ref.type === 'C'
                                ? 'rgba(78, 121, 167, 0.2)'
                                : 'rgba(225, 87, 89, 0.2)',
                            color: ref.type === 'C' ? '#4E79A7' : '#E15759',
                          }}
                        >
                          {ref.type}
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#f0f6fc',
                          }}
                        >
                          I.{id}
                        </span>
                        {saved && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: '#3fb950',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#8b949e',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ref.title}
                      </div>
                      {saved && (
                        <div
                          style={{
                            fontSize: 10,
                            color: '#3fb950',
                            marginTop: 4,
                          }}
                        >
                          Saved {new Date(saved.savedAt).toLocaleDateString()}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
