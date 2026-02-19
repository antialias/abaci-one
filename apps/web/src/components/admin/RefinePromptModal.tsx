'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useState, useEffect } from 'react'
import { css } from '../../../styled-system/css'

interface RefinePromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  original: string
  refined: string
  loading: boolean
  onAccept: (refined: string) => void
}

export function RefinePromptModal({
  open,
  onOpenChange,
  original,
  refined,
  loading,
  onAccept,
}: RefinePromptModalProps) {
  const [editedRefined, setEditedRefined] = useState(refined)

  useEffect(() => {
    setEditedRefined(refined)
  }, [refined])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-element="refine-modal-overlay"
          className={css({
            position: 'fixed',
            inset: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 9998,
            animation: 'fadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          })}
        />
        <Dialog.Content
          data-component="refine-prompt-modal"
          aria-describedby={undefined}
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#161b22',
            borderRadius: '12px',
            border: '1px solid #30363d',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '24px',
            width: '90vw',
            maxWidth: '600px',
            maxHeight: '85vh',
            overflow: 'auto',
            zIndex: 9999,
            animation: 'contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          })}
        >
          <Dialog.Title
            className={css({
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '16px',
              color: '#f0f6fc',
            })}
          >
            Refine Hero Prompt
          </Dialog.Title>

          {loading ? (
            <div
              data-element="loading-state"
              className={css({
                textAlign: 'center',
                padding: '32px',
                color: '#8b949e',
                fontSize: '14px',
              })}
            >
              Refining prompt...
            </div>
          ) : (
            <>
              {/* Original prompt */}
              <div className={css({ marginBottom: '16px' })}>
                <label
                  className={css({
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#8b949e',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  })}
                >
                  Original
                </label>
                <div
                  data-element="original-prompt"
                  className={css({
                    padding: '12px',
                    backgroundColor: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#484f58',
                    lineHeight: '1.5',
                  })}
                >
                  {original}
                </div>
              </div>

              {/* Refined prompt (editable) */}
              <div className={css({ marginBottom: '20px' })}>
                <label
                  className={css({
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#58a6ff',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  })}
                >
                  Refined
                </label>
                <textarea
                  data-element="refined-textarea"
                  value={editedRefined}
                  onChange={(e) => setEditedRefined(e.target.value)}
                  rows={5}
                  className={css({
                    width: '100%',
                    backgroundColor: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: '6px',
                    padding: '12px',
                    color: '#c9d1d9',
                    fontSize: '13px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: '1.5',
                    '&:focus': {
                      outline: 'none',
                      borderColor: '#58a6ff',
                    },
                  })}
                />
              </div>

              {/* Actions */}
              <div
                className={css({
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'flex-end',
                })}
              >
                <Dialog.Close asChild>
                  <button
                    data-action="cancel-refine"
                    className={css({
                      backgroundColor: '#21262d',
                      color: '#c9d1d9',
                      border: '1px solid #30363d',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: '#30363d' },
                    })}
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  data-action="accept-refine"
                  onClick={() => {
                    onAccept(editedRefined)
                    onOpenChange(false)
                  }}
                  disabled={!editedRefined.trim()}
                  className={css({
                    backgroundColor: '#238636',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#2ea043' },
                    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  Accept
                </button>
              </div>
            </>
          )}

          <Dialog.Close
            data-action="close-refine-modal"
            className={css({
              position: 'absolute',
              top: '16px',
              right: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              padding: '4px',
              color: '#8b949e',
              cursor: 'pointer',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '18px',
              lineHeight: 1,
              '&:hover': {
                backgroundColor: '#21262d',
                color: '#c9d1d9',
              },
            })}
          >
            ✕
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
