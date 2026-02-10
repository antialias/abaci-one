'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import { TtsTestPanel } from '@/components/admin/TtsTestPanel'
import { useBackgroundTask } from '@/hooks/useBackgroundTask'
import {
  useCollectedClips,
  useGenerateCollectedClips,
  collectedClipKeys,
} from '@/hooks/useCollectedClips'
import type { CollectedClipGenerateOutput } from '@/lib/tasks/collected-clip-generate'
import { isHashClipId } from '@/lib/audio/clipHash'
import { ALL_VOICES, VOICE_PROVIDERS, getVoiceMeta } from '@/lib/audio/voices'
import { Z_INDEX } from '@/constants/zIndex'
import { css } from '../../../../styled-system/css'

type VoiceSource = { type: 'pregenerated'; name: string } | { type: 'browser-tts' }

interface AudioStatus {
  activeVoice: string
  voices: Record<string, { total: number; existing: number }>
  totalCollectedClips: number
  voiceClipCounts: Record<string, number>
}

export default function AdminAudioPage() {
  const [status, setStatus] = useState<AudioStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voiceChain, setVoiceChain] = useState<VoiceSource[]>([])
  const [voiceChainDirty, setVoiceChainDirty] = useState(false)
  const [showVoiceChain, setShowVoiceChain] = useState(false)
  const [showTtsTest, setShowTtsTest] = useState(false)
  const [showClipManagement, setShowClipManagement] = useState(false)
  const [ccGenVoice, setCcGenVoice] = useState<string>('onyx')
  const [ccGenTaskId, setCcGenTaskId] = useState<string | null>(null)
  const [ccPlayingClipId, setCcPlayingClipId] = useState<string | null>(null)
  const ccAudioRef = useRef<HTMLAudioElement | null>(null)
  const queryClient = useQueryClient()

  // React Query: collected clips with per-voice generation status
  const { data: ccData, isLoading: collectedClipsLoading } = useCollectedClips(ccGenVoice, {
    enabled: showClipManagement,
  })
  const collectedClips = ccData?.clips ?? []
  const ccGeneratedFor = ccData?.generatedFor ?? {}

  // React Query: mutation for triggering collected clip generation
  const ccGenerateMutation = useGenerateCollectedClips(ccGenVoice)

  // Background task subscription for collected clip generation
  const { state: ccTaskState, cancel: cancelCcTask } =
    useBackgroundTask<CollectedClipGenerateOutput>(ccGenTaskId)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audio')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setStatus({
        activeVoice: data.activeVoice,
        voices: data.voices,
        totalCollectedClips: data.totalCollectedClips ?? 0,
        voiceClipCounts: data.voiceClipCounts ?? {},
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Fetch voice chain config on mount
  useEffect(() => {
    fetch('/api/settings/voice-chain')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.voiceChain) setVoiceChain(data.voiceChain)
      })
      .catch(() => {})
  }, [])

  const handleSaveVoiceChain = async () => {
    try {
      const res = await fetch('/api/settings/voice-chain', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceChain }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setVoiceChainDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save voice chain')
    }
  }

  const moveVoiceChainEntry = (index: number, direction: -1 | 1) => {
    const next = [...voiceChain]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setVoiceChain(next)
    setVoiceChainDirty(true)
  }

  const removeVoiceChainEntry = (index: number) => {
    setVoiceChain((prev) => prev.filter((_, i) => i !== index))
    setVoiceChainDirty(true)
  }

  const addToVoiceChain = (source: VoiceSource) => {
    setVoiceChain((prev) => [...prev, source])
    setVoiceChainDirty(true)
  }

  const isCcGenerating = ccTaskState?.status === 'pending' || ccTaskState?.status === 'running'

  const handleRemoveVoice = async (voice: string) => {
    if (!confirm(`Remove all clips for voice "${voice}"?`)) return
    try {
      const res = await fetch(`/api/admin/audio/voice/${encodeURIComponent(voice)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to remove')
      }
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove voice')
    }
  }

  // Collected clip generation handler (uses mutation)
  const handleCcGenerate = (clipIds: string[]) => {
    ccGenerateMutation.mutate(
      { voice: ccGenVoice, clipIds },
      {
        onSuccess: ({ taskId }) => setCcGenTaskId(taskId),
        onError: (err) => setError(err instanceof Error ? err.message : 'Generation failed'),
      }
    )
  }

  const handleCcPlayClip = (clipId: string) => {
    if (ccAudioRef.current) {
      ccAudioRef.current.pause()
    }
    const audio = new Audio(`/api/audio/clips/${ccGenVoice}/${clipId}`)
    ccAudioRef.current = audio
    setCcPlayingClipId(clipId)
    audio.play()
    audio.onended = () => setCcPlayingClipId(null)
    audio.onerror = () => setCcPlayingClipId(null)
  }

  // Invalidate collected clips query and refresh status when cc task completes
  useEffect(() => {
    if (ccTaskState?.status === 'completed' || ccTaskState?.status === 'failed') {
      queryClient.invalidateQueries({
        queryKey: collectedClipKeys.list(ccGenVoice),
      })
      fetchStatus()
    }
  }, [ccTaskState?.status, ccGenVoice, queryClient, fetchStatus])

  return (
    <>
      <AppNavBar navSlot={null} />
      <div className={css({ paddingTop: '56px' })}>
        <AdminNav />
      </div>
      <div
        data-component="AdminAudioPage"
        className={css({
          backgroundColor: '#0d1117',
          minHeight: '100vh',
          color: '#c9d1d9',
          padding: '24px',
        })}
      >
        <div className={css({ maxWidth: '1200px', margin: '0 auto' })}>
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
            })}
          >
            <h1
              className={css({
                fontSize: '24px',
                fontWeight: '600',
                color: '#f0f6fc',
              })}
            >
              Audio Management
            </h1>
            <button
              data-action="nuke-all-clips"
              disabled={isCcGenerating}
              onClick={async () => {
                if (
                  !confirm(
                    'Delete ALL generated mp3s AND collected clip records? This cannot be undone.'
                  )
                )
                  return
                if (
                  !confirm('Are you really sure? This removes every mp3 AND clears the database.')
                )
                  return
                try {
                  const res = await fetch('/api/admin/audio/voices', { method: 'DELETE' })
                  if (!res.ok) {
                    const data = await res.json()
                    throw new Error(data.error || 'Failed to remove')
                  }
                  const data = await res.json()
                  setError(null)
                  await fetchStatus()
                  queryClient.invalidateQueries({ queryKey: collectedClipKeys.list(ccGenVoice) })
                  alert(
                    `Removed ${data.removedDirs} voice director${data.removedDirs === 1 ? 'y' : 'ies'} and cleared all collected clips from database.`
                  )
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to nuke clips')
                }
              }}
              className={css({
                fontSize: '12px',
                backgroundColor: 'transparent',
                color: '#f85149',
                border: '1px solid #f85149',
                borderRadius: '6px',
                padding: '4px 12px',
                cursor: 'pointer',
                fontWeight: '600',
                flexShrink: 0,
                '&:hover': { backgroundColor: '#f8514922' },
                '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Nuke All Clips + DB
            </button>
          </div>

          {error && (
            <div
              data-element="error-banner"
              className={css({
                backgroundColor: '#3d1f28',
                border: '1px solid #f85149',
                borderRadius: '6px',
                padding: '12px 16px',
                marginBottom: '16px',
                color: '#f85149',
              })}
            >
              {error}
              <button
                onClick={() => setError(null)}
                className={css({
                  marginLeft: '12px',
                  color: '#8b949e',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                })}
              >
                dismiss
              </button>
            </div>
          )}

          {loading && <p className={css({ color: '#8b949e' })}>Loading...</p>}

          {status && (
            <>
              {/* Voice Chain Configuration — collapsible */}
              <section
                data-element="voice-chain-config"
                className={css({
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  marginBottom: '8px',
                })}
              >
                <button
                  data-action="toggle-voice-chain"
                  onClick={() => setShowVoiceChain((p) => !p)}
                  className={css({
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#f0f6fc',
                  })}
                >
                  <span className={css({ fontSize: '15px', fontWeight: '600' })}>
                    Voice Chain (Fallback Order)
                  </span>
                  <span className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                    <span className={css({ color: '#8b949e', fontSize: '12px' })}>
                      {voiceChain
                        .map((s) => (s.type === 'pregenerated' ? s.name : 'browser'))
                        .join(' \u2192 ')}
                    </span>
                    <span className={css({ color: '#8b949e', fontSize: '12px' })}>
                      {showVoiceChain ? '\u25B2' : '\u25BC'}
                    </span>
                  </span>
                </button>
                {showVoiceChain && (
                  <div className={css({ padding: '0 16px 16px' })}>
                    <p
                      className={css({ color: '#8b949e', fontSize: '13px', marginBottom: '12px' })}
                    >
                      Audio plays through each voice in order. If a clip is missing from the first
                      voice, the next voice is tried.
                    </p>

                    {voiceChain.length === 0 && (
                      <p
                        className={css({ color: '#8b949e', fontSize: '13px', fontStyle: 'italic' })}
                      >
                        No voice chain configured. Add a voice below.
                      </p>
                    )}

                    <div
                      className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginBottom: '16px',
                      })}
                    >
                      {voiceChain.map((source, idx) => (
                        <div
                          key={idx}
                          data-element="voice-chain-entry"
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: '#0d1117',
                            border: '1px solid #30363d',
                            borderRadius: '6px',
                            padding: '8px 12px',
                          })}
                        >
                          <span
                            className={css({ color: '#8b949e', fontSize: '12px', width: '20px' })}
                          >
                            {idx + 1}.
                          </span>
                          <span className={css({ color: '#f0f6fc', fontWeight: '600', flex: 1 })}>
                            {source.type === 'pregenerated' ? source.name : 'Browser TTS'}
                          </span>
                          <span
                            className={css({
                              display: 'flex',
                              alignItems: 'center',
                              flexShrink: 0,
                              fontSize: '11px',
                            })}
                          >
                            {source.type === 'pregenerated' ? (
                              (() => {
                                const meta = getVoiceMeta(source.name)
                                const providerLabel = meta
                                  ? `${meta.provider.name} ${meta.model.name}`
                                  : 'unknown'
                                const formatLabel = meta?.model.format ?? 'unknown'
                                return (
                                  <>
                                    <span
                                      className={css({
                                        padding: '2px 10px 2px 8px',
                                        backgroundColor: '#1f6feb33',
                                        color: '#58a6ff',
                                        clipPath:
                                          'polygon(0 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 0 100%)',
                                        borderRadius: '8px 0 0 8px',
                                      })}
                                    >
                                      {providerLabel}
                                    </span>
                                    <span
                                      className={css({
                                        padding: '2px 8px 2px 10px',
                                        backgroundColor: '#8b949e1a',
                                        color: '#8b949e',
                                        clipPath:
                                          'polygon(6px 0, 100% 0, 100% 100%, 6px 100%, 0 50%)',
                                        borderRadius: '0 8px 8px 0',
                                      })}
                                    >
                                      {formatLabel} on disk
                                    </span>
                                  </>
                                )
                              })()
                            ) : (
                              <span
                                className={css({
                                  padding: '2px 8px',
                                  borderRadius: '8px',
                                  backgroundColor: '#23863633',
                                  color: '#3fb950',
                                })}
                              >
                                Web Speech API
                              </span>
                            )}
                          </span>
                          <button
                            data-action="chain-move-up"
                            onClick={() => moveVoiceChainEntry(idx, -1)}
                            disabled={idx === 0}
                            className={css({
                              background: 'none',
                              border: 'none',
                              color: idx === 0 ? '#30363d' : '#8b949e',
                              cursor: idx === 0 ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              padding: '2px 4px',
                            })}
                            title="Move up"
                          >
                            &#9650;
                          </button>
                          <button
                            data-action="chain-move-down"
                            onClick={() => moveVoiceChainEntry(idx, 1)}
                            disabled={idx === voiceChain.length - 1}
                            className={css({
                              background: 'none',
                              border: 'none',
                              color: idx === voiceChain.length - 1 ? '#30363d' : '#8b949e',
                              cursor: idx === voiceChain.length - 1 ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              padding: '2px 4px',
                            })}
                            title="Move down"
                          >
                            &#9660;
                          </button>
                          <button
                            data-action="chain-remove"
                            onClick={() => removeVoiceChainEntry(idx)}
                            className={css({
                              background: 'none',
                              border: 'none',
                              color: '#f85149',
                              cursor: 'pointer',
                              fontSize: '14px',
                              padding: '2px 4px',
                            })}
                            title="Remove"
                          >
                            &#10005;
                          </button>
                        </div>
                      ))}
                    </div>

                    <div
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                      })}
                    >
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            data-element="add-chain-voice"
                            type="button"
                            className={css({
                              backgroundColor: '#0d1117',
                              color: '#f0f6fc',
                              border: '1px solid #30363d',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '13px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              '&:hover': { borderColor: '#8b949e' },
                            })}
                          >
                            Add voice...
                            <span className={css({ color: '#8b949e', fontSize: '10px' })}>
                              &#9662;
                            </span>
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            data-element="voice-dropdown-content"
                            sideOffset={5}
                            className={css({
                              backgroundColor: '#161b22',
                              border: '1px solid #30363d',
                              borderRadius: '8px',
                              padding: '4px',
                              minWidth: '280px',
                              maxHeight: '400px',
                              overflowY: 'auto',
                              zIndex: Z_INDEX.DROPDOWN,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                            })}
                          >
                            {(() => {
                              const hasBrowser = voiceChain.some((vc) => vc.type === 'browser-tts')
                              const chainPregenNames = new Set(
                                voiceChain
                                  .filter((vc) => vc.type === 'pregenerated')
                                  .map((vc) => (vc as { type: 'pregenerated'; name: string }).name)
                              )
                              const total = status?.totalCollectedClips ?? 0

                              // Build grouped provider sections, filtering out voices already in chain
                              const providerGroups = VOICE_PROVIDERS.map((provider) => {
                                const modelGroups = provider.models
                                  .map((model) => {
                                    const available = model.voices.filter(
                                      (v) => !chainPregenNames.has(v)
                                    )
                                    const sorted = [...available].sort((a, b) => {
                                      const genA = status?.voiceClipCounts?.[a] ?? 0
                                      const genB = status?.voiceClipCounts?.[b] ?? 0
                                      const pctA = total > 0 ? genA / total : 0
                                      const pctB = total > 0 ? genB / total : 0
                                      return pctB - pctA
                                    })
                                    return { model, voices: sorted }
                                  })
                                  .filter((g) => g.voices.length > 0)
                                return { provider, modelGroups }
                              }).filter((g) => g.modelGroups.length > 0)

                              const hasAnyAvailable = providerGroups.length > 0 || !hasBrowser
                              if (!hasAnyAvailable) {
                                return (
                                  <DropdownMenu.Label
                                    className={css({
                                      padding: '8px 12px',
                                      color: '#8b949e',
                                      fontSize: '13px',
                                      fontStyle: 'italic',
                                    })}
                                  >
                                    All voices added
                                  </DropdownMenu.Label>
                                )
                              }

                              const multipleProviders = VOICE_PROVIDERS.length > 1
                              const sectionSep = (
                                <DropdownMenu.Separator
                                  className={css({
                                    height: '1px',
                                    backgroundColor: '#30363d',
                                    margin: '4px 0',
                                  })}
                                />
                              )

                              const voiceItem = (v: string, format: string, isEmpty: boolean) => {
                                const generated = status?.voiceClipCounts?.[v] ?? 0
                                const pct = total > 0 ? Math.round((generated / total) * 100) : 0
                                const barColor =
                                  pct >= 100 ? '#3fb950' : pct > 0 ? '#d29922' : 'transparent'
                                return (
                                  <DropdownMenu.Item
                                    key={v}
                                    data-action={`add-voice-${v}`}
                                    onSelect={() =>
                                      addToVoiceChain({ type: 'pregenerated', name: v })
                                    }
                                    style={{ opacity: isEmpty ? 0.45 : 1 }}
                                    className={css({
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      outline: 'none',
                                      '&:hover': { backgroundColor: '#21262d' },
                                      '&:focus': { backgroundColor: '#21262d' },
                                    })}
                                  >
                                    <div
                                      className={css({
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '4px',
                                      })}
                                    >
                                      <span
                                        className={css({
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                        })}
                                      >
                                        <span
                                          className={css({
                                            color: isEmpty ? '#8b949e' : '#f0f6fc',
                                            fontWeight: '600',
                                            fontSize: '13px',
                                          })}
                                        >
                                          {v}
                                        </span>
                                        <span
                                          className={css({
                                            fontSize: '10px',
                                            padding: '0px 5px',
                                            borderRadius: '4px',
                                            backgroundColor: '#8b949e15',
                                            color: '#8b949e',
                                            fontFamily: 'monospace',
                                          })}
                                        >
                                          {format}
                                        </span>
                                      </span>
                                      <span
                                        className={css({
                                          color: '#8b949e',
                                          fontFamily: 'monospace',
                                          fontSize: '12px',
                                        })}
                                      >
                                        {generated === 0 ? 'none' : `${generated} / ${total}`}
                                      </span>
                                    </div>
                                    <div
                                      className={css({
                                        height: '4px',
                                        backgroundColor: '#30363d',
                                        borderRadius: '2px',
                                        overflow: 'hidden',
                                      })}
                                    >
                                      {pct > 0 && (
                                        <div
                                          style={{
                                            width: `${Math.min(pct, 100)}%`,
                                            backgroundColor: barColor,
                                          }}
                                          className={css({
                                            height: '100%',
                                            borderRadius: '2px',
                                            transition: 'width 0.3s',
                                          })}
                                        />
                                      )}
                                    </div>
                                  </DropdownMenu.Item>
                                )
                              }

                              const sections: React.ReactNode[] = []

                              // Browser TTS — always first (always healthy)
                              if (!hasBrowser) {
                                sections.push(
                                  <DropdownMenu.Item
                                    key="browser-tts"
                                    data-action="add-voice-browser-tts"
                                    onSelect={() => addToVoiceChain({ type: 'browser-tts' })}
                                    className={css({
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      outline: 'none',
                                      '&:hover': { backgroundColor: '#21262d' },
                                      '&:focus': { backgroundColor: '#21262d' },
                                    })}
                                  >
                                    <div
                                      className={css({
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '4px',
                                      })}
                                    >
                                      <span
                                        className={css({
                                          color: '#f0f6fc',
                                          fontWeight: '600',
                                          fontSize: '13px',
                                        })}
                                      >
                                        Browser TTS
                                      </span>
                                      <span
                                        className={css({
                                          fontSize: '11px',
                                          padding: '1px 6px',
                                          borderRadius: '8px',
                                          backgroundColor: '#23863633',
                                          color: '#3fb950',
                                        })}
                                      >
                                        always available
                                      </span>
                                    </div>
                                    <div
                                      className={css({
                                        height: '4px',
                                        backgroundColor: '#30363d',
                                        borderRadius: '2px',
                                        overflow: 'hidden',
                                      })}
                                    >
                                      <div
                                        style={{ width: '100%' }}
                                        className={css({
                                          height: '100%',
                                          borderRadius: '2px',
                                          backgroundColor: '#3fb950',
                                        })}
                                      />
                                    </div>
                                  </DropdownMenu.Item>
                                )
                              }

                              // Provider groups
                              for (const { provider, modelGroups } of providerGroups) {
                                const multipleModels = modelGroups.length > 1
                                if (sections.length > 0)
                                  sections.push(
                                    <React.Fragment key={`sep-${provider.id}`}>
                                      {sectionSep}
                                    </React.Fragment>
                                  )

                                if (multipleProviders || multipleModels) {
                                  // Show provider group header when multiple providers or models
                                  for (const { model, voices } of modelGroups) {
                                    sections.push(
                                      <React.Fragment key={`group-${provider.id}-${model.id}`}>
                                        <DropdownMenu.Label
                                          className={css({
                                            padding: '6px 12px 2px',
                                            color: '#8b949e',
                                            fontSize: '11px',
                                            fontWeight: '500',
                                          })}
                                        >
                                          {provider.name} {model.name}
                                        </DropdownMenu.Label>
                                        {voices.map((v) =>
                                          voiceItem(
                                            v,
                                            model.format,
                                            (status?.voiceClipCounts?.[v] ?? 0) === 0 && total === 0
                                          )
                                        )}
                                      </React.Fragment>
                                    )
                                  }
                                } else {
                                  // Single provider, single model: show inline header
                                  const { model, voices } = modelGroups[0]
                                  sections.push(
                                    <React.Fragment key={`group-${provider.id}-${model.id}`}>
                                      <DropdownMenu.Label
                                        className={css({
                                          padding: '6px 12px 2px',
                                          color: '#8b949e',
                                          fontSize: '11px',
                                          fontWeight: '500',
                                        })}
                                      >
                                        Voices by {provider.name} · {model.name}
                                      </DropdownMenu.Label>
                                      {voices.map((v) =>
                                        voiceItem(
                                          v,
                                          model.format,
                                          (status?.voiceClipCounts?.[v] ?? 0) === 0 && total === 0
                                        )
                                      )}
                                    </React.Fragment>
                                  )
                                }
                              }

                              return <>{sections}</>
                            })()}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>

                    {voiceChainDirty && (
                      <button
                        data-action="save-voice-chain"
                        onClick={handleSaveVoiceChain}
                        className={css({
                          backgroundColor: '#238636',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 20px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: '#2ea043' },
                        })}
                      >
                        Save Voice Chain
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* TTS Test Panel — collapsible */}
              <section
                data-element="tts-test-panel"
                className={css({
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  marginBottom: '8px',
                })}
              >
                <button
                  data-action="toggle-tts-test"
                  onClick={() => setShowTtsTest((p) => !p)}
                  className={css({
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#f0f6fc',
                  })}
                >
                  <span className={css({ fontSize: '15px', fontWeight: '600' })}>
                    TTS Test Panel
                  </span>
                  <span className={css({ color: '#8b949e', fontSize: '12px' })}>
                    {showTtsTest ? '\u25B2' : '\u25BC'}
                  </span>
                </button>
                {showTtsTest && <TtsTestPanel voiceChain={voiceChain} />}
              </section>

              {/* Clip Management — collapsible */}
              <section
                data-element="clip-management"
                className={css({
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  marginBottom: '8px',
                })}
              >
                <button
                  data-action="toggle-clip-management"
                  onClick={() => setShowClipManagement((p) => !p)}
                  className={css({
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#f0f6fc',
                  })}
                >
                  <span className={css({ fontSize: '15px', fontWeight: '600' })}>
                    Clip Management
                  </span>
                  <span className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                    <span className={css({ color: '#8b949e', fontSize: '12px' })}>
                      {(() => {
                        const generated = status?.voiceClipCounts?.[ccGenVoice] ?? 0
                        const total = status?.totalCollectedClips ?? 0
                        if (total === 0) return ''
                        return `${total} clips \u00b7 viewing ${ccGenVoice} (${generated}/${total})`
                      })()}
                    </span>
                    <span className={css({ color: '#8b949e', fontSize: '12px' })}>
                      {showClipManagement ? '\u25B2' : '\u25BC'}
                    </span>
                  </span>
                </button>
                {showClipManagement && (
                  <div className={css({ padding: '0 16px 16px' })}>
                    <p
                      className={css({ color: '#8b949e', fontSize: '13px', marginBottom: '12px' })}
                    >
                      Clips collected from app usage. Generate mp3s for a voice, then add the voice
                      to the chain above.
                    </p>

                    {/* Voice selector + controls */}
                    <div
                      data-element="cc-controls"
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                        flexWrap: 'wrap',
                      })}
                    >
                      <label className={css({ color: '#8b949e', fontSize: '13px' })}>Voice:</label>
                      <select
                        data-element="cc-voice-select"
                        value={ccGenVoice}
                        onChange={(e) => setCcGenVoice(e.target.value)}
                        className={css({
                          backgroundColor: '#0d1117',
                          color: '#f0f6fc',
                          border: '1px solid #30363d',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '13px',
                        })}
                      >
                        {ALL_VOICES.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const missingCount = collectedClips.filter(
                          (c) => !ccGeneratedFor[c.id]
                        ).length
                        return missingCount > 0 ? (
                          <button
                            data-action="cc-generate-all-missing"
                            onClick={() => {
                              const missingIds = collectedClips
                                .filter((c) => !ccGeneratedFor[c.id])
                                .map((c) => c.id)
                              handleCcGenerate(missingIds)
                            }}
                            disabled={isCcGenerating}
                            className={css({
                              fontSize: '12px',
                              backgroundColor: '#238636',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '4px 12px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              '&:hover': { backgroundColor: '#2ea043' },
                              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                            })}
                          >
                            Generate {missingCount} Missing
                          </button>
                        ) : null
                      })()}
                      <button
                        data-action="refresh-collected"
                        onClick={() =>
                          queryClient.invalidateQueries({
                            queryKey: collectedClipKeys.list(ccGenVoice),
                          })
                        }
                        disabled={collectedClipsLoading}
                        className={css({
                          fontSize: '12px',
                          background: 'none',
                          border: '1px solid #30363d',
                          color: '#8b949e',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#8b949e' },
                          '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                        })}
                      >
                        Refresh
                      </button>
                      {/* Remove clips — only when voice has clips on disk and is NOT in voice chain */}
                      {(() => {
                        const hasClips = !!status?.voices?.[ccGenVoice]
                        const inChain = voiceChain.some(
                          (s) => s.type === 'pregenerated' && s.name === ccGenVoice
                        )
                        return hasClips && !inChain && !isCcGenerating ? (
                          <button
                            data-action="remove-voice-clips"
                            onClick={() => handleRemoveVoice(ccGenVoice)}
                            className={css({
                              fontSize: '12px',
                              background: 'none',
                              border: 'none',
                              color: '#f85149',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              '&:hover': { textDecoration: 'underline' },
                            })}
                          >
                            Remove clips for &ldquo;{ccGenVoice}&rdquo;
                          </button>
                        ) : null
                      })()}
                    </div>

                    {/* Voice Health Banner */}
                    {(() => {
                      const meta = getVoiceMeta(ccGenVoice)
                      const generated = status?.voiceClipCounts?.[ccGenVoice] ?? 0
                      const total = status?.totalCollectedClips ?? 0
                      const pct = total > 0 ? Math.round((generated / total) * 100) : 0
                      const barColor = pct >= 100 ? '#3fb950' : pct > 0 ? '#d29922' : '#484f58'
                      const chainIndex = voiceChain.findIndex(
                        (s) => s.type === 'pregenerated' && s.name === ccGenVoice
                      )
                      const positionLabel =
                        chainIndex >= 0
                          ? `Position #${chainIndex + 1} in voice chain`
                          : 'Not in voice chain'
                      return (
                        <div
                          data-element="voice-health-banner"
                          className={css({
                            backgroundColor: '#0d1117',
                            border: '1px solid #30363d',
                            borderRadius: '6px',
                            padding: '12px',
                            marginBottom: '12px',
                          })}
                        >
                          <div
                            className={css({
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '6px',
                            })}
                          >
                            <span
                              className={css({
                                color: '#f0f6fc',
                                fontSize: '13px',
                                fontWeight: '600',
                              })}
                            >
                              {ccGenVoice}
                              {meta && (
                                <span className={css({ color: '#8b949e', fontWeight: '400' })}>
                                  {' '}
                                  &middot; {meta.provider.name} {meta.model.name} &middot;{' '}
                                  {meta.model.format}
                                </span>
                              )}
                            </span>
                            <span
                              className={css({
                                fontSize: '11px',
                                color: chainIndex >= 0 ? '#58a6ff' : '#8b949e',
                                fontStyle: chainIndex >= 0 ? 'normal' : 'italic',
                              })}
                            >
                              {positionLabel}
                            </span>
                          </div>
                          <div
                            className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}
                          >
                            <div
                              className={css({
                                flex: 1,
                                height: '6px',
                                backgroundColor: '#30363d',
                                borderRadius: '3px',
                                overflow: 'hidden',
                              })}
                            >
                              <div
                                style={{ width: `${Math.min(pct, 100)}%` }}
                                className={css({
                                  height: '100%',
                                  borderRadius: '3px',
                                  backgroundColor: barColor,
                                  transition: 'width 0.3s',
                                })}
                              />
                            </div>
                            <span
                              className={css({
                                color: '#8b949e',
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                flexShrink: 0,
                              })}
                            >
                              {generated} / {total} ({pct}%)
                            </span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* CC generation progress */}
                    {ccTaskState && (
                      <div
                        data-element="cc-gen-progress"
                        className={css({
                          backgroundColor: '#0d1117',
                          border: '1px solid #30363d',
                          borderRadius: '6px',
                          padding: '12px',
                          marginBottom: '12px',
                        })}
                      >
                        <div
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                          })}
                        >
                          <span
                            className={css({
                              color: '#f0f6fc',
                              fontSize: '13px',
                              fontWeight: '600',
                            })}
                          >
                            Generation {isCcGenerating ? 'in progress...' : ccTaskState.status}
                          </span>
                          {isCcGenerating && (
                            <button
                              data-action="cancel-cc-gen"
                              onClick={cancelCcTask}
                              className={css({
                                fontSize: '11px',
                                background: 'none',
                                border: '1px solid #f85149',
                                color: '#f85149',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                cursor: 'pointer',
                              })}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        {isCcGenerating && (
                          <div>
                            <div
                              className={css({
                                backgroundColor: '#30363d',
                                borderRadius: '4px',
                                height: '6px',
                                overflow: 'hidden',
                              })}
                            >
                              <div
                                className={css({
                                  backgroundColor: '#58a6ff',
                                  height: '100%',
                                  transition: 'width 0.3s',
                                })}
                                style={{ width: `${ccTaskState.progress}%` }}
                              />
                            </div>
                            <p
                              className={css({
                                color: '#8b949e',
                                fontSize: '11px',
                                marginTop: '4px',
                              })}
                            >
                              {ccTaskState.progressMessage || `${ccTaskState.progress}%`}
                            </p>
                          </div>
                        )}
                        {ccTaskState.output && (
                          <p className={css({ color: '#8b949e', fontSize: '12px' })}>
                            Generated: {ccTaskState.output.generated}, Errors:{' '}
                            {ccTaskState.output.errors}, Total: {ccTaskState.output.total}
                          </p>
                        )}
                        {ccTaskState.error && (
                          <div
                            data-element="cc-task-error-banner"
                            className={css({
                              backgroundColor: '#3d1f28',
                              border: '1px solid #f85149',
                              borderRadius: '6px',
                              padding: '10px 14px',
                              marginTop: '8px',
                              color: '#f85149',
                              fontSize: '13px',
                              lineHeight: '1.5',
                            })}
                          >
                            {ccTaskState.error}
                          </div>
                        )}
                        {/* Per-clip event log */}
                        {(() => {
                          const ccClipEvents = (ccTaskState.events ?? []).filter(
                            (e) => e.eventType === 'cc_clip_done' || e.eventType === 'cc_clip_error'
                          )
                          return ccClipEvents.length > 0 ? (
                            <div
                              data-element="cc-clip-events"
                              className={css({
                                maxHeight: '150px',
                                overflowY: 'auto',
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                marginTop: '8px',
                              })}
                            >
                              {ccClipEvents.map((e, i) => {
                                const payload = e.payload as {
                                  clipId?: string
                                  error?: string
                                }
                                return (
                                  <div
                                    key={i}
                                    className={css({
                                      color:
                                        e.eventType === 'cc_clip_error' ? '#f85149' : '#3fb950',
                                      padding: '1px 0',
                                    })}
                                  >
                                    {e.eventType === 'cc_clip_done' ? '\u2713' : '\u2717'}{' '}
                                    {payload.clipId}
                                    {payload.error && ` \u2014 ${payload.error}`}
                                  </div>
                                )
                              })}
                            </div>
                          ) : null
                        })()}
                      </div>
                    )}

                    {collectedClipsLoading && (
                      <p className={css({ color: '#8b949e', fontSize: '13px' })}>Loading...</p>
                    )}

                    {!collectedClipsLoading && collectedClips.length === 0 && (
                      <p
                        className={css({ color: '#8b949e', fontSize: '13px', fontStyle: 'italic' })}
                      >
                        No clips collected yet. Use the app with audio enabled to populate this
                        list.
                      </p>
                    )}

                    {collectedClips.length > 0 &&
                      (() => {
                        const clipsWithoutSay = collectedClips.filter(
                          (c) => !c.say || Object.keys(c.say).length === 0
                        )

                        // Group clips by their text content
                        const getClipText = (clip: (typeof collectedClips)[0]) =>
                          clip.say ? Object.values(clip.say)[0] ?? null : null
                        const groups: {
                          text: string | null
                          clips: typeof collectedClips
                        }[] = []
                        const groupMap = new Map<string, typeof collectedClips>()
                        for (const clip of collectedClips) {
                          const text = getClipText(clip)
                          const key = text ?? `__no_say__${clip.id}`
                          let group = groupMap.get(key)
                          if (!group) {
                            group = []
                            groupMap.set(key, group)
                            groups.push({ text, clips: group })
                          }
                          group.push(clip)
                        }

                        return (
                          <>
                            {clipsWithoutSay.length > 0 && (
                              <div
                                data-element="cc-missing-say-warning"
                                className={css({
                                  backgroundColor: '#3b2e00',
                                  border: '1px solid #d29922',
                                  borderRadius: '6px',
                                  padding: '10px 14px',
                                  marginBottom: '12px',
                                  color: '#d29922',
                                  fontSize: '13px',
                                  lineHeight: '1.5',
                                })}
                              >
                                <strong>
                                  {clipsWithoutSay.length} clip
                                  {clipsWithoutSay.length > 1 ? 's' : ''}
                                </strong>{' '}
                                missing{' '}
                                <code
                                  className={css({
                                    fontSize: '12px',
                                    backgroundColor: '#d2992220',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                  })}
                                >
                                  say
                                </code>{' '}
                                text. These will use the clip ID as the spoken text, which may not
                                sound natural. Register clips with a{' '}
                                <code
                                  className={css({
                                    fontSize: '12px',
                                    backgroundColor: '#d2992220',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                  })}
                                >
                                  say
                                </code>{' '}
                                map in{' '}
                                <code
                                  className={css({
                                    fontSize: '12px',
                                    backgroundColor: '#d2992220',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                  })}
                                >
                                  useTTS()
                                </code>{' '}
                                to provide proper text.
                              </div>
                            )}
                            <table
                              data-element="cc-grouped-table"
                              className={css({
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '13px',
                              })}
                            >
                              <thead>
                                <tr>
                                  {['Status', 'Tone', 'Clip ID', 'Plays', 'Play', 'Actions'].map(
                                    (header, idx) => (
                                      <th
                                        key={header}
                                        className={css({
                                          textAlign:
                                            idx === 1 || idx === 2 ? 'left' : 'center',
                                          padding: '6px 8px',
                                          color: '#8b949e',
                                          borderBottom: '1px solid #30363d',
                                          fontWeight: '500',
                                          backgroundColor: '#161b22',
                                          width:
                                            idx === 0 || idx === 4
                                              ? '50px'
                                              : idx === 5
                                                ? '90px'
                                                : undefined,
                                        })}
                                      >
                                        {header}
                                      </th>
                                    )
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {groups.map((group, groupIdx) => {
                                  const groupGenerated = group.clips.filter(
                                    (c) => !!ccGeneratedFor[c.id]
                                  ).length
                                  const allGenerated = groupGenerated === group.clips.length
                                  return (
                                    <React.Fragment key={groupIdx}>
                                      {/* Group header row */}
                                      <tr data-element="cc-group-header">
                                        <td
                                          colSpan={6}
                                          className={css({
                                            padding: '10px 8px 6px',
                                            borderBottom: '1px solid #30363d',
                                            backgroundColor: '#0d1117',
                                          })}
                                        >
                                          <div
                                            className={css({
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                            })}
                                          >
                                            {group.text ? (
                                              <span
                                                className={css({
                                                  color: '#f0f6fc',
                                                  fontWeight: '600',
                                                  fontSize: '13px',
                                                })}
                                              >
                                                &ldquo;{group.text}&rdquo;
                                              </span>
                                            ) : (
                                              <span
                                                className={css({
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '4px',
                                                })}
                                              >
                                                <span
                                                  className={css({
                                                    color: '#d29922',
                                                    fontSize: '13px',
                                                  })}
                                                >
                                                  &#9888;
                                                </span>
                                                <span
                                                  className={css({
                                                    color: '#d29922',
                                                    fontStyle: 'italic',
                                                    fontSize: '13px',
                                                  })}
                                                >
                                                  &quot;{group.clips[0].id}&quot; (no say text)
                                                </span>
                                              </span>
                                            )}
                                            <span
                                              className={css({
                                                color: '#8b949e',
                                                fontSize: '11px',
                                              })}
                                            >
                                              {group.clips.length} tone
                                              {group.clips.length !== 1 ? 's' : ''}
                                            </span>
                                            <span
                                              className={css({
                                                display: 'inline-block',
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                backgroundColor: allGenerated
                                                  ? '#3fb950'
                                                  : groupGenerated > 0
                                                    ? '#d29922'
                                                    : '#484f58',
                                                flexShrink: 0,
                                              })}
                                              title={`${groupGenerated}/${group.clips.length} generated`}
                                            />
                                          </div>
                                        </td>
                                      </tr>
                                      {/* Individual tone rows */}
                                      {group.clips.map((clip) => {
                                        const isGenerated = !!ccGeneratedFor[clip.id]
                                        return (
                                          <tr key={clip.id} data-element="cc-clip-row">
                                            <td
                                              className={css({
                                                padding: '6px 8px',
                                                borderBottom: '1px solid #21262d',
                                                textAlign: 'center',
                                              })}
                                            >
                                              <span
                                                title={
                                                  isGenerated
                                                    ? `Generated for ${ccGenVoice}`
                                                    : 'Not generated'
                                                }
                                                className={css({
                                                  display: 'inline-block',
                                                  width: '8px',
                                                  height: '8px',
                                                  borderRadius: '50%',
                                                  backgroundColor: isGenerated
                                                    ? '#3fb950'
                                                    : '#484f58',
                                                })}
                                              />
                                            </td>
                                            <td
                                              className={css({
                                                padding: '6px 8px',
                                                borderBottom: '1px solid #21262d',
                                                fontSize: '12px',
                                                color: '#c9d1d9',
                                                maxWidth: '200px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                              })}
                                              title={clip.tone}
                                            >
                                              {clip.tone}
                                            </td>
                                            <td
                                              className={css({
                                                padding: '6px 8px',
                                                borderBottom: '1px solid #21262d',
                                                color: '#8b949e',
                                                fontFamily: 'monospace',
                                                fontSize: '11px',
                                              })}
                                            >
                                              {clip.id}
                                              {isHashClipId(clip.id) && (
                                                <span
                                                  data-element="hash-badge"
                                                  title="Content-addressed clip ID (auto-generated from text + tone)"
                                                  className={css({
                                                    marginLeft: '6px',
                                                    fontSize: '10px',
                                                    padding: '1px 5px',
                                                    borderRadius: '8px',
                                                    backgroundColor: '#8b949e22',
                                                    color: '#8b949e',
                                                  })}
                                                >
                                                  hash
                                                </span>
                                              )}
                                            </td>
                                            <td
                                              className={css({
                                                padding: '6px 8px',
                                                borderBottom: '1px solid #21262d',
                                                textAlign: 'center',
                                                fontFamily: 'monospace',
                                                color:
                                                  clip.playCount > 0 ? '#3fb950' : '#8b949e',
                                              })}
                                            >
                                              {clip.playCount}
                                            </td>
                                            <td
                                              className={css({
                                                padding: '6px 8px',
                                                borderBottom: '1px solid #21262d',
                                                textAlign: 'center',
                                              })}
                                            >
                                              <button
                                                data-action="play-cc-clip"
                                                onClick={() => handleCcPlayClip(clip.id)}
                                                disabled={!isGenerated}
                                                className={css({
                                                  background: 'none',
                                                  border: 'none',
                                                  color:
                                                    ccPlayingClipId === clip.id
                                                      ? '#58a6ff'
                                                      : '#c9d1d9',
                                                  cursor: isGenerated
                                                    ? 'pointer'
                                                    : 'not-allowed',
                                                  fontSize: '16px',
                                                  opacity: isGenerated ? 1 : 0.3,
                                                })}
                                                title={
                                                  isGenerated ? 'Play clip' : 'Not generated yet'
                                                }
                                              >
                                                {ccPlayingClipId === clip.id
                                                  ? '\u23F8'
                                                  : '\u25B6'}
                                              </button>
                                            </td>
                                            <td
                                              className={css({
                                                padding: '6px 8px',
                                                borderBottom: '1px solid #21262d',
                                                textAlign: 'center',
                                              })}
                                            >
                                              <button
                                                data-action="generate-cc-clip"
                                                onClick={() => handleCcGenerate([clip.id])}
                                                disabled={isCcGenerating}
                                                className={css({
                                                  fontSize: '11px',
                                                  backgroundColor: isGenerated
                                                    ? 'transparent'
                                                    : '#238636',
                                                  color: isGenerated ? '#d29922' : '#fff',
                                                  border: isGenerated
                                                    ? '1px solid #d29922'
                                                    : 'none',
                                                  borderRadius: '6px',
                                                  padding: '2px 8px',
                                                  cursor: 'pointer',
                                                  '&:disabled': {
                                                    opacity: 0.5,
                                                    cursor: 'not-allowed',
                                                  },
                                                })}
                                              >
                                                {isGenerated ? 'Regen' : 'Generate'}
                                              </button>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </React.Fragment>
                                  )
                                })}
                              </tbody>
                            </table>
                          </>
                        )
                      })()}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  )
}
