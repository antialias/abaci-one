/**
 * Backtest the session-song writer against real past sessions: lyrics only, no music.
 *
 * For each student it takes their last N sessions that have a saved prompt input,
 * oldest first, and writes a song for each with today's prompt. History starts as
 * the student's real songs from before the window; every backtest song then joins
 * it, the way songs would pile up in prod. The database is only read.
 *
 *   DATABASE_URL=http://127.0.0.1:18080 \
 *   LLM_DEFAULT_PROVIDER=claude_code LLM_CLAUDE_CODE_DEFAULT_MODEL=claude-abaci \
 *   LLM_CLAUDE_CODE_BASE_URL=... LLM_CLAUDE_CODE_API_KEY=... \
 *   npx tsx scripts/backtest-session-songs.ts --players <id>,<id> --sessions 15 --out /tmp/backtest.json
 *
 * Players run in parallel; each player's sessions run in order.
 */

import { writeFileSync } from 'node:fs'
import { and, desc, eq, isNotNull, lt } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { RecentSongSummary, SongPromptInput } from '@/lib/session-song/extract-session-stats'
import { generateSongPrompt, summarizeRecentSongs } from '@/lib/session-song/prompt-generator'

function arg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = index >= 0 ? process.argv[index + 1] : fallback
  if (value == null) throw new Error(`--${name} is required`)
  return value
}

const playerIds = arg('players').split(',').filter(Boolean)
const sessionCount = Number(arg('sessions', '15'))
const outPath = arg('out')

const allResults: BacktestSong[] = []

interface BacktestSong {
  player: string
  sessionPlanId: string
  sessionDate: string
  prodTitle: string | null
  title: string | null
  styles: string[]
  sections: Array<{ name: string; lines: string[] }>
  validationIssues: string[]
  model: string | null
  seconds: number
  error?: string
}

async function playerGenre(playerId: string): Promise<string> {
  const [row] = await db
    .select({ config: schema.playerSessionPreferences.config })
    .from(schema.playerSessionPreferences)
    .where(eq(schema.playerSessionPreferences.playerId, playerId))
    .limit(1)
  const config = row ? (JSON.parse(row.config) as { sessionSongGenre?: string }) : null
  return config?.sessionSongGenre ?? 'shuffle'
}

async function backtestPlayer(playerId: string): Promise<BacktestSong[]> {
  const [player] = await db
    .select({ name: schema.players.name })
    .from(schema.players)
    .where(eq(schema.players.id, playerId))
  const genre = await playerGenre(playerId)

  const rows = await db
    .select()
    .from(schema.sessionSongs)
    .where(
      and(eq(schema.sessionSongs.playerId, playerId), isNotNull(schema.sessionSongs.promptInput))
    )
    .orderBy(desc(schema.sessionSongs.createdAt))
    .limit(sessionCount * 2)
  const seen = new Set<string>()
  const sessions = rows
    .filter((row) => !seen.has(row.sessionPlanId) && seen.add(row.sessionPlanId))
    .slice(0, sessionCount)
    .reverse()
  if (sessions.length === 0) return []

  const earlier = await db
    .select({ llmOutput: schema.sessionSongs.llmOutput })
    .from(schema.sessionSongs)
    .where(
      and(
        eq(schema.sessionSongs.playerId, playerId),
        eq(schema.sessionSongs.status, 'completed'),
        lt(schema.sessionSongs.createdAt, sessions[0].createdAt)
      )
    )
    .orderBy(desc(schema.sessionSongs.createdAt))
    .limit(10)
  let history: RecentSongSummary[] = summarizeRecentSongs(earlier.map((row) => row.llmOutput))

  const results: BacktestSong[] = []
  for (const session of sessions) {
    const { songConcept: _oldConcept, ...stored } = session.promptInput as Record<string, unknown>
    const input = { ...stored, recentSongs: history.slice(0, 10) } as unknown as SongPromptInput
    const started = Date.now()
    const base = {
      player: player?.name ?? playerId,
      sessionPlanId: session.sessionPlanId,
      sessionDate: session.createdAt.toISOString().slice(0, 10),
      prodTitle: (session.llmOutput as { title?: string } | null)?.title ?? null,
    }
    try {
      const output = await generateSongPrompt(input, genre, undefined, {
        validationPolicy: {
          mode: 'observe',
          maxRepairAttempts: 0,
          fallbackOnFailedRepair: false,
          logPassingPlans: false,
        },
      })
      record({
        ...base,
        title: output.title,
        styles: output.plan.positive_global_styles,
        sections: output.plan.sections.map((section) => ({
          name: section.section_name,
          lines: section.lines,
        })),
        validationIssues: output.validation?.issues.map((issue) => issue.code) ?? [],
        model: `${output.llmMeta.provider}/${output.llmMeta.model}`,
        seconds: Math.round((Date.now() - started) / 1000),
      })
      history = [...summarizeRecentSongs([{ title: output.title, plan: output.plan }]), ...history]
      console.log(`${base.player} ${base.sessionDate}: ${output.title}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      record({
        ...base,
        title: null,
        styles: [],
        sections: [],
        validationIssues: [],
        model: null,
        seconds: Math.round((Date.now() - started) / 1000),
        error: message.slice(0, 300),
      })
      console.log(`${base.player} ${base.sessionDate}: FAILED ${message.slice(0, 120)}`)
    }
  }
  return results

  function record(song: BacktestSong) {
    results.push(song)
    allResults.push(song)
    writeFileSync(outPath, JSON.stringify(allResults, null, 2))
  }
}

async function main() {
  const perPlayer = await Promise.all(playerIds.map(backtestPlayer))
  const all = perPlayer.flat()
  writeFileSync(outPath, JSON.stringify(all, null, 2))
  const failed = all.filter((song) => song.error).length
  console.log(`done: ${all.length - failed} songs written, ${failed} failed → ${outPath}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
