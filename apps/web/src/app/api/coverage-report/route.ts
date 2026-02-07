/**
 * Coverage report upload endpoint
 *
 * POST /api/coverage-report
 *
 * Receives a gzipped tarball of the HTML coverage report from CI
 * and extracts it to the dev-artifacts NFS volume for serving at
 * dev.abaci.one/coverage/
 *
 * Protected by Bearer token (COVERAGE_API_TOKEN env var).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

const COVERAGE_DIR =
  process.env.COVERAGE_REPORT_DIR || '/dev-artifacts/coverage'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.COVERAGE_API_TOKEN
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.arrayBuffer()
    if (body.byteLength === 0) {
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      )
    }

    // Write tarball to temp file
    const tmpTar = join('/tmp', `coverage-report-${Date.now()}.tar.gz`)
    await writeFile(tmpTar, Buffer.from(body))

    // Clear old report and extract new one
    if (existsSync(COVERAGE_DIR)) {
      rmSync(COVERAGE_DIR, { recursive: true, force: true })
    }
    mkdirSync(COVERAGE_DIR, { recursive: true })

    execSync(`tar xzf ${tmpTar} -C ${COVERAGE_DIR}`, {
      timeout: 30_000,
    })

    // Clean up temp file
    rmSync(tmpTar, { force: true })

    return NextResponse.json({
      success: true,
      message: `Coverage report extracted to ${COVERAGE_DIR}`,
    })
  } catch (error) {
    console.error('Error uploading coverage report:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
