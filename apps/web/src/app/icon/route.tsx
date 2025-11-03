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

export async function GET() {
  const dayOfMonth = getDayOfMonth()

  // Check cache first
  let svg = iconCache.get(dayOfMonth)

  if (!svg) {
    // Generate and cache
    svg = generateDayIcon(dayOfMonth)
    iconCache.set(dayOfMonth, svg)

    // Clear old cache entries (keep only current day)
    for (const [cachedDay] of iconCache) {
      if (cachedDay !== dayOfMonth) {
        iconCache.delete(cachedDay)
      }
    }
  }

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      // Cache for 1 hour so it updates throughout the day
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
