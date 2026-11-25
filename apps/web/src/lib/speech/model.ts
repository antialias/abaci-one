/**
 * The one place abaci's speech model is chosen. Safe to import on the client
 * (no server dependencies) so the admin page can label voices with it.
 *
 * eleven_v3: the switch proxy's door serves it on /v1/text-to-speech, and it
 * reads bracketed audio tags ("[excited] Great job!"), so a clip's tone still
 * shapes its delivery the way gpt-4o-mini-tts's `instructions` did. The
 * cheaper flash/turbo models (half the credits) and multilingual_v2 ignore
 * tone entirely. Clips are generated once and cached on disk forever, so the
 * one-off cost of the better model is worth it.
 *
 * Change the model here and nothing else: tone tags are only sent when the
 * model is in SPEECH_MODELS_READING_AUDIO_TAGS, so a model that would read a
 * tag aloud never receives one.
 */
export const SPEECH_MODEL = 'eleven_v3'

/** Models the door serves that interpret `[tag]` as delivery, not words. */
export const SPEECH_MODELS_READING_AUDIO_TAGS: ReadonlySet<string> = new Set([
  'eleven_v3',
  'eleven_v4',
])

/**
 * The door refuses a request whose text (with previous_text/next_text, which
 * we never send) is over 1000 characters. We refuse locally first rather than
 * split: every clip today is far shorter (longest collected clip: 705), and a
 * clip spliced from separately generated halves would sound stitched.
 */
export const MAX_SPEECH_CHARS = 1000

/** mp3, the format every voice folder already holds. */
export const SPEECH_OUTPUT_FORMAT = 'mp3_44100_128'
