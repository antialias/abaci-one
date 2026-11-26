import { describe, expect, it } from 'vitest'
import { audioTagForTone, speechTextFor, TONE_AUDIO_TAGS } from '../toneDirections'

describe('audioTagForTone', () => {
  it('maps every registered tone', () => {
    expect(audioTagForTone('celebration')).toBe('[excited]')
    expect(audioTagForTone('tutorial-celebration')).toBe('[excited]')
    expect(audioTagForTone('math-dictation')).toBeNull()
    expect(Object.keys(TONE_AUDIO_TAGS)).toHaveLength(6)
  })

  it.each([
    ['Conspiratorial whisper, building to warm genuine encouragement.', '[whispers]'],
    ['Mischievous and amazed. Like revealing a magic trick.', '[mischievously]'],
    ['Excited game-show energy building to wonder.', '[excited]'],
    ['Warmly congratulating a child on completing a geometric proof.', '[excited]'],
    ['You are a warm, curious guide helping a really smart 5-year-old.', '[curious]'],
    ['Gently encouraging a young child learning to type.', null],
    ['Cozy storyteller.', null],
    ['', null],
  ])('%j -> %s', (tone, tag) => {
    expect(audioTagForTone(tone)).toBe(tag)
  })

  it('does not treat object prototype names as tones', () => {
    expect(audioTagForTone('constructor')).toBeNull()
  })
})

describe('speechTextFor', () => {
  it('drops tone entirely for a model that would read a tag aloud', () => {
    expect(speechTextFor('Press [Enter]', 'celebration', 'eleven_flash_v2_5')).toEqual({
      text: 'Press [Enter]',
      tag: null,
    })
  })

  it('tags and sanitizes for eleven_v3', () => {
    expect(speechTextFor('Press [Enter]', 'celebration', 'eleven_v3')).toEqual({
      text: '[excited] Press (Enter)',
      tag: '[excited]',
    })
  })
})
