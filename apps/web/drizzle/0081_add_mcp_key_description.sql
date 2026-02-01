-- Add optional description column to MCP API keys
ALTER TABLE `mcp_api_keys` ADD COLUMN `description` text;
