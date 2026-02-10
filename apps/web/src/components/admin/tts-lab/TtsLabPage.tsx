'use client'

import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import { useAudioManager } from '@/hooks/useAudioManager'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import { css } from '../../../../styled-system/css'
import { RouterChangeTest } from './tests/RouterChangeTest'
import { RapidFireTest } from './tests/RapidFireTest'
import { StrictModeTest } from './tests/StrictModeTest'
import { MultiClipSequenceTest } from './tests/MultiClipSequenceTest'
import { NovelClipTest } from './tests/NovelClipTest'
import { MixedSourceTest } from './tests/MixedSourceTest'

function ManagerStateBar() {
  const manager = useAudioManagerInstance()
  const { isEnabled, isPlaying, volume, setEnabled } = useAudioManager()

  const collection = manager.getCollection()
  const voiceChainAvail = manager.getClipAvailability('number-1') // probe to see chain

  return (
    <div
      data-component="ManagerStateBar"
      className={css({
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '16px',
        fontSize: '12px',
      })}
    >
      <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
        <span className={css({ color: '#8b949e' })}>Enabled:</span>
        <span style={{ color: isEnabled ? '#3fb950' : '#f85149' }}>
          {isEnabled ? 'YES' : 'NO'}
        </span>
        <button
          onClick={() => setEnabled(true)}
          className={css({
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid #3fb950',
            backgroundColor: 'transparent',
            color: '#3fb950',
            cursor: 'pointer',
            _hover: { backgroundColor: '#3fb95020' },
          })}
        >
          Force Enable
        </button>
      </div>
      <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
        <span className={css({ color: '#8b949e' })}>Playing:</span>
        <span style={{ color: isPlaying ? '#58a6ff' : '#484f58' }}>
          {isPlaying ? 'YES' : 'NO'}
        </span>
      </div>
      <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
        <span className={css({ color: '#8b949e' })}>Volume:</span>
        <span className={css({ color: '#c9d1d9' })}>{Math.round(volume * 100)}%</span>
      </div>
      <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
        <span className={css({ color: '#8b949e' })}>Collection:</span>
        <span className={css({ color: '#c9d1d9' })}>{collection.length} clips</span>
      </div>
      <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
        <span className={css({ color: '#8b949e' })}>Voice chain:</span>
        <span className={css({ color: '#c9d1d9' })}>
          {voiceChainAvail.length === 0
            ? '(none)'
            : voiceChainAvail
                .map((a) =>
                  a.source.type === 'pregenerated' ? a.source.name : 'browser-tts'
                )
                .join(' → ')}
        </span>
      </div>
    </div>
  )
}

export function TtsLabPage() {
  return (
    <>
      <AppNavBar navSlot={null} />
      <div className={css({ paddingTop: '56px' })}>
        <AdminNav />
      </div>
      <div
        data-component="TtsLabPage"
        className={css({
          backgroundColor: '#0d1117',
          minHeight: '100vh',
          color: '#c9d1d9',
          padding: '24px',
        })}
      >
        <div className={css({ maxWidth: '900px', margin: '0 auto' })}>
          <h1
            className={css({
              fontSize: '20px',
              fontWeight: '600',
              color: '#f0f6fc',
              marginBottom: '4px',
            })}
          >
            TTS Diagnostic Lab
          </h1>
          <p className={css({ fontSize: '13px', color: '#8b949e', marginBottom: '16px' })}>
            Reliability testing for useTTS and TtsAudioManager under stress conditions
          </p>

          <ManagerStateBar />

          <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' })}>
            <RouterChangeTest />
            <RapidFireTest />
            <StrictModeTest />
            <MultiClipSequenceTest />
            <NovelClipTest />
            <MixedSourceTest />
          </div>
        </div>
      </div>
    </>
  )
}
