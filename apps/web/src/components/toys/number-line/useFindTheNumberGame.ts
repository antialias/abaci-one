import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { NumberLineState } from './types'
import type { RenderTarget } from './renderNumberLine'
import { computeProximity } from './findTheNumber/computeProximity'
import type { ProximityZone, ProximityResult } from './findTheNumber/computeProximity'
import type { FindTheNumberGameState } from './findTheNumber/FindTheNumberBar'
import { useFindTheNumberAudio } from './findTheNumber/useFindTheNumberAudio'

function getTargetPrecisionForHint(target: number): number {
  if (Number.isInteger(target)) return 0
  const str = target.toString()
  const dot = str.indexOf('.')
  if (dot === -1) return 0
  return Math.min(str.slice(dot + 1).length, 6)
}

function formatApprox(n: number): string {
  if (Math.abs(n) >= 100) return String(Math.round(n))
  if (Math.abs(n) >= 10) return String(Math.round(n * 10) / 10)
  return String(Math.round(n * 100) / 100)
}

const GAME_EMOJIS = ['⭐', '🚀', '💎', '🦄', '🌈', '🎯', '🔥', '🌸', '🐙', '🍕', '🎪', '🪐']

interface UseFindTheNumberGameOptions {
  stateRef: MutableRefObject<NumberLineState>
  cssWidthRef: MutableRefObject<number>
  drawRef: MutableRefObject<() => void>
  voiceState: string
  sendSystemMessage: (msg: string, force?: boolean) => void
  setActiveGameId: (id: string | null) => void
  startFindNumberFnRef: MutableRefObject<(target: number) => void>
  stopFindNumberFnRef: MutableRefObject<() => void>
}

export function useFindTheNumberGame({
  stateRef,
  cssWidthRef,
  drawRef,
  voiceState,
  sendSystemMessage,
  setActiveGameId,
  startFindNumberFnRef,
  stopFindNumberFnRef,
}: UseFindTheNumberGameOptions) {
  const [gameState, setGameState] = useState<FindTheNumberGameState>('idle')
  const targetRef = useRef<{ value: number; emoji: string } | null>(null)
  const gameStateRef = useRef<FindTheNumberGameState>('idle')
  gameStateRef.current = gameState

  const [audioZone, setAudioZone] = useState<ProximityZone | null>(null)
  const prevGameZoneRef = useRef<ProximityZone | null>(null)
  const proximityRef = useRef<ProximityResult | null>(null)
  const renderTargetRef = useRef<RenderTarget | undefined>(undefined)

  const labelScaleRef = useRef(1)
  const labelMinOpacityRef = useRef(0)

  const [gameStartedByModel, setGameStartedByModel] = useState(false)
  const gameStartedByModelRef = useRef(false)
  const gameRafRef = useRef<number>(0)

  // Called from parent's draw() to compute game proximity each frame
  const computeGameProximity = useCallback(() => {
    const target = targetRef.current
    let renderTarget: RenderTarget | undefined
    if (target && gameStateRef.current === 'active') {
      const prox = computeProximity(target.value, stateRef.current, cssWidthRef.current)
      renderTarget = { value: target.value, emoji: target.emoji, opacity: prox.opacity }
      proximityRef.current = prox
      if (prox.zone !== prevGameZoneRef.current) {
        prevGameZoneRef.current = prox.zone
        setAudioZone(prox.zone)
      }
      if (prox.zone === 'found') {
        setGameState('found')
      }
    } else if (target && gameStateRef.current === 'found') {
      const prox = computeProximity(target.value, stateRef.current, cssWidthRef.current)
      renderTarget = {
        value: target.value,
        emoji: target.emoji,
        opacity: Math.max(prox.opacity, 0.9),
      }
    }
    renderTargetRef.current = renderTarget
  }, [stateRef, cssWidthRef])

  // Game loop: continuous redraw while game is active
  useEffect(() => {
    if (gameState !== 'active') {
      if (gameRafRef.current) {
        cancelAnimationFrame(gameRafRef.current)
        gameRafRef.current = 0
      }
      return
    }
    const tick = () => {
      drawRef.current()
      gameRafRef.current = requestAnimationFrame(tick)
    }
    gameRafRef.current = requestAnimationFrame(tick)
    return () => {
      if (gameRafRef.current) {
        cancelAnimationFrame(gameRafRef.current)
        gameRafRef.current = 0
      }
    }
    // drawRef is stable (a ref), gameState triggers the effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState])

  const handleGameStart = useCallback(
    (target: number, emoji: string) => {
      targetRef.current = { value: target, emoji }
      prevGameZoneRef.current = null
      proximityRef.current = null
      setAudioZone(null)
      setGameState('active')
      setActiveGameId('find_number')
      drawRef.current()
    },
    [drawRef, setActiveGameId]
  )

  const handleGameGiveUp = useCallback(() => {
    targetRef.current = null
    prevGameZoneRef.current = null
    proximityRef.current = null
    renderTargetRef.current = undefined
    setAudioZone(null)
    setGameState('idle')
    setActiveGameId(null)
    drawRef.current()
  }, [drawRef, setActiveGameId])

  // Wire forward refs for voice-model-initiated games
  startFindNumberFnRef.current = (target: number) => {
    const emoji = GAME_EMOJIS[Math.floor(Math.random() * GAME_EMOJIS.length)]
    gameStartedByModelRef.current = true
    setGameStartedByModel(true)
    handleGameStart(target, emoji)
  }
  stopFindNumberFnRef.current = () => {
    gameStartedByModelRef.current = false
    setGameStartedByModel(false)
    handleGameGiveUp()
  }

  // Push game lifecycle events to the voice model
  const prevGameStateForVoiceRef = useRef<FindTheNumberGameState>('idle')
  useEffect(() => {
    const prev = prevGameStateForVoiceRef.current
    prevGameStateForVoiceRef.current = gameState
    if (voiceState !== 'active') return
    if (gameState === 'active' && prev !== 'active' && !gameStartedByModelRef.current) {
      const target = targetRef.current?.value
      if (target !== undefined) {
        sendSystemMessage(
          `[Game update: The child started a find-the-number game! Target: ${target}. Give verbal hints about the number's neighborhood and properties. Say "higher numbers"/"lower numbers" for direction — NEVER "left"/"right". Instead of "zoom in", hint at precision: "it has a decimal", "between 3 and 4". You will receive proximity updates.]`
        )
      }
    }
    if (gameState === 'idle' && prev !== 'idle' && !gameStartedByModelRef.current) {
      sendSystemMessage('[Game update: The child ended the find-the-number game.]')
    }
    if (gameState === 'idle') {
      gameStartedByModelRef.current = false
      setGameStartedByModel(false)
    }
  }, [gameState, voiceState, sendSystemMessage])

  // Push proximity zone updates to the voice model
  const prevAudioZoneForVoiceRef = useRef<ProximityZone | null>(null)
  useEffect(() => {
    const prev = prevAudioZoneForVoiceRef.current
    prevAudioZoneForVoiceRef.current = audioZone
    if (voiceState !== 'active' || audioZone === null) return
    if (audioZone === prev) return
    const target = targetRef.current?.value
    if (target === undefined) return
    if (audioZone === 'found') {
      sendSystemMessage('[Game update: The child found the number! Celebrate with them!]', true)
    } else {
      const prox = proximityRef.current
      const { center, pixelsPerUnit } = stateRef.current
      const halfRange = cssWidthRef.current / (2 * pixelsPerUnit)
      const viewLeft = center - halfRange
      const viewRight = center + halfRange

      const dir = prox?.targetDirection
      const dirHint =
        dir === 'left'
          ? "The target is at a LOWER number than what's on screen — the child needs to move toward smaller numbers (scroll left)."
          : dir === 'right'
            ? "The target is at a HIGHER number than what's on screen — the child needs to move toward bigger numbers (scroll right)."
            : 'The target is somewhere on screen right now.'

      const dist = Math.abs(target - center)
      const distHint =
        dist > 100
          ? `About ${Math.round(dist)} away from where the child is looking.`
          : dist > 10
            ? `Roughly ${Math.round(dist)} units away.`
            : dist > 1
              ? `Only about ${Math.round(dist * 10) / 10} away — getting close!`
              : `Very close — less than 1 unit away!`

      let precisionHint = ''
      if (prox?.needsMoreZoom) {
        const precision = getTargetPrecisionForHint(target)
        if (precision >= 2) {
          precisionHint =
            ' The target has hundredths-level precision — the child needs to zoom in enough to see individual hundredths (like 3.14 vs 3.15).'
        } else if (precision === 1) {
          precisionHint =
            ' The target has a decimal digit — the child needs to zoom in enough to see tenths (like 2.3 vs 2.4).'
        } else {
          precisionHint = ' The child needs to zoom in a bit more to spot the exact number.'
        }
      }

      const viewHint = `The child is currently looking at numbers from about ${formatApprox(viewLeft)} to ${formatApprox(viewRight)}.`

      sendSystemMessage(
        `[Game update: zone=${audioZone}. ${viewHint} ${dirHint} ${distHint}${precisionHint}\n` +
          `IMPORTANT: Say "lower numbers" or "higher numbers" when giving direction hints, NOT "left" or "right" — children often confuse screen directions. ` +
          `Instead of telling the child to "zoom in", give them useful hints about the number's neighborhood — for example, "it's between 30 and 40" or "think about multiples of 5". ` +
          `Let their curiosity guide them!]`
      )
    }
  }, [audioZone, voiceState, sendSystemMessage, stateRef, cssWidthRef])

  // Audio feedback (muted during active voice calls)
  useFindTheNumberAudio(audioZone, proximityRef, voiceState === 'active')

  return {
    gameState,
    renderTargetRef,
    proximityRef,
    handleGameStart,
    handleGameGiveUp,
    computeGameProximity,
    gameStartedByModel,
    labelScaleRef,
    labelMinOpacityRef,
    gameRafRef,
  }
}
