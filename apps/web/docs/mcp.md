# Abaci.One MCP Integration

MCP (Model Context Protocol) allows external tools like Claude Code to access student skill data from Abaci.One.

## Quick Start

### 1. Generate an API Key

**Via API:**
```bash
curl -X POST http://localhost:3000/api/settings/mcp-keys \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"name": "Claude Code"}'
```

**Via UI:** Go to `/settings/mcp-keys` → Enter a name → Click "Generate"

### 2. Configure Claude Code

Add to your `.mcp.json` or run `claude mcp add`:

```json
{
  "mcpServers": {
    "abaci": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

For production, use your server's URL (e.g., `https://abaci.your-domain.com/api/mcp`).

## Available Tools

### `list_students`
List all students accessible to this API key.

```json
{
  "name": "list_students",
  "arguments": {}
}
```

Returns:
```json
[
  { "playerId": "abc123", "name": "Sonia", "emoji": "🦊" },
  { "playerId": "def456", "name": "Fern", "emoji": "🌿" }
]
```

### `get_student_overview`
Quick snapshot of a student's progress.

```json
{
  "name": "get_student_overview",
  "arguments": { "player_id": "abc123" }
}
```

Returns:
```json
{
  "playerId": "abc123",
  "name": "Sonia",
  "emoji": "🦊",
  "lastPracticed": "2026-01-15T10:30:00Z",
  "totalSkills": 34,
  "strong": 29,
  "developing": 5,
  "weak": 0
}
```

### `get_skills`
Detailed skill mastery data with optional filtering.

```json
{
  "name": "get_skills",
  "arguments": {
    "player_id": "abc123",
    "status": "developing",        // optional: "strong", "developing", "weak"
    "category": "tenComplements"   // optional: filter by category
  }
}
```

Returns:
```json
[
  {
    "skillId": "tenComplementsSub.-1=+9-10",
    "displayName": "-1=+9-10",
    "category": "tenComplementsSub",
    "attempts": 6,
    "correct": 4,
    "errors": 2,
    "accuracy": 67,
    "lastPracticed": "2026-01-14T15:00:00Z",
    "status": "developing"
  }
]
```

**Skill Categories:**
- `basic` - Direct addition/subtraction, heaven bead, simple combinations
- `fiveComplements` - Five complements addition (1=5-4, 2=5-3, etc.)
- `fiveComplementsSub` - Five complements subtraction
- `tenComplements` - Ten complements addition (1=10-9, 2=10-8, etc.)
- `tenComplementsSub` - Ten complements subtraction
- `advanced` - Cascading carry/borrow

### `get_recent_errors`
Get recent incorrect answers for targeted practice.

```json
{
  "name": "get_recent_errors",
  "arguments": {
    "player_id": "abc123",
    "days": 7,                    // optional, default: 7
    "skill_id": "tenComplementsSub.-1=+9-10",  // optional
    "limit": 20                   // optional, default: 20
  }
}
```

Returns:
```json
[
  {
    "timestamp": "2026-01-14T15:23:00Z",
    "skillsExercised": ["tenComplementsSub.-1=+9-10"],
    "responseTimeMs": 4200
  }
]
```

### `get_practice_sessions`
Get practice session history.

```json
{
  "name": "get_practice_sessions",
  "arguments": {
    "player_id": "abc123",
    "days": 14                    // optional, default: 14
  }
}
```

Returns:
```json
[
  {
    "date": "2026-01-15T10:30:00Z",
    "completedAt": "2026-01-15T10:42:00Z",
    "durationMinutes": 12
  }
]
```

### `get_recommended_focus`
Get skills that need the most attention.

```json
{
  "name": "get_recommended_focus",
  "arguments": {
    "player_id": "abc123",
    "count": 5                    // optional, default: 5
  }
}
```

Returns:
```json
[
  {
    "skillId": "tenComplementsSub.-1=+9-10",
    "displayName": "-1=+9-10",
    "category": "tenComplementsSub",
    "accuracy": 67,
    "attempts": 6,
    "status": "developing",
    "reason": "needs_practice"
  }
]
```

**Reason values:**
- `needs_practice` - Weak skill, low accuracy
- `close_to_mastery` - Developing, almost strong
- `maintenance` - Strong but good to review

---

## Session Management Tools

These tools allow you to create, control, and monitor practice sessions programmatically.

### `start_practice_session`
Create and optionally start a new practice session for a student.

```json
{
  "name": "start_practice_session",
  "arguments": {
    "player_id": "abc123",
    "duration_minutes": 10,
    "auto_start": true,
    "enabled_parts": {
      "abacus": true,
      "visualization": true,
      "linear": false
    },
    "max_terms": 5,
    "game_breaks": {
      "enabled": true,
      "max_minutes": 3,
      "selection_mode": "kid-chooses"
    }
  }
}
```

**Parameters:**
| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `player_id` | Yes | - | Student player ID |
| `duration_minutes` | Yes | - | Session length (5-60 minutes) |
| `auto_start` | No | `false` | If true, immediately approve and start the session |
| `enabled_parts.abacus` | No | `true` | Include physical abacus practice |
| `enabled_parts.visualization` | No | `true` | Include mental math with visualization |
| `enabled_parts.linear` | No | `true` | Include mental math with equations |
| `max_terms` | No | `5` | Maximum terms per problem (3-12) |
| `game_breaks.enabled` | No | `true` | Allow game breaks between parts |
| `game_breaks.max_minutes` | No | `5` | Maximum game break duration |
| `game_breaks.selection_mode` | No | `"kid-chooses"` | `"kid-chooses"` or `"auto-start"` |

Returns:
```json
{
  "sessionId": "clxyz123",
  "status": "in_progress",
  "practiceUrl": "https://abaci.one/practice/abc123",
  "observeUrl": "https://abaci.one/practice/abc123/observe",
  "summary": {
    "totalProblemCount": 45,
    "estimatedMinutes": 10,
    "parts": [
      { "partNumber": 1, "type": "abacus", "problemCount": 15, "estimatedMinutes": 3 },
      { "partNumber": 2, "type": "visualization", "problemCount": 15, "estimatedMinutes": 3 },
      { "partNumber": 3, "type": "linear", "problemCount": 15, "estimatedMinutes": 4 }
    ]
  }
}
```

### `get_active_session`
Get the current active practice session for a student, including URLs and progress.

```json
{
  "name": "get_active_session",
  "arguments": {
    "player_id": "abc123"
  }
}
```

Returns (when session exists):
```json
{
  "hasActiveSession": true,
  "sessionId": "clxyz123",
  "status": "in_progress",
  "practiceUrl": "https://abaci.one/practice/abc123",
  "observeUrl": "https://abaci.one/practice/abc123/observe",
  "startedAt": 1736956200000,
  "progress": {
    "currentPart": 2,
    "currentProblem": 8,
    "totalProblems": 45,
    "completedProblems": 23,
    "accuracy": 91
  }
}
```

Returns (when no session):
```json
{
  "hasActiveSession": false,
  "lastSessionAt": 1736869800000
}
```

### `control_session`
Control an active session: approve, start, end early, or abandon.

```json
{
  "name": "control_session",
  "arguments": {
    "player_id": "abc123",
    "session_id": "clxyz123",
    "action": "end_early"
  }
}
```

**Actions:**
| Action | Description |
|--------|-------------|
| `approve` | Approve a draft session (makes it ready to start) |
| `start` | Start an approved session |
| `end_early` | End the session early and save progress |
| `abandon` | Abandon the session without saving |

Returns:
```json
{
  "success": true,
  "sessionId": "clxyz123",
  "newStatus": "completed",
  "message": "Session ended early"
}
```

### `create_observation_link`
Generate a shareable URL that allows anyone (without login) to observe a practice session in real-time.

```json
{
  "name": "create_observation_link",
  "arguments": {
    "player_id": "abc123",
    "session_id": "clxyz123",
    "expires_in": "24h"
  }
}
```

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `player_id` | Yes | Student player ID |
| `session_id` | Yes | Session plan ID |
| `expires_in` | Yes | `"1h"` or `"24h"` |

Returns:
```json
{
  "token": "aB3cDeFgH2",
  "url": "https://abaci.one/observe/aB3cDeFgH2",
  "expiresAt": 1737042600000
}
```

### `list_observation_links`
List all active (non-expired, non-revoked) observation links for a session.

```json
{
  "name": "list_observation_links",
  "arguments": {
    "player_id": "abc123",
    "session_id": "clxyz123"
  }
}
```

Returns:
```json
{
  "shares": [
    {
      "token": "aB3cDeFgH2",
      "url": "https://abaci.one/observe/aB3cDeFgH2",
      "expiresAt": 1737042600000,
      "viewCount": 3,
      "createdAt": 1736956200000
    }
  ]
}
```

---

## API Key Management

### List Keys
```bash
curl http://localhost:3000/api/settings/mcp-keys \
  -H "Cookie: <session>"
```

### Create Key
```bash
curl -X POST http://localhost:3000/api/settings/mcp-keys \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"name": "My Key"}'
```

### Revoke Key
```bash
curl -X DELETE http://localhost:3000/api/settings/mcp-keys/KEY_ID \
  -H "Cookie: <session>"
```

## Security

- API keys are scoped to the user who created them
- Keys only grant access to players owned by that user (or linked via family code)
- Keys can be revoked at any time
- `lastUsedAt` is tracked for auditing
- Use HTTPS in production

## Protocol Details

The MCP endpoint uses JSON-RPC 2.0 over HTTP POST:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_students",
      "arguments": {}
    }
  }'
```

Supported methods:
- `initialize` - Capability negotiation
- `tools/list` - List available tools
- `tools/call` - Execute a tool
