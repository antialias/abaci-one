/**
 * The glitch record (practice-kinds plan of record §8 A23.3, K5a-3c R1).
 *
 * A glitch is a way a try's round trip went wrong that the screen told the kid
 * about, or that the outbox noticed. The browser mints its reference and sends
 * one write per glitch; this module is the server's half:
 * - `parseGlitch` whitelists the body field by field (as `parseTrySubmission`
 *   does): six kinds, a reference of the minted shape, and per kind the detail
 *   fields A23.3 lists, each type-checked; anything else in `detail` is
 *   dropped, and a raw detail over 4 KB is refused;
 * - `glitchCounterLabels` gives the counter's labels, every value an enum this
 *   module owns (the client's strings never become a label);
 * - `storeGlitch` inserts once per `(session, ref)` and holds a session to 50;
 * - `loadGlitches` reads a session's rows for the report.
 *
 * A row is a display-bug report, never a second opinion on an answer: the
 * stored try's verdict is the only one (A1, A11). Kind-blind: no part kind is
 * named here.
 */

import { and, asc, count, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { PracticeGlitch } from '@/db/schema/practice-glitches'

// ============================================================================
// The kinds and the reference
// ============================================================================

/** Every kind a glitch can be; fixed in R1 (the route refuses any other). */
export const GLITCH_KINDS = [
  'verdict_corrected',
  'save_delayed',
  'stale_screen',
  'do_over_refused',
  'save_rejected',
  'try_lost_at_end',
] as const

export type GlitchKind = (typeof GLITCH_KINDS)[number]

/** `GL-` + 4 characters of `23456789ABCDEFGHJKMNPQRSTVWXYZ` (A23.2) */
export const GLITCH_REF_PATTERN = /^GL-[23456789A-HJKMNP-TV-Z]{4}$/

/** The most a raw `detail` may weigh, as JSON (A23.3) */
export const GLITCH_DETAIL_MAX_BYTES = 4096

/** The most rows one session may hold (A23.3: a looping client cannot fill the table) */
export const GLITCH_SESSION_LIMIT = 50

const STALE_REASONS = ['not_current', 'unknown_item', 'not_practicing'] as const
const DO_OVER_REASONS = ['divulged', 'no_try', 'not_accepted'] as const
const SAVE_FAILURES = ['timeout', 'network', 'http_5xx', 'contention', 'unknown_kind'] as const
const DRAINED_BY = ['practice', 'summary', 'other'] as const
const MODES = ['first_or_retry', 'do_over'] as const

/** The counter's `detail` label of a `save_rejected`: the client's code, mapped here */
export const SAVE_REJECTED_LABELS = [
  'malformed_try',
  'malformed_do_over',
  'not_found',
  'flow',
  'other',
] as const

// ============================================================================
// Parsing
// ============================================================================

/** A glitch write the route refuses (400 `MALFORMED_GLITCH`). */
export class MalformedGlitchError extends Error {
  readonly code = 'MALFORMED_GLITCH'
  constructor(reason: string) {
    super(`Malformed glitch: ${reason}`)
    this.name = 'MalformedGlitchError'
  }
}

export interface ParsedGlitch {
  ref: string
  kind: GlitchKind
  /** The browser's clock when the glitch happened (epoch ms) */
  clientAt: number
  clientBuild: string | null
  /** The whitelisted detail: only the fields A23.3 lists for the kind */
  detail: Record<string, unknown>
}

type FieldCheck = (value: unknown) => boolean

const MAX_STRING = 256

const isString: FieldCheck = (v) => typeof v === 'string' && v.length <= MAX_STRING
const isStringOrNull: FieldCheck = (v) => v === null || isString(v)
const isBoolean: FieldCheck = (v) => typeof v === 'boolean'
const isCount: FieldCheck = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isMs: FieldCheck = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isMsOrNull: FieldCheck = (v) => v === null || isMs(v)
const isAnswer: FieldCheck = (v) =>
  v === null || (typeof v === 'number' && Number.isFinite(v)) || isString(v)
const oneOf =
  (values: readonly string[]): FieldCheck =>
  (v) =>
    typeof v === 'string' && values.includes(v)

/** A field of a kind's detail: its check, and whether the kind requires it. */
interface Field {
  check: FieldCheck
  required?: boolean
}

/** The try a glitch is about (every kind but `save_delayed`, which is per episode) */
const TRY_FIELDS: Record<string, Field> = {
  tryId: { check: isString },
  partIndex: { check: isCount },
  itemId: { check: isString },
  round: { check: isCount },
  mode: { check: oneOf(MODES) },
}

/** The screen's state when it happened (every kind) */
const CONTEXT_FIELDS: Record<string, Field> = {
  outboxDepth: { check: isCount },
  online: { check: isBoolean },
  visible: { check: isBoolean },
}

/** The detail whitelist, per kind (A23.3's `detail` row) */
const DETAIL_FIELDS: Record<GlitchKind, Record<string, Field>> = {
  verdict_corrected: {
    ...TRY_FIELDS,
    shown: { check: isBoolean, required: true },
    stored: { check: isBoolean, required: true },
    answer: { check: isAnswer },
    submittedAt: { check: isMs },
    repliedAt: { check: isMs },
    slidBeforeReply: { check: isBoolean },
    ...CONTEXT_FIELDS,
  },
  save_delayed: {
    tries: { check: isCount },
    attempts: { check: isCount },
    firstEnqueuedAt: { check: isMs },
    pillShownAt: { check: isMs },
    resolvedAfterMs: { check: isMsOrNull },
    lastFailure: { check: oneOf(SAVE_FAILURES), required: true },
    ...CONTEXT_FIELDS,
  },
  stale_screen: {
    ...TRY_FIELDS,
    reason: { check: oneOf(STALE_REASONS), required: true },
    expectedItemId: { check: isStringOrNull },
    serverFlowState: { check: isStringOrNull },
    screenFlowState: { check: isStringOrNull },
    ...CONTEXT_FIELDS,
  },
  do_over_refused: {
    ...TRY_FIELDS,
    reason: { check: oneOf(DO_OVER_REASONS), required: true },
    ...CONTEXT_FIELDS,
  },
  save_rejected: {
    ...TRY_FIELDS,
    status: { check: isCount },
    code: { check: isStringOrNull },
    ...CONTEXT_FIELDS,
  },
  try_lost_at_end: {
    ...TRY_FIELDS,
    answer: { check: isAnswer },
    enqueuedAt: { check: isMs },
    planStatus: { check: isString, required: true },
    endedBy: { check: isStringOrNull },
    drainedBy: { check: oneOf(DRAINED_BY) },
    ...CONTEXT_FIELDS,
  },
}

function isGlitchKind(value: unknown): value is GlitchKind {
  return typeof value === 'string' && (GLITCH_KINDS as readonly string[]).includes(value)
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/** The POST body → the glitch to store; throws `MalformedGlitchError`. */
export function parseGlitch(body: unknown): ParsedGlitch {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new MalformedGlitchError('not an object')
  }
  const b = body as Record<string, unknown>
  if (typeof b.ref !== 'string' || !GLITCH_REF_PATTERN.test(b.ref)) {
    throw new MalformedGlitchError('ref')
  }
  if (!isGlitchKind(b.kind)) throw new MalformedGlitchError('kind')
  if (!isMs(b.clientAt)) throw new MalformedGlitchError('clientAt')
  if (b.clientBuild !== undefined && !isStringOrNull(b.clientBuild)) {
    throw new MalformedGlitchError('clientBuild')
  }
  const raw = b.detail ?? {}
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new MalformedGlitchError('detail')
  }
  if (byteLength(JSON.stringify(raw)) > GLITCH_DETAIL_MAX_BYTES) {
    throw new MalformedGlitchError('detail too large')
  }
  const given = raw as Record<string, unknown>
  const detail: Record<string, unknown> = {}
  for (const [name, field] of Object.entries(DETAIL_FIELDS[b.kind])) {
    const value = given[name]
    if (value === undefined) {
      if (field.required) throw new MalformedGlitchError(`detail.${name}`)
      continue
    }
    if (!field.check(value)) throw new MalformedGlitchError(`detail.${name}`)
    detail[name] = value
  }
  if (b.kind === 'verdict_corrected' && detail.shown === detail.stored) {
    // Not a correction: the screen and the server agreed
    throw new MalformedGlitchError('detail.shown equals detail.stored')
  }
  return {
    ref: b.ref,
    kind: b.kind,
    clientAt: Math.round(b.clientAt as number),
    clientBuild: (b.clientBuild as string | null | undefined) ?? null,
    detail,
  }
}

// ============================================================================
// The counter's labels
// ============================================================================

export interface GlitchCounterLabels {
  kind: GlitchKind | 'malformed'
  detail: string
}

/** The client's code of a rejected save → the label (never the client's string) */
function saveRejectedLabel(detail: Record<string, unknown>): (typeof SAVE_REJECTED_LABELS)[number] {
  const code = typeof detail.code === 'string' ? detail.code : null
  if (code === 'MALFORMED_TRY') return 'malformed_try'
  if (code === 'MALFORMED_DO_OVER') return 'malformed_do_over'
  if (code === 'INVALID_FLOW_TRANSITION' || code === 'STALE_FLOW_VERSION') return 'flow'
  if (detail.status === 404) return 'not_found'
  return 'other'
}

/**
 * The counter's labels of a stored glitch (A23.3). Every value is one of a
 * fixed set: the parser has already held `reason` and `lastFailure` to theirs.
 */
export function glitchCounterLabels(glitch: ParsedGlitch): GlitchCounterLabels {
  const { kind, detail } = glitch
  switch (kind) {
    case 'verdict_corrected':
      return {
        kind,
        detail: detail.shown === true ? 'shown_right_stored_wrong' : 'shown_wrong_stored_right',
      }
    case 'stale_screen':
    case 'do_over_refused':
      return { kind, detail: detail.reason as string }
    case 'save_delayed':
      return { kind, detail: detail.lastFailure as string }
    case 'save_rejected':
      return { kind, detail: saveRejectedLabel(detail) }
    case 'try_lost_at_end':
      return { kind, detail: detail.planStatus === 'completed' ? 'completed' : 'ended' }
  }
}

/** The labels of a refused glitch write */
export const MALFORMED_GLITCH_LABELS: GlitchCounterLabels = { kind: 'malformed', detail: 'none' }

// ============================================================================
// Storing and loading
// ============================================================================

/** A session already holds `GLITCH_SESSION_LIMIT` rows (429 `GLITCH_LIMIT`). */
export class GlitchLimitError extends Error {
  readonly code = 'GLITCH_LIMIT'
  constructor() {
    super(`A session holds at most ${GLITCH_SESSION_LIMIT} glitches`)
    this.name = 'GlitchLimitError'
  }
}

export interface StoreGlitchInput {
  glitch: ParsedGlitch
  sessionPlanId: string
  playerId: string
  serverBuild: string
  userAgent: string | null
  now?: number
}

export interface StoredGlitch {
  id: string
  ref: string
  /** False when the session already had this reference: a resend, nothing written */
  stored: boolean
}

/**
 * Store a glitch once per `(session, ref)`. A resend answers the stored row's
 * id with `stored: false` and writes nothing, so it is safe at the cap too;
 * a new reference past the cap throws `GlitchLimitError`.
 */
export async function storeGlitch(input: StoreGlitchInput): Promise<StoredGlitch> {
  const { glitch, sessionPlanId } = input
  const existing = await findSessionGlitch(sessionPlanId, glitch.ref)
  if (existing) return { id: existing.id, ref: glitch.ref, stored: false }

  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.practiceGlitches)
    .where(eq(schema.practiceGlitches.sessionPlanId, sessionPlanId))
  if (n >= GLITCH_SESSION_LIMIT) throw new GlitchLimitError()

  const inserted = await db
    .insert(schema.practiceGlitches)
    .values({
      ref: glitch.ref,
      sessionPlanId,
      playerId: input.playerId,
      kind: glitch.kind,
      detail: glitch.detail,
      clientBuild: glitch.clientBuild,
      serverBuild: input.serverBuild,
      userAgent: input.userAgent ? input.userAgent.slice(0, 256) : null,
      clientAt: glitch.clientAt,
      createdAt: input.now ?? Date.now(),
    })
    .onConflictDoNothing({
      target: [schema.practiceGlitches.sessionPlanId, schema.practiceGlitches.ref],
    })
    .returning({ id: schema.practiceGlitches.id })
  if (inserted.length > 0) return { id: inserted[0].id, ref: glitch.ref, stored: true }

  // A concurrent resend inserted it between the read and the write
  const raced = await findSessionGlitch(sessionPlanId, glitch.ref)
  if (!raced) throw new Error(`Glitch ${glitch.ref} neither inserted nor found`)
  return { id: raced.id, ref: glitch.ref, stored: false }
}

async function findSessionGlitch(sessionPlanId: string, ref: string) {
  const [row] = await db
    .select({ id: schema.practiceGlitches.id })
    .from(schema.practiceGlitches)
    .where(
      and(
        eq(schema.practiceGlitches.sessionPlanId, sessionPlanId),
        eq(schema.practiceGlitches.ref, ref)
      )
    )
    .limit(1)
  return row
}

/** What the report reads of a glitch row */
export type ReportGlitch = Pick<PracticeGlitch, 'ref' | 'kind' | 'createdAt'>

/** A session's glitches for the report, oldest first */
export async function loadGlitches(sessionPlanId: string): Promise<ReportGlitch[]> {
  return db
    .select({
      ref: schema.practiceGlitches.ref,
      kind: schema.practiceGlitches.kind,
      createdAt: schema.practiceGlitches.createdAt,
    })
    .from(schema.practiceGlitches)
    .where(eq(schema.practiceGlitches.sessionPlanId, sessionPlanId))
    .orderBy(asc(schema.practiceGlitches.createdAt), asc(schema.practiceGlitches.id))
}

/** The glitches of many sessions in one query, by session id (lists, MCP) */
export async function loadGlitchesFor(
  sessionPlanIds: readonly string[]
): Promise<Map<string, ReportGlitch[]>> {
  const bySession = new Map<string, ReportGlitch[]>()
  if (sessionPlanIds.length === 0) return bySession
  const rows = await db
    .select({
      sessionPlanId: schema.practiceGlitches.sessionPlanId,
      ref: schema.practiceGlitches.ref,
      kind: schema.practiceGlitches.kind,
      createdAt: schema.practiceGlitches.createdAt,
    })
    .from(schema.practiceGlitches)
    .where(inArray(schema.practiceGlitches.sessionPlanId, [...sessionPlanIds]))
    .orderBy(asc(schema.practiceGlitches.createdAt), asc(schema.practiceGlitches.id))
  for (const { sessionPlanId, ...row } of rows) {
    const list = bySession.get(sessionPlanId)
    if (list) list.push(row)
    else bySession.set(sessionPlanId, [row])
  }
  return bySession
}
