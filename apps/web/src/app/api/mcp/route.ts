/**
 * MCP (Model Context Protocol) API endpoint
 *
 * Handles JSON-RPC 2.0 requests for external tools like Claude Code.
 * Requires API key authentication via Authorization header.
 *
 * Supported methods:
 * - initialize: Capability negotiation
 * - tools/list: List available tools
 * - tools/call: Execute a tool
 */

import { NextResponse } from 'next/server'
import { validateMcpApiKey } from '@/lib/mcp/auth'
import {
  MCP_TOOLS,
  listStudents,
  verifyPlayerAccess,
  getStudentOverview,
  getSkills,
  getRecentErrors,
  getPracticeSessions,
  getRecommendedFocus,
} from '@/lib/mcp/tools'

const MCP_PROTOCOL_VERSION = '2025-03-26'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

function jsonRpcError(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  }
}

function jsonRpcSuccess(id: number | string | null, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  }
}

/**
 * POST /api/mcp - Handle MCP JSON-RPC requests
 */
export async function POST(request: Request) {
  // Validate MCP protocol version header
  const protocolVersion = request.headers.get('MCP-Protocol-Version')
  // Accept requests without version header for compatibility

  // Validate Authorization header
  const authHeader = request.headers.get('Authorization')
  const apiKey = authHeader?.replace('Bearer ', '')

  if (!apiKey) {
    return NextResponse.json(jsonRpcError(null, -32000, 'Missing Authorization header'), {
      status: 401,
    })
  }

  const userId = await validateMcpApiKey(apiKey)
  if (!userId) {
    return NextResponse.json(jsonRpcError(null, -32000, 'Invalid or revoked API key'), {
      status: 401,
    })
  }

  // Parse JSON-RPC request
  let body: JsonRpcRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(jsonRpcError(null, -32700, 'Parse error: Invalid JSON'), {
      status: 400,
    })
  }

  // Validate JSON-RPC structure
  if (body.jsonrpc !== '2.0' || !body.method) {
    return NextResponse.json(jsonRpcError(body.id ?? null, -32600, 'Invalid JSON-RPC request'), {
      status: 400,
    })
  }

  const { id, method, params = {} } = body

  try {
    // Handle MCP methods
    switch (method) {
      case 'initialize': {
        return NextResponse.json(
          jsonRpcSuccess(id, {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'abaci-one',
              version: '1.0.0',
            },
          })
        )
      }

      case 'tools/list': {
        return NextResponse.json(
          jsonRpcSuccess(id, {
            tools: MCP_TOOLS,
          })
        )
      }

      case 'tools/call': {
        const toolName = params.name as string
        const toolArgs = (params.arguments as Record<string, unknown>) || {}

        if (!toolName) {
          return NextResponse.json(jsonRpcError(id, -32602, 'Missing tool name'))
        }

        // Execute tool
        const result = await executeTool(userId, toolName, toolArgs)
        return NextResponse.json(
          jsonRpcSuccess(id, {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
            isError: false,
          })
        )
      }

      default: {
        return NextResponse.json(jsonRpcError(id, -32601, `Method not found: ${method}`))
      }
    }
  } catch (error) {
    console.error(`MCP error in ${method}:`, error)
    const message = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json(
      jsonRpcSuccess(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: message }),
          },
        ],
        isError: true,
      })
    )
  }
}

/**
 * Execute an MCP tool with authorization checks
 */
async function executeTool(
  userId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  // Tools that don't require a player_id
  if (toolName === 'list_students') {
    return listStudents(userId)
  }

  // All other tools require player_id
  const playerId = args.player_id as string
  if (!playerId) {
    throw new Error('player_id is required')
  }

  // Verify user has access to this player
  const hasAccess = await verifyPlayerAccess(userId, playerId)
  if (!hasAccess) {
    throw new Error('Access denied to this player')
  }

  switch (toolName) {
    case 'get_student_overview':
      return getStudentOverview(playerId)

    case 'get_skills':
      return getSkills(
        playerId,
        args.status as string | undefined,
        args.category as string | undefined
      )

    case 'get_recent_errors':
      return getRecentErrors(
        playerId,
        (args.days as number) ?? 7,
        args.skill_id as string | undefined,
        (args.limit as number) ?? 20
      )

    case 'get_practice_sessions':
      return getPracticeSessions(playerId, (args.days as number) ?? 14)

    case 'get_recommended_focus':
      return getRecommendedFocus(playerId, (args.count as number) ?? 5)

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

/**
 * OPTIONS - Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-Id',
    },
  })
}
