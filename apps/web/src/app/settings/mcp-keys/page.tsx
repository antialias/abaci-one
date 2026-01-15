import { McpKeysClient } from './McpKeysClient'

/**
 * Settings page for managing MCP API keys.
 *
 * MCP (Model Context Protocol) allows external tools like Claude Code
 * to access student skill data from Abaci.One.
 */
export default function McpKeysPage() {
  return <McpKeysClient />
}
