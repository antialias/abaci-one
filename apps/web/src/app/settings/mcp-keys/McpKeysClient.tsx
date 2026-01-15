'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import { api } from '@/lib/queryClient'
import { css } from '../../../../styled-system/css'

interface ApiKey {
  id: string
  name: string
  keyPreview: string
  createdAt: string
  lastUsedAt: string | null
  isRevoked: boolean
}

interface NewKeyResponse {
  id: string
  name: string
  key: string
  createdAt: string
  message: string
}

async function fetchApiKeys(): Promise<{ keys: ApiKey[] }> {
  const res = await api('settings/mcp-keys')
  if (!res.ok) throw new Error('Failed to fetch API keys')
  return res.json()
}

async function createApiKey(name: string): Promise<NewKeyResponse> {
  const res = await api('settings/mcp-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to create API key')
  return res.json()
}

async function revokeApiKey(keyId: string): Promise<void> {
  const res = await api(`settings/mcp-keys/${keyId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to revoke API key')
}

export function McpKeysClient() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const queryClient = useQueryClient()

  // Form state
  const [newKeyName, setNewKeyName] = useState('')
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch existing keys
  const { data, isLoading } = useQuery({
    queryKey: ['mcp-api-keys'],
    queryFn: fetchApiKeys,
  })

  // Create key mutation
  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (data) => {
      setNewlyCreatedKey(data.key)
      setNewKeyName('')
      queryClient.invalidateQueries({ queryKey: ['mcp-api-keys'] })
    },
  })

  // Revoke key mutation
  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-api-keys'] })
    },
  })

  const handleCreate = useCallback(() => {
    if (newKeyName.trim()) {
      createMutation.mutate(newKeyName.trim())
    }
  }, [newKeyName, createMutation])

  const handleCopy = useCallback(async () => {
    if (newlyCreatedKey) {
      await navigator.clipboard.writeText(newlyCreatedKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [newlyCreatedKey])

  const handleDismissNewKey = useCallback(() => {
    setNewlyCreatedKey(null)
    setCopied(false)
  }, [])

  const activeKeys = data?.keys.filter((k) => !k.isRevoked) ?? []
  const revokedKeys = data?.keys.filter((k) => k.isRevoked) ?? []

  return (
    <PageWithNav>
      <main
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '2rem',
        })}
      >
        <div className={css({ maxWidth: '800px', margin: '0 auto' })}>
          {/* Header */}
          <header className={css({ marginBottom: '2rem' })}>
            <Link
              href="/settings"
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'blue.400' : 'blue.600',
                textDecoration: 'none',
                _hover: { textDecoration: 'underline' },
                marginBottom: '0.5rem',
                display: 'inline-block',
              })}
            >
              ← Back to Settings
            </Link>
            <h1
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
              })}
            >
              MCP API Keys
            </h1>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
                marginTop: '0.5rem',
              })}
            >
              Manage API keys for external tools like Claude Code to access student skill data.
            </p>
          </header>

          {/* Newly Created Key Banner */}
          {newlyCreatedKey && (
            <div
              className={css({
                backgroundColor: isDark ? 'green.900/50' : 'green.50',
                border: '1px solid',
                borderColor: isDark ? 'green.700' : 'green.200',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                })}
              >
                <h3
                  className={css({
                    fontWeight: '600',
                    color: isDark ? 'green.300' : 'green.800',
                  })}
                >
                  API Key Created
                </h3>
                <button
                  type="button"
                  onClick={handleDismissNewKey}
                  className={css({
                    color: isDark ? 'gray.400' : 'gray.500',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    lineHeight: 1,
                  })}
                >
                  ×
                </button>
              </div>
              <p
                className={css({
                  fontSize: '0.875rem',
                  color: isDark ? 'green.200' : 'green.700',
                  marginBottom: '0.75rem',
                })}
              >
                Copy this key now - it won't be shown again!
              </p>
              <div
                className={css({
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                })}
              >
                <code
                  className={css({
                    flex: 1,
                    backgroundColor: isDark ? 'gray.800' : 'white',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    color: isDark ? 'gray.200' : 'gray.800',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                  })}
                >
                  {newlyCreatedKey}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={css({
                    padding: '0.75rem 1rem',
                    backgroundColor: copied ? 'green.500' : 'blue.500',
                    color: 'white',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    _hover: { backgroundColor: copied ? 'green.600' : 'blue.600' },
                  })}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Create New Key Card */}
          <div
            className={css({
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              padding: '1.5rem',
              marginBottom: '1.5rem',
            })}
          >
            <h2
              className={css({
                fontWeight: '600',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '1rem',
              })}
            >
              Generate New Key
            </h2>
            <div
              className={css({
                display: 'flex',
                gap: '0.75rem',
              })}
            >
              <input
                type="text"
                placeholder="Key name (e.g., Claude Code)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className={css({
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  backgroundColor: isDark ? 'gray.700' : 'white',
                  color: isDark ? 'white' : 'gray.800',
                  _placeholder: { color: isDark ? 'gray.500' : 'gray.400' },
                })}
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newKeyName.trim() || createMutation.isPending}
                className={css({
                  padding: '0.75rem 1.5rem',
                  backgroundColor: newKeyName.trim()
                    ? 'blue.500'
                    : isDark
                      ? 'gray.700'
                      : 'gray.300',
                  color: newKeyName.trim() ? 'white' : isDark ? 'gray.500' : 'gray.500',
                  borderRadius: '6px',
                  border: 'none',
                  fontWeight: '600',
                  cursor: newKeyName.trim() ? 'pointer' : 'not-allowed',
                  _hover: newKeyName.trim() ? { backgroundColor: 'blue.600' } : {},
                })}
              >
                {createMutation.isPending ? 'Creating...' : 'Generate'}
              </button>
            </div>
          </div>

          {/* Active Keys List */}
          <div
            className={css({
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              padding: '1.5rem',
              marginBottom: '1.5rem',
            })}
          >
            <h2
              className={css({
                fontWeight: '600',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '1rem',
              })}
            >
              Active Keys
            </h2>

            {isLoading ? (
              <p className={css({ color: isDark ? 'gray.500' : 'gray.500' })}>Loading...</p>
            ) : activeKeys.length === 0 ? (
              <p
                className={css({
                  color: isDark ? 'gray.500' : 'gray.500',
                  fontStyle: 'italic',
                })}
              >
                No active API keys. Generate one above to get started.
              </p>
            ) : (
              <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' })}>
                {activeKeys.map((key) => (
                  <KeyRow
                    key={key.id}
                    apiKey={key}
                    isDark={isDark}
                    onRevoke={() => revokeMutation.mutate(key.id)}
                    isRevoking={revokeMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Revoked Keys (collapsed by default) */}
          {revokedKeys.length > 0 && (
            <details
              className={css({
                backgroundColor: isDark ? 'gray.800/50' : 'gray.100',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isDark ? 'gray.700' : 'gray.200',
                padding: '1rem 1.5rem',
              })}
            >
              <summary
                className={css({
                  fontWeight: '600',
                  color: isDark ? 'gray.400' : 'gray.600',
                  cursor: 'pointer',
                  _hover: { color: isDark ? 'gray.300' : 'gray.700' },
                })}
              >
                Revoked Keys ({revokedKeys.length})
              </summary>
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginTop: '1rem',
                })}
              >
                {revokedKeys.map((key) => (
                  <div
                    key={key.id}
                    className={css({
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0',
                      opacity: 0.6,
                    })}
                  >
                    <div>
                      <span
                        className={css({
                          color: isDark ? 'gray.400' : 'gray.600',
                          textDecoration: 'line-through',
                        })}
                      >
                        {key.name}
                      </span>
                      <span
                        className={css({
                          marginLeft: '0.5rem',
                          fontSize: '0.75rem',
                          color: isDark ? 'gray.500' : 'gray.500',
                          fontFamily: 'monospace',
                        })}
                      >
                        {key.keyPreview}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Usage Instructions */}
          <div
            className={css({
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: isDark ? 'gray.800/50' : 'blue.50',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'blue.100',
            })}
          >
            <h3
              className={css({
                fontWeight: '600',
                color: isDark ? 'blue.300' : 'blue.800',
                marginBottom: '0.5rem',
              })}
            >
              Usage with Claude Code
            </h3>
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.300' : 'gray.700',
                marginBottom: '0.75rem',
              })}
            >
              Add this to your <code>.mcp.json</code>:
            </p>
            <pre
              className={css({
                backgroundColor: isDark ? 'gray.900' : 'white',
                padding: '1rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                overflowX: 'auto',
                color: isDark ? 'gray.200' : 'gray.800',
              })}
            >
              {JSON.stringify(
                {
                  mcpServers: {
                    abaci: {
                      type: 'http',
                      url: `${typeof window !== 'undefined' ? window.location.origin : 'https://abaci.one'}/api/mcp`,
                      headers: {
                        Authorization: 'Bearer YOUR_API_KEY',
                      },
                    },
                  },
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </main>
    </PageWithNav>
  )
}

/**
 * Single API key row
 */
function KeyRow({
  apiKey,
  isDark,
  onRevoke,
  isRevoking,
}: {
  apiKey: ApiKey
  isDark: boolean
  onRevoke: () => void
  isRevoking: boolean
}) {
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const handleRevokeClick = useCallback(() => {
    if (confirmRevoke) {
      onRevoke()
      setConfirmRevoke(false)
    } else {
      setConfirmRevoke(true)
      setTimeout(() => setConfirmRevoke(false), 3000)
    }
  }, [confirmRevoke, onRevoke])

  const createdDate = new Date(apiKey.createdAt).toLocaleDateString()
  const lastUsed = apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : 'Never'

  return (
    <div
      className={css({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem',
        backgroundColor: isDark ? 'gray.700/50' : 'gray.50',
        borderRadius: '8px',
      })}
    >
      <div>
        <div
          className={css({
            fontWeight: '600',
            color: isDark ? 'white' : 'gray.800',
          })}
        >
          {apiKey.name}
        </div>
        <div
          className={css({
            fontSize: '0.75rem',
            color: isDark ? 'gray.400' : 'gray.500',
            marginTop: '0.25rem',
          })}
        >
          <span className={css({ fontFamily: 'monospace' })}>{apiKey.keyPreview}</span>
          <span className={css({ marginLeft: '1rem' })}>Created: {createdDate}</span>
          <span className={css({ marginLeft: '1rem' })}>Last used: {lastUsed}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleRevokeClick}
        disabled={isRevoking}
        className={css({
          padding: '0.5rem 1rem',
          backgroundColor: confirmRevoke ? 'red.500' : 'transparent',
          color: confirmRevoke ? 'white' : isDark ? 'red.400' : 'red.600',
          borderRadius: '6px',
          border: '1px solid',
          borderColor: confirmRevoke ? 'red.500' : isDark ? 'red.400/50' : 'red.200',
          cursor: 'pointer',
          fontSize: '0.875rem',
          _hover: {
            backgroundColor: confirmRevoke ? 'red.600' : isDark ? 'red.900/30' : 'red.50',
          },
        })}
      >
        {isRevoking ? 'Revoking...' : confirmRevoke ? 'Confirm Revoke' : 'Revoke'}
      </button>
    </div>
  )
}
