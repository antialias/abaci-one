#!/usr/bin/env npx tsx
/**
 * Labelled eval for the flowchart embedding model and its thresholds.
 *
 *   npx tsx scripts/eval-embedding-models.ts [--cache <dir>]
 *
 * Embeds a fixed corpus of flowcharts the way the app does (buildEmbeddingContent
 * plus the topic as the prompt embedding, score = max of the two) and runs
 * labelled queries against it: true matches, synonyms (borrowing / regrouping /
 * carrying) and queries with no matching flowchart. For each candidate model it
 * prints, per query, the top hit and its score, then the numbers each threshold in
 * the app is set from:
 *   - suggest / profile search: the cut that best separates true matches from
 *     no-match and wrong-flowchart scores
 *   - related: related vs unrelated flowchart pairs
 *   - browse label cut (page.tsx `maxDist > 0.75`): flowchart → right taxonomy
 *     label distances vs → wrong label
 *   - DIVERSITY_THRESHOLD: mean pairwise distance of a tight cluster vs a mixed one
 *
 * This is a dev tool: unlike the app, it may download models (into --cache,
 * default /tmp/embedding-eval-cache). The corpus is the built-in flowcharts plus
 * teacher-style ones like those in the dev DB; prod had no published teacher
 * flowcharts when this was written (2026-11-25).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildEmbeddingContent } from '../src/lib/flowcharts/embedding'
import { searchProfiles } from '../src/lib/seed/embedding-search'

interface Fc {
  id: string
  title: string
  description: string
  difficulty?: string
  topic?: string
  /** Taxonomy labels a person would file this under. */
  labels: string[]
}

const CORPUS: Fc[] = [
  // Built-in flowcharts (src/lib/flowcharts/definitions/index.ts)
  {
    id: 'subtraction-regrouping',
    title: 'Subtraction with Regrouping',
    description: 'Learn when and how to borrow in subtraction',
    difficulty: 'Beginner',
    labels: ['Basic Operations'],
  },
  {
    id: 'fraction-add-sub',
    title: 'Fraction Addition & Subtraction',
    description: 'Add and subtract fractions with different denominators',
    difficulty: 'Intermediate',
    labels: ['Fractions'],
  },
  {
    id: 'linear-equations',
    title: 'Solving Linear Equations',
    description: 'Solve equations like 3x + 5 = 17',
    difficulty: 'Intermediate',
    labels: ['Linear Equations', 'Algebra'],
  },
  {
    id: 'sentence-type',
    title: 'Identify Sentence Types',
    description:
      'Learn to classify declarative, interrogative, imperative, and exclamatory sentences',
    difficulty: 'Beginner',
    labels: ['Sentence Structure', 'Grammar'],
  },
  {
    id: 'order-of-operations',
    title: 'Order of Operations (PEMDAS)',
    description: 'Learn to solve expressions like 3 + 4 × 2 step by step',
    difficulty: 'Beginner',
    labels: ['Basic Operations'],
  },
  // Teacher flowcharts, as published in the dev DB
  {
    id: 'pascal',
    title: 'Pascal’s Triangle for Fun and Profit',
    description:
      'Students use Pascal’s Triangle (symmetry + “add the two above”) to find a triangle entry or a binomial coefficient.',
    difficulty: 'Intermediate',
    labels: ['Number Theory', 'Probability'],
  },
  {
    id: 'cramer',
    title: 'Using the Determinant (Cramer’s Rule) for 2×2 Systems',
    description:
      'Students learn to use determinants D, Dx, and Dy to solve a 2×2 system (or decide when there is no unique solution).',
    difficulty: 'Advanced',
    topic: 'using the determinate',
    labels: ['Systems of Equations', 'Matrices', 'Linear Algebra'],
  },
  {
    id: 'fraction-decimal',
    title: 'Turn a Fraction into a Decimal',
    description:
      'Students learn to convert a fraction to a decimal by reducing first, then either scaling the bottom to 10/100/1000 or using division to find decimal digits.',
    difficulty: 'Intermediate',
    topic: 'how to turn a fraction into a decimal number',
    labels: ['Decimals', 'Fractions'],
  },
  {
    id: 'drag',
    title: 'Induced vs Parasitic Drag',
    description:
      'Students compute induced and parasitic drag from flight conditions and decide which drag component dominates at a given speed.',
    difficulty: 'Intermediate',
    labels: ['Aerospace Engineering', 'Physics'],
  },
  {
    id: 'particles',
    title: 'Can Two Particles Be in the Exact Same Space and Time?',
    description:
      'Students decide (by model, particle type, and uncertainty) whether “same exact place and time” is allowed, and learn why quantum rules usually prevent perfect exactness.',
    difficulty: 'Advanced',
    topic: 'can the particles occupy the exact same space and time?',
    labels: ['Quantum Mechanics', 'Physics'],
  },
  // Teacher-style additions that make near misses possible
  {
    id: 'long-division',
    title: 'Long Division',
    description: 'Divide multi-digit numbers step by step: divide, multiply, subtract, bring down',
    difficulty: 'Intermediate',
    topic: 'long division with remainders',
    labels: ['Basic Operations'],
  },
  {
    id: 'addition-carrying',
    title: 'Addition with Carrying',
    description: 'Add multi-digit numbers, carrying to the next column when a column sums past 9',
    difficulty: 'Beginner',
    labels: ['Basic Operations'],
  },
]

/** expect: ids that count as a right answer; [] = nothing in the corpus matches. */
const QUERIES: { q: string; expect: string[] }[] = [
  { q: 'subtract with borrowing', expect: ['subtraction-regrouping'] },
  { q: 'borrowing when subtracting', expect: ['subtraction-regrouping'] },
  { q: 'regrouping in subtraction', expect: ['subtraction-regrouping'] },
  { q: '52 minus 27', expect: ['subtraction-regrouping'] },
  { q: 'carrying the one when adding', expect: ['addition-carrying'] },
  { q: 'adding big numbers column by column', expect: ['addition-carrying'] },
  { q: 'adding fractions', expect: ['fraction-add-sub'] },
  { q: 'fractions with unlike denominators', expect: ['fraction-add-sub'] },
  { q: 'common denominator', expect: ['fraction-add-sub'] },
  { q: 'fraction to decimal', expect: ['fraction-decimal'] },
  { q: 'how to solve for x', expect: ['linear-equations'] },
  { q: 'solve 2x+3=7', expect: ['linear-equations'] },
  { q: 'one-step and two-step equations', expect: ['linear-equations'] },
  { q: 'PEMDAS', expect: ['order-of-operations'] },
  { q: 'which operation comes first', expect: ['order-of-operations'] },
  { q: 'what kind of sentence is this', expect: ['sentence-type'] },
  { q: 'question or exclamation', expect: ['sentence-type'] },
  { q: 'binomial coefficients', expect: ['pascal'] },
  { q: 'solving two equations with determinants', expect: ['cramer'] },
  { q: 'long division', expect: ['long-division'] },
  { q: 'dividing with remainders', expect: ['long-division'] },
  { q: 'airplane drag', expect: ['drag'] },
  { q: 'Pauli exclusion principle', expect: ['particles'] },
  // The fraction-to-decimal flowchart is a fair answer to a bare "decimals"
  { q: 'decimals', expect: ['fraction-decimal'] },
  // No match in the corpus
  { q: 'multiplying decimals', expect: [] },
  { q: 'photosynthesis', expect: [] },
  { q: 'the french revolution', expect: [] },
  { q: 'area of a circle', expect: [] },
  { q: 'telling time on a clock', expect: [] },
  { q: 'spelling words with silent e', expect: [] },
  { q: 'percent of a number', expect: [] },
  { q: 'times tables', expect: [] },
]

const RELATED: [string, string][] = [
  ['fraction-add-sub', 'fraction-decimal'],
  ['subtraction-regrouping', 'addition-carrying'],
  ['subtraction-regrouping', 'long-division'],
  ['linear-equations', 'cramer'],
  ['drag', 'particles'],
]
const UNRELATED: [string, string][] = [
  ['sentence-type', 'linear-equations'],
  ['sentence-type', 'drag'],
  ['subtraction-regrouping', 'particles'],
  ['fraction-add-sub', 'drag'],
  ['pascal', 'sentence-type'],
  ['order-of-operations', 'particles'],
  ['long-division', 'sentence-type'],
]
const TIGHT_CLUSTERS = [
  ['subtraction-regrouping', 'addition-carrying', 'long-division'],
  ['fraction-add-sub', 'fraction-decimal'],
  ['linear-equations', 'cramer'],
  ['drag', 'particles'],
]
const MIXED_CLUSTERS = [
  ['sentence-type', 'drag', 'fraction-add-sub', 'particles'],
  ['sentence-type', 'linear-equations'],
  ['pascal', 'drag', 'subtraction-regrouping'],
]
/** The browse page drops a cluster label whose worst member is farther than this. */
const LABEL_CUT = 0.75

interface ModelConfig {
  name: string
  model: string
  pooling: 'mean' | 'cls'
  queryPrefix?: string
}

const CONFIGS: ModelConfig[] = [
  { name: 'MiniLM-L6 q8', model: 'Xenova/all-MiniLM-L6-v2', pooling: 'mean' },
  { name: 'bge-small q8', model: 'Xenova/bge-small-en-v1.5', pooling: 'cls' },
  {
    name: 'bge-small q8 +instr',
    model: 'Xenova/bge-small-en-v1.5',
    pooling: 'cls',
    queryPrefix: 'Represent this sentence for searching relevant passages: ',
  },
]

const cos = (a: Float32Array, b: Float32Array) => {
  let d = 0
  for (let i = 0; i < a.length; i++) d += a[i] * b[i]
  return d
}
const f2 = (n: number) => n.toFixed(2)

async function main() {
  const cacheFlag = process.argv.indexOf('--cache')
  const cacheDir = cacheFlag !== -1 ? process.argv[cacheFlag + 1] : '/tmp/embedding-eval-cache'
  const { env, pipeline } = await import('@huggingface/transformers')
  env.cacheDir = cacheDir
  env.allowRemoteModels = true

  const labels: string[] = JSON.parse(
    readFileSync(join(__dirname, '../src/lib/flowcharts/topic-taxonomy.json'), 'utf8')
  ).labels
  const byId = new Map(CORPUS.map((f, i) => [f.id, i]))

  for (const cfg of CONFIGS) {
    const fe = await pipeline('feature-extraction', cfg.model, { dtype: 'q8' })
    const embed = async (texts: string[]) => {
      const out: Float32Array[] = []
      for (let i = 0; i < texts.length; i += 8) {
        const t = await fe(texts.slice(i, i + 8), { pooling: cfg.pooling, normalize: true })
        const [rows, dims] = t.dims
        const data = t.data as Float32Array
        for (let r = 0; r < rows; r++) out.push(data.slice(r * dims, (r + 1) * dims))
      }
      return out
    }

    const content = await embed(CORPUS.map((f) => buildEmbeddingContent(f)))
    const prompts = await Promise.all(
      CORPUS.map(async (f) => (f.topic ? (await embed([f.topic]))[0] : null))
    )
    const qv = await embed(QUERIES.map((q) => (cfg.queryPrefix ?? '') + q.q))
    const lv = await embed(labels)

    console.log(`\n=== ${cfg.name} ===`)
    const trueScores: number[] = []
    const falseScores: number[] = [] // no-match top scores + wrong-flowchart top scores
    let top1 = 0
    let matchCount = 0
    const rows: { q: string; top: string; s: number; ok: boolean; expect: string[] }[] = []
    for (let qi = 0; qi < QUERIES.length; qi++) {
      const { q, expect } = QUERIES[qi]
      const scored = CORPUS.map((f, i) => {
        const c = cos(qv[qi], content[i])
        const p = prompts[i] ? cos(qv[qi], prompts[i]!) : 0
        return { id: f.id, s: Math.max(c, p) }
      }).sort((a, b) => b.s - a.s)
      if (expect.length) {
        matchCount++
        const right = scored.find((x) => expect.includes(x.id))!
        trueScores.push(right.s)
        if (expect.includes(scored[0].id)) top1++
        const wrong = scored.find((x) => !expect.includes(x.id))!
        falseScores.push(wrong.s)
      } else {
        falseScores.push(scored[0].s)
      }
      rows.push({
        q,
        top: scored[0].id,
        s: scored[0].s,
        ok: expect.length ? expect.includes(scored[0].id) : false,
        expect,
      })
    }
    for (const r of rows) {
      const tag = r.expect.length ? (r.ok ? 'hit ' : 'MISS') : 'none'
      console.log(`  ${tag} ${f2(r.s)}  ${r.q.padEnd(42)} → ${r.top}`)
    }

    // Threshold sweep: a match query is right if its top hit is right and clears t;
    // a no-match query is right if its top hit stays under t.
    let best = { t: 0, acc: -1 }
    const accAt = (t: number) => {
      let ok = 0
      for (const r of rows) {
        if (r.expect.length) ok += r.ok && r.s >= t ? 1 : 0
        else ok += r.s < t ? 1 : 0
      }
      return ok / rows.length
    }
    const bestTs: number[] = []
    for (let t = 0.2; t <= 0.9; t += 0.01) {
      const acc = accAt(t)
      if (acc > best.acc + 1e-9) {
        best = { t, acc }
        bestTs.length = 0
      }
      if (Math.abs(acc - best.acc) < 1e-9) bestTs.push(t)
    }
    const sortedTrue = [...trueScores].sort((a, b) => a - b)
    const sortedFalse = [...falseScores].sort((a, b) => b - a)
    // AUC: P(random true-match score > random false score)
    let wins = 0
    for (const a of trueScores) for (const b of falseScores) wins += a > b ? 1 : a === b ? 0.5 : 0
    const auc = wins / (trueScores.length * falseScores.length)

    const pairSim = (a: string, b: string) => cos(content[byId.get(a)!], content[byId.get(b)!])
    const rel = RELATED.map(([a, b]) => pairSim(a, b))
    const unrel = UNRELATED.map(([a, b]) => pairSim(a, b))
    const meanDist = (ids: string[]) => {
      let tot = 0
      let n = 0
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          tot += 1 - pairSim(ids[i], ids[j])
          n++
        }
      return tot / n
    }
    const rightLabelDist: number[] = []
    const nearestWrongDist: number[] = []
    const labelLines: string[] = []
    for (let i = 0; i < CORPUS.length; i++) {
      const d = labels.map((l, j) => ({ l, d: 1 - cos(content[i], lv[j]) }))
      const right = Math.min(...d.filter((x) => CORPUS[i].labels.includes(x.l)).map((x) => x.d))
      const wrong = Math.min(...d.filter((x) => !CORPUS[i].labels.includes(x.l)).map((x) => x.d))
      rightLabelDist.push(right)
      nearestWrongDist.push(wrong)
      const nearest = d.reduce((a, b) => (b.d < a.d ? b : a))
      const tag = CORPUS[i].labels.includes(nearest.l) ? 'right' : 'WRONG'
      labelLines.push(`    ${CORPUS[i].id.padEnd(24)} nearest ${tag} ${f2(nearest.d)} ${nearest.l}`)
    }
    const labelWins = rightLabelDist.filter((d, i) => d <= nearestWrongDist[i]).length

    console.log(`  top-1 on match queries: ${top1}/${matchCount}`)
    console.log(
      `  true-match score: min ${f2(sortedTrue[0])}, p25 ${f2(sortedTrue[Math.floor(sortedTrue.length / 4)])}`
    )
    console.log(
      `  false score (no-match top / best wrong flowchart): max ${f2(sortedFalse[0])}, p75 ${f2(sortedFalse[Math.floor(sortedFalse.length / 4)])}`
    )
    console.log(`  AUC true vs false: ${auc.toFixed(3)}`)
    console.log(
      `  best suggest threshold: ${f2(bestTs[0])}–${f2(bestTs[bestTs.length - 1])} → ${(best.acc * 100).toFixed(0)}% of queries decided right`
    )
    for (const t of [0.3, 0.4, 0.5, 0.6, 0.7])
      console.log(`    at ${t}: ${(accAt(t) * 100).toFixed(0)}%`)
    console.log(
      `  related pairs sim: ${rel.map(f2).join(' ')} (min ${f2(Math.min(...rel))}); unrelated: ${unrel.map(f2).join(' ')} (max ${f2(Math.max(...unrel))})`
    )
    console.log(
      `  right-label distance: max ${f2(Math.max(...rightLabelDist))}, median ${f2([...rightLabelDist].sort()[Math.floor(rightLabelDist.length / 2)])}; right label nearest for ${labelWins}/${CORPUS.length}`
    )
    for (const l of labelLines) console.log(l)
    console.log(
      `  right label within ${LABEL_CUT}: ${rightLabelDist.filter((d) => d <= LABEL_CUT).length}/${CORPUS.length}`
    )
    console.log(
      `  cluster mean distance: tight ${TIGHT_CLUSTERS.map((c) => f2(meanDist(c))).join(' ')}; mixed ${MIXED_CLUSTERS.map((c) => f2(meanDist(c))).join(' ')}`
    )
    await fe.dispose()
  }
}

/** Profile search (debug seeding) runs on the app's own model; no labels, just ranges. */
const PROFILE_QUERIES = {
  onTopic: [
    'student struggling with five complements',
    'a kid who is ready for linear practice',
    'brand new student with no history',
    'student who answers slowly',
    'student with mixed mastery',
  ],
  offTopic: ['photosynthesis', 'the french revolution', 'pizza toppings'],
}

async function profileRanges() {
  console.log('\n=== profile search (app model) ===')
  for (const [kind, qs] of Object.entries(PROFILE_QUERIES)) {
    for (const q of qs) {
      const r = await searchProfiles(q, { minSimilarity: -1, limit: 3 })
      console.log(`  ${kind.padEnd(8)} ${q.padEnd(42)} ${r.map((x) => f2(x.similarity)).join(' ')}`)
    }
  }
}

main()
  .then(profileRanges)
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
