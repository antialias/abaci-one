import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, unlink } from 'fs/promises'
import { createTask } from '@/lib/task-manager'
import type { DemoRefineEvent } from '@/lib/tasks/events'

export const dynamic = 'force-dynamic'

interface SelectedSegment {
  index: number
  scrubberLabel?: string
  ttsText: string
  startProgress: number
  endProgress: number
  animationDurationMs: number
}

interface RefineRequest {
  constantId: string
  startProgress: number
  endProgress: number
  prompt: string
  selectedSegments: SelectedSegment[]
  screenshotBase64?: string
  continueSessionId?: string
}

/** Map constantId to display info for the system prompt */
const CONSTANT_DISPLAY: Record<string, { name: string; symbol: string }> = {
  phi: { name: 'Golden Ratio', symbol: 'φ' },
  pi: { name: 'Pi', symbol: 'π' },
  tau: { name: 'Tau', symbol: 'τ' },
  e: { name: "Euler's Number", symbol: 'e' },
  gamma: { name: 'Euler-Mascheroni Constant', symbol: 'γ' },
  sqrt2: { name: 'Square Root of 2', symbol: '√2' },
  sqrt3: { name: 'Square Root of 3', symbol: '√3' },
  ln2: { name: 'Natural Log of 2', symbol: 'ln 2' },
  ramanujan: { name: 'Ramanujan-Soldner Constant', symbol: 'μ' },
  feigenbaum: { name: 'Feigenbaum Constant', symbol: 'δ' },
}

/** Map constantId to file name prefix (handles phi → goldenRatio special case) */
function demoFilePrefix(constantId: string): string {
  if (constantId === 'phi') return 'goldenRatio'
  return constantId
}

function buildContinuationPrompt(prompt: string, screenshotPath?: string): string {
  if (!screenshotPath) return prompt
  return `${prompt}

## Annotated Screenshot
The user captured a new screenshot with bright magenta (#ff00ff) annotations highlighting areas of interest.
FIRST read the screenshot to see what the user is referring to:
  ${screenshotPath}

Interpret the magenta annotations as "look here" / "this area" markers in the context of the user's request.`
}

function buildSystemPrompt(req: RefineRequest, screenshotPath?: string): string {
  const display = CONSTANT_DISPLAY[req.constantId] ?? {
    name: req.constantId,
    symbol: req.constantId,
  }
  const prefix = demoFilePrefix(req.constantId)
  const demosDir = 'apps/web/src/components/toys/number-line/constants/demos'

  const segmentList = req.selectedSegments
    .map((seg, i) => {
      const label = seg.scrubberLabel ? ` (${seg.scrubberLabel})` : ''
      return `  ${i + 1}. Segment ${seg.index}${label}
     Progress: ${seg.startProgress.toFixed(3)} → ${seg.endProgress.toFixed(3)}
     Duration: ${seg.animationDurationMs}ms
     TTS: "${seg.ttsText}"`
    })
    .join('\n')

  return `You are refining a mathematical constant demo for the number line educational tool.

## Context
- Constant: ${req.constantId} (${display.name}, ${display.symbol})
- Selected progress range: ${req.startProgress.toFixed(3)} to ${req.endProgress.toFixed(3)}

## Files to modify
- Animation: ${demosDir}/${prefix}Demo.ts
- Narration: ${demosDir}/${prefix}DemoNarration.ts

## Context files (read-only)
- Hook: ${demosDir}/useConstantDemoNarration.ts
- Demo hook: ${demosDir}/useConstantDemo.ts

## Selected segments
${segmentList}

## User's request
${req.prompt}

## Rules
1. Read BOTH files before making changes
2. Focus on segments within the selected range
3. Segments MUST remain contiguous (each startProgress = prev endProgress)
4. First segment starts at 0.000, last ends at 1.000
5. You may add/remove/reorder segments but maintain contiguity
6. ttsText should be for a smart 5-year-old: clear, vivid, wonder-filled
7. Run: cd apps/web && npx tsc --noEmit
8. Do NOT change exported function signatures
9. Do NOT modify useConstantDemoNarration.ts or useConstantDemo.ts${
    screenshotPath
      ? `

## Annotated Screenshot
The user captured a screenshot of the current animation frame and drew bright magenta (#ff00ff) annotations on it.
The magenta marks are NOT part of the animation — they are the user's hand-drawn indicators highlighting areas of interest.
FIRST read the screenshot to see what the user is referring to:
  ${screenshotPath}

Interpret the magenta annotations as "look here" / "this area" markers in the context of the user's request.`
      : ''
  }`
}

export const POST = withAuth(async (request) => {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    )
  }

  let body: RefineRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { constantId, startProgress, endProgress, prompt, selectedSegments } = body
  if (!constantId || prompt == null || startProgress == null || endProgress == null) {
    return NextResponse.json(
      { error: 'Missing required fields: constantId, startProgress, endProgress, prompt' },
      { status: 400 }
    )
  }

  // Save annotated screenshot to temp file if provided
  let screenshotPath: string | undefined
  if (body.screenshotBase64) {
    const buf = Buffer.from(body.screenshotBase64, 'base64')
    screenshotPath = join(tmpdir(), `demo-refine-screenshot-${Date.now()}.png`)
    await writeFile(screenshotPath, buf)
  }

  const isContinuation = !!body.continueSessionId

  const claudePrompt = isContinuation
    ? buildContinuationPrompt(prompt, screenshotPath)
    : buildSystemPrompt(body, screenshotPath) + '\n\n' + prompt

  const taskId = await createTask<RefineRequest, { sessionId?: string }, DemoRefineEvent>(
    'demo-refine',
    body,
    async (handle) => {
      const child = spawn(
        'claude',
        [
          '-p',
          claudePrompt,
          '--output-format',
          'stream-json',
          '--verbose',
          '--allowedTools',
          'Read,Write,Edit,Glob,Grep,Bash',
          ...(isContinuation ? ['--resume', body.continueSessionId!] : []),
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      )

      let sessionId: string | undefined
      let toolCallCount = 0
      let lastLineBuffer = ''

      child.stdout.on('data', (chunk: Buffer) => {
        if (handle.isCancelled()) {
          child.kill('SIGTERM')
          return
        }

        lastLineBuffer += chunk.toString()
        const lines = lastLineBuffer.split('\n')
        // Keep the last partial line in the buffer
        lastLineBuffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)

            // Extract session ID from the first message and emit it immediately
            if (msg.session_id && !sessionId) {
              sessionId = msg.session_id
              handle.emit({ type: 'session_id', sessionId: msg.session_id as string })
            }

            if (msg.type === 'assistant' && msg.message?.content) {
              for (const block of msg.message.content) {
                if (block.type === 'text' && block.text) {
                  handle.emit({ type: 'claude_output', text: block.text })
                } else if (block.type === 'tool_use') {
                  toolCallCount++
                  handle.emit({
                    type: 'tool_use',
                    tool: block.name,
                    file: block.input?.file_path ?? block.input?.command,
                  })
                  // Estimate progress based on tool calls (rough heuristic)
                  handle.setProgress(Math.min(90, toolCallCount * 8), `Tool: ${block.name}`)
                }
              }
            }

            if (msg.type === 'result') {
              sessionId = msg.session_id ?? sessionId
              const success = !msg.is_error
              handle.emit({
                type: 'claude_result',
                sessionId: sessionId ?? '',
                success,
              })
            }
          } catch {
            // Non-JSON line, skip
          }
        }
      })

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        if (text.trim()) {
          handle.emitTransient({ type: 'stderr', text })
        }
      })

      // Handle cancellation
      const checkCancellation = setInterval(() => {
        if (handle.isCancelled()) {
          child.kill('SIGTERM')
          clearInterval(checkCancellation)
        }
      }, 1000)

      try {
        await new Promise<void>((resolve, reject) => {
          child.on('close', (code) => {
            clearInterval(checkCancellation)
            // Process any remaining buffer
            if (lastLineBuffer.trim()) {
              try {
                const msg = JSON.parse(lastLineBuffer)
                if (msg.session_id && !sessionId) sessionId = msg.session_id
                if (msg.type === 'result') {
                  sessionId = msg.session_id ?? sessionId
                }
              } catch {
                /* ignore */
              }
            }

            if (handle.isCancelled()) {
              resolve()
              return
            }

            if (code === 0) {
              handle.complete({ sessionId })
              resolve()
            } else {
              handle.fail(`Claude exited with code ${code}`)
              reject(new Error(`Claude exited with code ${code}`))
            }
          })

          child.on('error', (err) => {
            clearInterval(checkCancellation)
            handle.fail(`Failed to spawn claude: ${err.message}`)
            reject(err)
          })
        })
      } finally {
        // Clean up temp screenshot file
        if (screenshotPath) unlink(screenshotPath).catch(() => {})
      }
    }
  )

  return NextResponse.json({ taskId })
})
