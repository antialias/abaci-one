export interface PhiExploreSubject {
  id: string
  name: string
  prompt: string
}

export const PHI_EXPLORE_PROMPT_PREFIX =
  'Educational illustration clearly showing a golden ratio / Fibonacci spiral naturally appearing in the subject. ' +
  'The spiral must be prominent, centered, and opening clockwise from the interior. ' +
  'Clean composition, no text, no labels, no numbers. Square 1:1 format.'

/** Theme modifiers for phi explore images (simpler than constants — no metaphor/math split) */
export const PHI_EXPLORE_THEME_MODIFIERS = {
  light:
    'IMPORTANT: Use a clean white (#ffffff) background. Ensure all colors are vibrant and visible against the light background. Same subject and composition.',
  dark: 'IMPORTANT: Use a dark navy background (#1e1e28). Use bright, saturated colors with high contrast against the dark background. Same subject and composition.',
} as const

export const PHI_EXPLORE_SUBJECTS: PhiExploreSubject[] = [
  {
    id: 'nautilus',
    name: 'Nautilus Shell',
    prompt:
      'A cross-section of a nautilus shell revealing the chambered logarithmic spiral. Warm cream and amber tones with each chamber clearly delineated. The spiral fills the frame.',
  },
  {
    id: 'galaxy',
    name: 'Spiral Galaxy',
    prompt:
      'A face-on spiral galaxy with arms sweeping outward in a golden spiral pattern. Deep blues, purples, and white starlight against black space. The spiral arms are the dominant feature.',
  },
  {
    id: 'hurricane',
    name: 'Hurricane',
    prompt:
      'A satellite view of a hurricane with the eye at center and cloud bands spiraling outward following a golden spiral. White clouds against deep blue ocean.',
  },
  {
    id: 'romanesco',
    name: 'Romanesco Broccoli',
    prompt:
      'A romanesco broccoli/cauliflower viewed from above showing its fractal spiral cone pattern. Vibrant chartreuse green with each conical floret clearly visible spiraling from center.',
  },
  {
    id: 'sunflower',
    name: 'Sunflower Head',
    prompt:
      'A sunflower seed head viewed from directly above. Seeds arranged in intersecting Fibonacci spirals radiating from center. Golden yellow petals framing the brown seed pattern.',
  },
  {
    id: 'pinecone',
    name: 'Pinecone',
    prompt:
      'A pinecone viewed from its base looking up, showing the spiral arrangement of scales. Fibonacci spirals visible in both directions. Warm brown woody tones.',
  },
  {
    id: 'rams-horn',
    name: "Ram's Horn",
    prompt:
      'A side view of a bighorn sheep with its massive spiraling horn prominently featured. The horn curls in a golden spiral from base to tip. Natural earthy tones.',
  },
  {
    id: 'fiddlehead',
    name: 'Fern Fiddlehead',
    prompt:
      'An unfurling fern fiddlehead (crozier) tightly coiled in a golden spiral. Bright fresh green against a soft background. The spiral is tight and prominent.',
  },
  {
    id: 'wave',
    name: 'Ocean Wave',
    prompt:
      'A breaking ocean wave curling into a golden spiral barrel/tube shape. The wave lip curves inward following the spiral. Translucent blues and greens with white foam.',
  },
]
