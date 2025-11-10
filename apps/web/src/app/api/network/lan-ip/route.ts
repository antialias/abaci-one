import { networkInterfaces } from 'os'
import { NextResponse } from 'next/server'

/**
 * Get the server's LAN IP address for QR code generation
 *
 * This allows phones on the same network to access the dev server
 * by scanning a QR code with the LAN IP instead of localhost
 *
 * SECURITY: Only available in development mode
 */
export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production', lanIp: null },
      { status: 404 }
    )
  }

  try {
    const nets = networkInterfaces()
    let lanIp: string | null = null

    // Find the first non-internal IPv4 address
    for (const name of Object.keys(nets)) {
      const netInterface = nets[name]
      if (!netInterface) continue

      for (const net of netInterface) {
        // Skip over non-IPv4 and internal addresses
        const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
        if (net.family === familyV4Value && !net.internal) {
          lanIp = net.address
          break
        }
      }

      if (lanIp) break
    }

    if (!lanIp) {
      return NextResponse.json(
        { error: 'No LAN IP found', lanIp: null },
        { status: 404 }
      )
    }

    return NextResponse.json({ lanIp })
  } catch (error) {
    console.error('Error getting LAN IP:', error)
    return NextResponse.json(
      { error: 'Failed to get LAN IP', lanIp: null },
      { status: 500 }
    )
  }
}
