/**
 * Speech synthesis utilities for Know Your World hints
 *
 * Provides cross-browser voice selection with intelligent fallbacks
 * for regions/countries that may not have native TTS support.
 */

export interface VoiceMatch {
  voice: SpeechSynthesisVoice
  quality: 'exact' | 'language' | 'fallback' | 'default'
}

/**
 * Fallback chains for languages with limited TTS support.
 * Maps base language code to ordered list of fallback languages.
 */
const LANGUAGE_FALLBACKS: Record<string, string[]> = {
  // Balkan languages
  sq: ['it', 'el', 'en'], // Albanian → Italian, Greek
  mk: ['bg', 'sr', 'en'], // Macedonian → Bulgarian, Serbian
  sl: ['hr', 'de', 'en'], // Slovenian → Croatian, German
  sr: ['hr', 'ru', 'en'], // Serbian → Croatian, Russian
  hr: ['sl', 'sr', 'en'], // Croatian → Slovenian, Serbian
  bs: ['hr', 'sr', 'en'], // Bosnian → Croatian, Serbian
  me: ['sr', 'hr', 'en'], // Montenegrin → Serbian, Croatian

  // Baltic languages
  et: ['fi', 'ru', 'en'], // Estonian → Finnish, Russian
  lv: ['lt', 'ru', 'en'], // Latvian → Lithuanian, Russian
  lt: ['lv', 'pl', 'en'], // Lithuanian → Latvian, Polish

  // Nordic languages
  is: ['da', 'no', 'en'], // Icelandic → Danish, Norwegian
  fo: ['da', 'no', 'en'], // Faroese → Danish, Norwegian

  // Eastern European
  uk: ['ru', 'pl', 'en'], // Ukrainian → Russian, Polish
  be: ['ru', 'pl', 'en'], // Belarusian → Russian, Polish
  bg: ['ru', 'sr', 'en'], // Bulgarian → Russian, Serbian
  ro: ['it', 'fr', 'en'], // Romanian → Italian, French
  md: ['ro', 'ru', 'en'], // Moldovan → Romanian, Russian

  // Central European
  hu: ['de', 'en'], // Hungarian → German
  sk: ['cs', 'pl', 'en'], // Slovak → Czech, Polish
  cs: ['sk', 'pl', 'en'], // Czech → Slovak, Polish

  // Mediterranean
  mt: ['it', 'en'], // Maltese → Italian
  el: ['en'], // Greek → English
  ca: ['es', 'fr', 'en'], // Catalan → Spanish, French

  // Celtic
  ga: ['en'], // Irish → English
  cy: ['en'], // Welsh → English
  gd: ['en'], // Scottish Gaelic → English

  // African languages
  sw: ['en'], // Swahili → English
  am: ['ar', 'en'], // Amharic → Arabic
  zu: ['en'], // Zulu → English
  xh: ['en'], // Xhosa → English
  st: ['en'], // Sotho → English
  tn: ['en'], // Tswana → English
  rw: ['fr', 'en'], // Kinyarwanda → French
  rn: ['fr', 'en'], // Kirundi → French
  mg: ['fr', 'en'], // Malagasy → French
  so: ['ar', 'en'], // Somali → Arabic
  ha: ['en'], // Hausa → English
  yo: ['en'], // Yoruba → English
  ig: ['en'], // Igbo → English

  // Afrikaans (Dutch-based)
  af: ['nl', 'en'], // Afrikaans → Dutch
}

/**
 * Score a voice based on quality indicators.
 * Higher scores indicate better quality voices.
 */
function scoreVoice(voice: SpeechSynthesisVoice): number {
  let score = 0
  const name = voice.name.toLowerCase()

  // Quality indicators by vendor/type (cross-browser)
  if (name.includes('google')) score += 100 // Chrome cloud voices
  if (name.includes('microsoft')) score += 90 // Edge/Windows
  if (name.includes('siri')) score += 90 // iOS
  if (name.includes('samantha')) score += 85 // macOS default
  if (name.includes('alex')) score += 85 // macOS
  if (name.includes('premium')) score += 80 // Various premium
  if (name.includes('enhanced')) score += 70 // Enhanced versions
  if (name.includes('natural')) score += 70 // Natural sounding
  if (name.includes('neural')) score += 75 // Neural TTS
  if (name.includes('wavenet')) score += 80 // Google WaveNet

  // Cloud voices usually have better quality
  if (!voice.localService) score += 30

  // Penalize robotic/low-quality voices
  if (name.includes('espeak')) score -= 50
  if (name.includes('festival')) score -= 50
  if (name.includes('mbrola')) score -= 40

  return score
}

/**
 * Find the best voice for a specific language code.
 * Returns null if no voices match the language.
 */
function findVoiceForLanguage(
  voices: SpeechSynthesisVoice[],
  langCode: string
): SpeechSynthesisVoice | null {
  const baseLang = langCode.split('-')[0].toLowerCase()

  // Find all voices matching this language
  const matches = voices.filter((v) => {
    const voiceBase = v.lang.split('-')[0].toLowerCase()
    return voiceBase === baseLang
  })

  if (matches.length === 0) return null

  // Sort by quality score (highest first)
  matches.sort((a, b) => scoreVoice(b) - scoreVoice(a))

  // Among top scorers, prefer exact locale match
  const exactMatch = matches.find((v) => v.lang.toLowerCase() === langCode.toLowerCase())

  return exactMatch || matches[0]
}

/**
 * Select the best voice for a target language with fallbacks.
 * Returns the voice and a quality indicator.
 */
export function selectVoice(voices: SpeechSynthesisVoice[], targetLang: string): VoiceMatch | null {
  if (voices.length === 0) return null

  const baseLang = targetLang.split('-')[0].toLowerCase()

  // 1. Try exact/base language match
  const directMatch = findVoiceForLanguage(voices, targetLang)
  if (directMatch) {
    const isExact = directMatch.lang.toLowerCase() === targetLang.toLowerCase()
    return {
      voice: directMatch,
      quality: isExact ? 'exact' : 'language',
    }
  }

  // 2. Try fallback chain for this language
  const fallbacks = LANGUAGE_FALLBACKS[baseLang] || ['en']
  for (const fallbackLang of fallbacks) {
    const fallbackVoice = findVoiceForLanguage(voices, fallbackLang)
    if (fallbackVoice) {
      return { voice: fallbackVoice, quality: 'fallback' }
    }
  }

  // 3. Last resort: any English voice
  const anyEnglish = findVoiceForLanguage(voices, 'en-US')
  if (anyEnglish) {
    return { voice: anyEnglish, quality: 'default' }
  }

  // 4. Absolute last resort: best available voice
  const sorted = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))
  return { voice: sorted[0], quality: 'default' }
}

/**
 * Get detailed voice selection info for a language.
 * Returns the voice, language match quality, and voice synthesis quality score.
 */
export interface VoiceSelectionInfo {
  voice: SpeechSynthesisVoice | null
  matchQuality: VoiceMatch['quality'] | null
  voiceScore: number // Higher = better quality voice (Google, Microsoft, etc.)
  isGoodQuality: boolean // True if voice score is above threshold
}

// Minimum voice score to consider "good quality" for accent feature
// Score breakdown: Google=100, Microsoft=90, Siri=90, premium=80, neural=75, etc.
// A score of 75+ means we have a good quality voice
const MINIMUM_VOICE_QUALITY_SCORE = 75

/**
 * Get voice selection info for a target language.
 * This checks both the language match AND the voice synthesis quality.
 */
export function getVoiceSelectionInfo(
  voices: SpeechSynthesisVoice[],
  targetLang: string
): VoiceSelectionInfo {
  const match = selectVoice(voices, targetLang)

  if (!match) {
    return {
      voice: null,
      matchQuality: null,
      voiceScore: 0,
      isGoodQuality: false,
    }
  }

  const voiceScore = scoreVoice(match.voice)

  return {
    voice: match.voice,
    matchQuality: match.quality,
    voiceScore,
    isGoodQuality: voiceScore >= MINIMUM_VOICE_QUALITY_SCORE,
  }
}

/**
 * Check if the accent option should be shown for a region's language.
 * Returns true only if:
 * 1. The region's locale differs from the user's locale (e.g., en-GB vs en-US)
 * 2. We have a voice that matches the language (not a fallback)
 * 3. The voice quality is good enough (not espeak/low-quality)
 */
export function shouldShowAccentOption(
  voices: SpeechSynthesisVoice[],
  regionLang: string,
  userLang: string
): boolean {
  // First check: locales must differ (including same-language variants like en-GB vs en-US)
  if (regionLang.toLowerCase() === userLang.toLowerCase()) {
    return false
  }

  // Second check: get voice info for region language
  const info = getVoiceSelectionInfo(voices, regionLang)

  // Only show accent if we have a good language match AND good voice quality
  const hasGoodLanguageMatch = info.matchQuality === 'exact' || info.matchQuality === 'language'

  return hasGoodLanguageMatch && info.isGoodQuality
}

/**
 * Region to language mapping for each map.
 * Maps region IDs to BCP 47 language tags.
 */
export const REGION_LANGUAGES: Record<string, Record<string, string>> = {
  usa: {
    // All US states use American English
    _default: 'en-US',
  },

  europe: {
    al: 'sq-AL', // Albania → Albanian
    ad: 'ca-ES', // Andorra → Catalan
    at: 'de-AT', // Austria → German (Austrian)
    by: 'ru-RU', // Belarus → Russian
    be: 'nl-BE', // Belgium → Dutch (Flemish)
    ba: 'hr-HR', // Bosnia → Croatian
    bg: 'bg-BG', // Bulgaria → Bulgarian
    hr: 'hr-HR', // Croatia → Croatian
    cy: 'el-GR', // Cyprus → Greek
    cz: 'cs-CZ', // Czechia → Czech
    dk: 'da-DK', // Denmark → Danish
    ee: 'et-EE', // Estonia → Estonian
    fi: 'fi-FI', // Finland → Finnish
    fr: 'fr-FR', // France → French
    de: 'de-DE', // Germany → German
    gr: 'el-GR', // Greece → Greek
    hu: 'hu-HU', // Hungary → Hungarian
    is: 'is-IS', // Iceland → Icelandic
    ie: 'en-IE', // Ireland → Irish English
    it: 'it-IT', // Italy → Italian
    xk: 'sq-AL', // Kosovo → Albanian
    lv: 'lv-LV', // Latvia → Latvian
    li: 'de-DE', // Liechtenstein → German
    lt: 'lt-LT', // Lithuania → Lithuanian
    lu: 'fr-FR', // Luxembourg → French
    mt: 'mt-MT', // Malta → Maltese
    md: 'ro-RO', // Moldova → Romanian
    mc: 'fr-FR', // Monaco → French
    me: 'sr-RS', // Montenegro → Serbian
    nl: 'nl-NL', // Netherlands → Dutch
    mk: 'mk-MK', // North Macedonia → Macedonian
    no: 'nb-NO', // Norway → Norwegian Bokmål
    pl: 'pl-PL', // Poland → Polish
    pt: 'pt-PT', // Portugal → Portuguese
    ro: 'ro-RO', // Romania → Romanian
    ru: 'ru-RU', // Russia → Russian
    sm: 'it-IT', // San Marino → Italian
    rs: 'sr-RS', // Serbia → Serbian
    sk: 'sk-SK', // Slovakia → Slovak
    si: 'sl-SI', // Slovenia → Slovenian
    es: 'es-ES', // Spain → Spanish
    se: 'sv-SE', // Sweden → Swedish
    ch: 'de-CH', // Switzerland → German
    ua: 'uk-UA', // Ukraine → Ukrainian
    gb: 'en-GB', // UK → British English
    va: 'it-IT', // Vatican → Italian
  },

  africa: {
    dz: 'ar-DZ', // Algeria → Arabic
    ao: 'pt-PT', // Angola → Portuguese
    bj: 'fr-FR', // Benin → French
    bw: 'en-ZA', // Botswana → English (SA)
    bf: 'fr-FR', // Burkina Faso → French
    bi: 'fr-FR', // Burundi → French
    cm: 'fr-FR', // Cameroon → French
    cv: 'pt-PT', // Cape Verde → Portuguese
    cf: 'fr-FR', // Central African Rep → French
    td: 'fr-FR', // Chad → French
    km: 'ar-SA', // Comoros → Arabic
    cg: 'fr-FR', // Congo → French
    cd: 'fr-FR', // DR Congo → French
    dj: 'fr-FR', // Djibouti → French
    eg: 'ar-EG', // Egypt → Arabic (Egyptian)
    gq: 'es-ES', // Equatorial Guinea → Spanish
    er: 'ar-SA', // Eritrea → Arabic
    sz: 'en-ZA', // Eswatini → English (SA)
    et: 'am-ET', // Ethiopia → Amharic
    ga: 'fr-FR', // Gabon → French
    gm: 'en-GB', // Gambia → English
    gh: 'en-GB', // Ghana → English
    gn: 'fr-FR', // Guinea → French
    gw: 'pt-PT', // Guinea-Bissau → Portuguese
    ci: 'fr-FR', // Ivory Coast → French
    ke: 'en-GB', // Kenya → English
    ls: 'en-ZA', // Lesotho → English (SA)
    lr: 'en-US', // Liberia → English (US)
    ly: 'ar-LY', // Libya → Arabic
    mg: 'fr-FR', // Madagascar → French
    mw: 'en-GB', // Malawi → English
    ml: 'fr-FR', // Mali → French
    mr: 'ar-SA', // Mauritania → Arabic
    mu: 'en-GB', // Mauritius → English
    ma: 'ar-MA', // Morocco → Arabic
    mz: 'pt-PT', // Mozambique → Portuguese
    na: 'en-ZA', // Namibia → English (SA)
    ne: 'fr-FR', // Niger → French
    ng: 'en-GB', // Nigeria → English
    rw: 'fr-FR', // Rwanda → French
    st: 'pt-PT', // São Tomé → Portuguese
    sn: 'fr-FR', // Senegal → French
    sc: 'en-GB', // Seychelles → English
    sl: 'en-GB', // Sierra Leone → English
    so: 'so-SO', // Somalia → Somali
    za: 'en-ZA', // South Africa → English (SA)
    ss: 'en-GB', // South Sudan → English
    sd: 'ar-SD', // Sudan → Arabic
    tz: 'sw-TZ', // Tanzania → Swahili
    tg: 'fr-FR', // Togo → French
    tn: 'ar-TN', // Tunisia → Arabic
    ug: 'en-GB', // Uganda → English
    zm: 'en-GB', // Zambia → English
    zw: 'en-GB', // Zimbabwe → English
  },

  world: {
    // World map countries - add as needed
    _default: 'en-US',
  },
}

/**
 * Get the language code for a region on a specific map.
 * Falls back to checking other maps if the region isn't defined in the specified map.
 */
export function getLanguageForRegion(map: string, regionId: string): string {
  // First try the specified map
  const mapLangs = REGION_LANGUAGES[map]
  if (mapLangs && mapLangs[regionId]) {
    return mapLangs[regionId]
  }

  // Fall back to checking other maps (useful for world map which doesn't define all countries)
  for (const otherMap of Object.values(REGION_LANGUAGES)) {
    if (otherMap[regionId]) {
      return otherMap[regionId]
    }
  }

  // Last resort: use map default or global default
  return mapLangs?._default || 'en-US'
}

/**
 * Speak text using the best available voice for the given language.
 * Returns a promise that resolves when speech is complete or rejects on error.
 */
export function speakText(
  text: string,
  targetLang: string,
  options?: {
    rate?: number
    pitch?: number
    volume?: number
    onStart?: () => void
    onEnd?: () => void
    onError?: (error: SpeechSynthesisErrorEvent) => void
  }
): { cancel: () => void } {
  const voices = speechSynthesis.getVoices()
  const match = selectVoice(voices, targetLang)

  const utterance = new SpeechSynthesisUtterance(text)

  if (match) {
    utterance.voice = match.voice
    utterance.lang = match.voice.lang
  } else {
    utterance.lang = targetLang
  }

  // Apply options
  utterance.rate = options?.rate ?? 0.9 // Slightly slower for kids
  utterance.pitch = options?.pitch ?? 1.0
  utterance.volume = options?.volume ?? 1.0

  // Event handlers
  if (options?.onStart) {
    utterance.onstart = options.onStart
  }
  if (options?.onEnd) {
    utterance.onend = options.onEnd
  }
  if (options?.onError) {
    utterance.onerror = options.onError
  }

  // Cancel any ongoing speech and start new
  speechSynthesis.cancel()
  speechSynthesis.speak(utterance)

  return {
    cancel: () => speechSynthesis.cancel(),
  }
}
