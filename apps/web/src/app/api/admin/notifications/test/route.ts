import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { sendWebPush } from '@/lib/notifications/web-push'
import { sendEmail } from '@/lib/notifications/email'
import { getSocketIO } from '@/lib/socket-io'

/**
 * POST /api/admin/notifications/test
 *
 * Send a test notification through a specified channel.
 * Body: { channel: 'webPush' | 'email' | 'inApp', targetEmail?: string, pushSubscription?: object }
 */
export const POST = withAuth(
  async (request: NextRequest, { userId }) => {
    try {
      const body = await request.json()
      const { channel, targetEmail, pushSubscription } = body as {
        channel: 'webPush' | 'email' | 'inApp'
        targetEmail?: string
        pushSubscription?: { endpoint: string; keys: { p256dh: string; auth: string } }
      }

      if (!channel) {
        return NextResponse.json({ error: 'channel is required' }, { status: 400 })
      }

      switch (channel) {
        case 'webPush': {
          if (!pushSubscription) {
            return NextResponse.json(
              { error: 'pushSubscription is required for webPush test' },
              { status: 400 }
            )
          }
          const result = await sendWebPush(pushSubscription, {
            title: 'Test Notification',
            body: 'Web Push is working!',
            icon: '/icon-192x192.png',
            data: { url: '/' },
          })
          return NextResponse.json({ success: result.success, statusCode: result.statusCode })
        }

        case 'email': {
          if (!targetEmail) {
            return NextResponse.json(
              { error: 'targetEmail is required for email test' },
              { status: 400 }
            )
          }
          await sendEmail({
            to: targetEmail,
            subject: 'Abaci One - Test Notification',
            html: `<div style="font-family:sans-serif;padding:20px;">
              <h2>Test Notification</h2>
              <p>Email notifications are working correctly.</p>
              <p style="color:#888;">Sent from Abaci One admin panel.</p>
            </div>`,
          })
          return NextResponse.json({ success: true })
        }

        case 'inApp': {
          const io = await getSocketIO()
          if (!io) {
            return NextResponse.json(
              { success: false, error: 'Socket.IO server not available' },
              { status: 503 }
            )
          }
          io.to(`user:${userId}`).emit('practice-notification', {
            sessionId: 'test',
            playerId: 'test',
            playerName: 'Test Student',
            playerEmoji: '🧪',
            observeUrl: '/',
          })
          return NextResponse.json({ success: true })
        }

        default:
          return NextResponse.json({ error: `Unknown channel: ${channel}` }, { status: 400 })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[admin/notifications/test] Error:', message)
      return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
  },
  { role: 'admin' }
)
