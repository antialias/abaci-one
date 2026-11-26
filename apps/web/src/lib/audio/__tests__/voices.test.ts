import { describe, expect, it } from 'vitest'
import { CustomVoice, PregeneratedVoice } from '../voiceSource'
import {
  elevenLabsVoiceFolder,
  elevenLabsVoiceIdOf,
  generationRefusal,
  getVoiceMeta,
  isElevenLabsVoice,
  isReservedVoiceName,
  isSafeVoiceFolder,
  RETIRED_OPENAI_VOICES,
} from '../voices'

describe('voice folders', () => {
  it('names an ElevenLabs voice el-{id} and reads the id back', () => {
    expect(elevenLabsVoiceFolder('21m00Tcm4TlvDq8ikWAM')).toBe('el-21m00Tcm4TlvDq8ikWAM')
    expect(elevenLabsVoiceIdOf('el-21m00Tcm4TlvDq8ikWAM')).toBe('21m00Tcm4TlvDq8ikWAM')
  })

  it('never builds a folder that could leave data/audio', () => {
    for (const bad of ['', '../x', 'a/b', 'a.b', 'a b']) {
      expect(() => elevenLabsVoiceFolder(bad)).toThrow()
    }
    expect(elevenLabsVoiceIdOf('el-..')).toBeNull()
    expect(isSafeVoiceFolder('el-abc')).toBe(true)
    expect(isSafeVoiceFolder('Thomas Hallock')).toBe(true)
    for (const bad of ['', '.', '..', 'a/b', 'a\\b', 'a\0b'])
      expect(isSafeVoiceFolder(bad)).toBe(false)
  })

  it('keeps retired OpenAI folders distinct from ElevenLabs ones', () => {
    for (const v of RETIRED_OPENAI_VOICES) {
      expect(isElevenLabsVoice(v)).toBe(false)
      expect(generationRefusal(v)).toMatch(/retired OpenAI voice/)
      expect(getVoiceMeta(v)).toMatchObject({ provider: 'OpenAI', retired: true })
    }
    expect(generationRefusal('el-abc123')).toBeNull()
    expect(getVoiceMeta('el-abc123')).toMatchObject({ provider: 'ElevenLabs', retired: false })
    expect(getVoiceMeta('Thomas Hallock')).toBeNull()
  })

  it('reserves generated folder names from custom voices', () => {
    expect(isReservedVoiceName('onyx')).toBe(true)
    expect(isReservedVoiceName('ONYX')).toBe(true)
    expect(isReservedVoiceName('el-anything')).toBe(true)
    expect(isReservedVoiceName('EL-anything')).toBe(true)
    expect(isReservedVoiceName('Thomas Hallock')).toBe(false)
  })
})

describe('canGenerate()', () => {
  it('is true only for ElevenLabs voices', () => {
    expect(new PregeneratedVoice('el-21m00Tcm4TlvDq8ikWAM').canGenerate()).toBe(true)
  })

  it.each(['onyx', 'nova', 'ash', 'ballad', 'sage', 'echo', 'songs'])(
    'is false for pregenerated %s, which still plays',
    (name) => {
      expect(new PregeneratedVoice(name).canGenerate()).toBe(false)
    }
  )

  it('is false for custom voices', () => {
    expect(new CustomVoice('Thomas Hallock').canGenerate()).toBe(false)
  })
})
