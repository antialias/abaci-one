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
 * - resources/list: List available resources
 * - resources/read: Read a specific resource
 */

import { NextResponse } from 'next/server'
import { validateMcpApiKey } from '@/lib/mcp/auth'
import { listResources, readResource } from '@/lib/mcp/resources'
import {
  MCP_TOOLS,
  listStudents,
  verifyPlayerAccess,
  getStudentOverview,
  getSkills,
  getRecentErrors,
  getPracticeSessions,
  getRecommendedFocus,
  startPracticeSession,
  getActiveSession,
  controlSession,
  createObservationLink,
  listObservationLinks,
  generateWorksheet,
  getWorksheetInfo,
  listDifficultyProfiles,
} from '@/lib/mcp/tools'
import type { ShareDuration } from '@/lib/session-share'

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
              resources: {},
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

      case 'resources/list': {
        const result = listResources()
        return NextResponse.json(jsonRpcSuccess(id, result))
      }

      case 'resources/read': {
        const uri = params.uri as string
        if (!uri) {
          return NextResponse.json(jsonRpcError(id, -32602, 'Missing resource URI'))
        }

        const result = readResource(uri)
        if ('error' in result) {
          return NextResponse.json(jsonRpcError(id, -32002, result.error))
        }

        return NextResponse.json(jsonRpcSuccess(id, result))
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
  // Worksheet tools don't require player access
  const worksheetToolNames = [
    'generate_worksheet',
    'get_worksheet_info',
    'list_difficulty_profiles',
  ]
  if (worksheetToolNames.includes(toolName)) {
    return executeWorksheetTool(toolName, args)
  }

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

    // Session management tools
    case 'start_practice_session':
      return startPracticeSession(playerId, userId, {
        durationMinutes: args.duration_minutes as number,
        autoStart: args.auto_start as boolean | undefined,
        enabledParts: args.enabled_parts as
          | { abacus?: boolean; visualization?: boolean; linear?: boolean }
          | undefined,
        maxTerms: args.max_terms as number | undefined,
        gameBreaks: args.game_breaks as
          | {
              enabled?: boolean
              maxMinutes?: number
              selectionMode?: 'auto-start' | 'kid-chooses'
            }
          | undefined,
      })

    case 'get_active_session':
      return getActiveSession(playerId)

    case 'control_session':
      return controlSession(
        playerId,
        args.session_id as string,
        args.action as 'approve' | 'start' | 'end_early' | 'abandon'
      )

    case 'create_observation_link':
      return createObservationLink(
        playerId,
        args.session_id as string,
        userId,
        args.expires_in as ShareDuration
      )

    case 'list_observation_links':
      return listObservationLinks(playerId, args.session_id as string)

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

/**
 * Execute worksheet tools that don't require player access
 */
async function executeWorksheetTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'generate_worksheet':
      return generateWorksheet({
        operator: args.operator as 'addition' | 'subtraction' | 'mixed' | undefined,
        digitRange: args.digit_range as { min: number; max: number } | undefined,
        problemsPerPage: args.problems_per_page as number | undefined,
        pages: args.pages as number | undefined,
        difficultyProfile: args.difficulty_profile as string | undefined,
        includeAnswerKey: args.include_answer_key as boolean | undefined,
        title: args.title as string | undefined,
        orientation: args.orientation as 'portrait' | 'landscape' | undefined,
        cols: args.cols as number | undefined,
      })

    case 'get_worksheet_info':
      return getWorksheetInfo(args.share_id as string)

    case 'list_difficulty_profiles':
      return listDifficultyProfiles()

    default:
      return null // Not a worksheet tool
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
