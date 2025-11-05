import { execSync } from 'child_process'
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

// Generate icon by calling script that uses react-dom/server
function generateDayIcon(day: number): string {
  // Call the generation script as a subprocess
  // Scripts can use react-dom/server, route handlers cannot
  const scriptPath = join(process.cwd(), 'scripts', 'generateDayIcon.tsx')
  const svg = execSync(`npx tsx "${scriptPath}" ${day}`, {
    encoding: 'utf-8',
    cwd: process.cwd(),
  })
  return svg
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
      return new Response('Invalid day parameter. Must be 1-31.', { status: 400 })
    }
  } else {
    dayOfMonth = getDayOfMonth()
  }

  // Check cache first
  let svg = iconCache.get(dayOfMonth)

  if (!svg) {
    // Generate and cache
    svg = generateDayIcon(dayOfMonth)
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
