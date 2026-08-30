import { createHmac } from 'crypto'

const DOORBELL_URL = 'http://192.168.86.51:9117/v1/abaci-song-sync'
const RETRY_DELAYS_MS = [1_000, 3_000] as const
const RETRYABLE_STATUSES = new Set([408, 425, 429])
const REQUEST_TIMEOUT_MS = 2_000

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status) || status >= 500
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function warn(message: string): void {
  try {
    console.warn(message)
  } catch {
    // Logging must never make best-effort delivery observable to the caller.
  }
}

async function deliver(): Promise<void> {
  const configuredUrl = process.env.KID_SONGS_DOORBELL_URL
  if (!configuredUrl) return

  const secret = process.env.KID_SONGS_DOORBELL_SECRET
  if (configuredUrl !== DOORBELL_URL || !secret || secret.length < 32) {
    warn('[kid-songs-doorbell] Invalid configuration; delivery skipped')
    return
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1])

    const body = JSON.stringify({ timestamp: Math.floor(Date.now() / 1_000) })
    const signature = createHmac('sha256', secret).update(body, 'utf8').digest('hex')

    try {
      const response = await fetch(configuredUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Abaci-Signature': `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (response.status === 202) return
      if (!isRetryableStatus(response.status)) {
        warn(`[kid-songs-doorbell] Delivery rejected with HTTP ${response.status}`)
        return
      }
    } catch {
      // Network errors and request timeouts are transient.
    }
  }

  warn('[kid-songs-doorbell] Delivery failed after 3 attempts')
}

/** Best-effort notification. It always resolves, including on invalid config or delivery failure. */
export async function ringKidSongsDoorbell(): Promise<void> {
  try {
    await deliver()
  } catch {
    warn('[kid-songs-doorbell] Delivery failed')
  }
}
