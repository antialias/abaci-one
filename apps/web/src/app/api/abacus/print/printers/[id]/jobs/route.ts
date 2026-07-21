/**
 * POST /api/abacus/print/printers/[id]/jobs (Abacus Studio #8.3) — job submit.
 *
 * Multipart pass-through (`model` = 3MF, `job` = v2 ticket JSON) with exactly
 * ONE mutation: `job.source.app = "abacus-studio"`. Everything else —
 * `style` above all — forwards untouched (v2 discipline: the proxy never
 * injects, normalizes, or defaults ticket fields; mixing vocabularies is the
 * service's 400 to give). On success the job's ownership row is recorded so
 * `jobs/*` reads and doorbell rings can be authorized.
 */
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { resolveConnection } from '@/lib/abacus/print/connections'
import { recordJobOwnership } from '@/lib/abacus/print/job-ownership'
import { proxyErrorResponse, relayResponse } from '@/lib/abacus/print/proxy'
import { printServiceFetch } from '@/lib/abacus/print/print-service-fetch'
import { PRINT_SOURCE_APP } from '@/lib/abacus/print/source-app'

/** Generous ceiling for the multipart upload (abacus 3MFs are MB-scale). */
const SUBMIT_TIMEOUT_MS = 120_000

export const POST = withAuth(async (request, { params }) => {
  const { id: printerId } = (await params) as { id: string }
  try {
    const userId = await getUserId()
    const connection = await resolveConnection(
      userId,
      request.nextUrl.searchParams.get('connectionId')
    )

    const form = await request.formData().catch(() => null)
    const model = form?.get('model')
    const jobRaw = form?.get('job')
    if (!form || !(model instanceof File) || typeof jobRaw !== 'string') {
      return NextResponse.json(
        { error: 'Submit requires multipart fields "model" (file) and "job" (JSON)' },
        { status: 400 }
      )
    }

    let job: Record<string, unknown>
    try {
      job = JSON.parse(jobRaw)
    } catch {
      return NextResponse.json({ error: '"job" field is not valid JSON' }, { status: 400 })
    }

    // The only mutation the proxy is allowed to make.
    job.source = { ...(job.source as Record<string, unknown> | undefined), app: PRINT_SOURCE_APP }

    const upstreamForm = new FormData()
    upstreamForm.set('model', model, model.name)
    upstreamForm.set('job', JSON.stringify(job))

    const upstream = await printServiceFetch(
      { origin: connection.origin, tokenSealed: connection.tokenSealed },
      `/printers/${encodeURIComponent(printerId)}/jobs`,
      { method: 'POST', body: upstreamForm, timeoutMs: SUBMIT_TIMEOUT_MS }
    )

    if (upstream.ok) {
      const body = (await upstream
        .clone()
        .json()
        .catch(() => null)) as { jobId?: unknown; id?: unknown; job?: { id?: unknown } } | null
      const jobId = [body?.jobId, body?.id, body?.job?.id].find(
        (v): v is string => typeof v === 'string' && v.length > 0
      )
      if (jobId) {
        await recordJobOwnership({ jobId, connectionId: connection.id, userId, printerId })
      } else {
        console.error('[print-proxy] submit accepted but no job id found in response')
      }
    }

    return relayResponse(upstream)
  } catch (error) {
    return proxyErrorResponse(error)
  }
})
