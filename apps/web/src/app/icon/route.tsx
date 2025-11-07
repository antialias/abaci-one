import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

// In-memory cache: { day: svg }
const iconCache = new Map<number, string>()

// Get current day of month in US Central Time
function getDayOfMonth(): number {
  const now = new Date()
  // Get date in America/Chicago timezone
  const centralDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  return centralDate.getDate()
}

// Load pre-generated day icon from public/icons/
function loadDayIcon(day: number): string {
  // Read pre-generated icon from public/icons/
  // Icons are generated at build time by scripts/generateAllDayIcons.tsx
  const filename = `icon-day-${day.toString().padStart(2, '0')}.svg`
  const filepath = join(process.cwd(), 'public', 'icons', filename)
  return readFileSync(filepath, 'utf-8')
}

export async function GET(request: Request) {
  // Parse query parameters for testing
  const { searchParams } = new URL(request.url)
  const dayParam = searchParams.get('day')

  // Use override day if provided (for testing), otherwise use current day
  let dayOfMonth: number
  if (dayParam) {
    const parsedDay = parseInt(dayParam, 10)
    // Validate day is 1-31
    if (parsedDay >= 1 && parsedDay <= 31) {
      dayOfMonth = parsedDay
    } else {
      return new Response('Invalid day parameter. Must be 1-31.', {
        status: 400,
      })
    }
  } else {
    dayOfMonth = getDayOfMonth()
  }

  // Check cache first
  let svg = iconCache.get(dayOfMonth)

  if (!svg) {
    // Load pre-generated icon and cache
    svg = loadDayIcon(dayOfMonth)
    iconCache.set(dayOfMonth, svg)

    // Clear old cache entries (keep only current day, unless testing with override)
    if (!dayParam) {
      for (const [cachedDay] of iconCache) {
        if (cachedDay !== dayOfMonth) {
          iconCache.delete(cachedDay)
        }
      }
    }
  }

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      // Cache for 1 hour for current day, shorter cache for test overrides
      'Cache-Control': dayParam
        ? 'public, max-age=60, s-maxage=60'
        : 'public, max-age=3600, s-maxage=3600',
    },
  })
}
