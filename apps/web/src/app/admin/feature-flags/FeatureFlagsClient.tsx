'use client'

import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageWithNav } from '@/components/PageWithNav'
import { AdminNav } from '@/components/AdminNav'
import { featureFlagKeys } from '@/lib/queryKeys'
import { css } from '../../../../styled-system/css'

interface FeatureFlag {
  key: string
  enabled: boolean
  config: string | null
  description: string | null
  allowedRoles: string | null
  createdAt: number
  updatedAt: number
}

const ALL_ROLES = ['guest', 'user', 'admin'] as const

interface FlagOverride {
  flagKey: string
  userId: string
  userEmail: string | null
  enabled: boolean
  config: string | null
  createdAt: number
  updatedAt: number
}

async function fetchAdminFlags(): Promise<{ flags: FeatureFlag[] }> {
  const res = await fetch('/api/admin/feature-flags')
  if (!res.ok) throw new Error('Failed to fetch flags')
  return res.json()
}

async function fetchOverrides(flagKey: string): Promise<{ overrides: FlagOverride[] }> {
  const res = await fetch(`/api/admin/feature-flags/${encodeURIComponent(flagKey)}/overrides`)
  if (!res.ok) throw new Error('Failed to fetch overrides')
  return res.json()
}

export function FeatureFlagsClient() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: featureFlagKeys.list(),
    queryFn: fetchAdminFlags,
  })

  const flags = data?.flags ?? []

  // Create form state
  const [newKey, setNewKey] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newEnabled, setNewEnabled] = useState(false)
  const [newConfig, setNewConfig] = useState('')
  const [createError, setCreateError] = useState('')
  const [newAllowedRoles, setNewAllowedRoles] = useState<string[]>([])

  // Expand/edit state
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editConfig, setEditConfig] = useState('')
  const [editError, setEditError] = useState('')
  const [editAllowedRoles, setEditAllowedRoles] = useState<string[]>([])

  // Delete confirmation
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null)

  // Override add form state
  const [overrideEmail, setOverrideEmail] = useState('')
  const [overrideEnabled, setOverrideEnabled] = useState(true)
  const [overrideConfig, setOverrideConfig] = useState('')
  const [overrideError, setOverrideError] = useState('')

  const invalidateFlags = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: featureFlagKeys.all })
  }, [queryClient])

  // Overrides query — only fetches when a flag is expanded
  const { data: overridesData, isLoading: overridesLoading } = useQuery({
    queryKey: featureFlagKeys.detail(expandedKey ?? ''),
    queryFn: () => fetchOverrides(expandedKey!),
    enabled: !!expandedKey,
  })

  const overrides = overridesData?.overrides ?? []

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (body: {
      key: string
      enabled: boolean
      config?: string | null
      description?: string | null
    }) => {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      invalidateFlags()
      setNewKey('')
      setNewDescription('')
      setNewEnabled(false)
      setNewConfig('')
      setNewAllowedRoles([])
      setCreateError('')
    },
    onError: (err: Error) => {
      setCreateError(err.message)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const res = await fetch(`/api/admin/feature-flags/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) throw new Error('Failed to toggle flag')
      return res.json()
    },
    onMutate: async ({ key, enabled }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: featureFlagKeys.list() })
      const previous = queryClient.getQueryData<{ flags: FeatureFlag[] }>(featureFlagKeys.list())
      if (previous) {
        queryClient.setQueryData(featureFlagKeys.list(), {
          flags: previous.flags.map((f) => (f.key === key ? { ...f, enabled } : f)),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(featureFlagKeys.list(), context.previous)
      }
    },
    onSettled: () => {
      invalidateFlags()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      key,
      ...body
    }: {
      key: string
      config?: string | null
      description?: string | null
    }) => {
      const res = await fetch(`/api/admin/feature-flags/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      invalidateFlags()
      setExpandedKey(null)
      setEditError('')
    },
    onError: (err: Error) => {
      setEditError(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/admin/feature-flags/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete flag')
      return res.json()
    },
    onSuccess: () => {
      invalidateFlags()
      setDeleteConfirmKey(null)
    },
  })

  const addOverrideMutation = useMutation({
    mutationFn: async (body: {
      flagKey: string
      email: string
      enabled: boolean
      config?: string | null
    }) => {
      const res = await fetch(
        `/api/admin/feature-flags/${encodeURIComponent(body.flagKey)}/overrides`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      setOverrideEmail('')
      setOverrideEnabled(true)
      setOverrideConfig('')
      setOverrideError('')
      if (expandedKey) {
        queryClient.invalidateQueries({ queryKey: featureFlagKeys.detail(expandedKey) })
      }
    },
    onError: (err: Error) => {
      setOverrideError(err.message)
    },
  })

  const deleteOverrideMutation = useMutation({
    mutationFn: async ({ flagKey, userId }: { flagKey: string; userId: string }) => {
      const res = await fetch(
        `/api/admin/feature-flags/${encodeURIComponent(flagKey)}/overrides/${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Failed to delete override')
      return res.json()
    },
    onSuccess: () => {
      if (expandedKey) {
        queryClient.invalidateQueries({ queryKey: featureFlagKeys.detail(expandedKey) })
      }
    },
  })

  const handleCreate = useCallback(() => {
    setCreateError('')
    const body: {
      key: string
      enabled: boolean
      config?: string | null
      description?: string | null
      allowedRoles?: string[] | null
    } = {
      key: newKey.trim(),
      enabled: newEnabled,
      description: newDescription.trim() || null,
      allowedRoles: newAllowedRoles.length > 0 ? newAllowedRoles : null,
    }
    if (newConfig.trim()) {
      try {
        JSON.parse(newConfig.trim())
        body.config = newConfig.trim()
      } catch {
        setCreateError('Config must be valid JSON')
        return
      }
    }
    createMutation.mutate(body)
  }, [newKey, newEnabled, newDescription, newConfig, newAllowedRoles, createMutation])

  const handleExpand = useCallback(
    (flag: FeatureFlag) => {
      if (expandedKey === flag.key) {
        setExpandedKey(null)
        return
      }
      setExpandedKey(flag.key)
      setEditDescription(flag.description ?? '')
      setEditConfig(flag.config ?? '')
      setEditError('')
      // Parse allowedRoles from JSON string
      let parsedRoles: string[] = []
      if (flag.allowedRoles) {
        try {
          parsedRoles = JSON.parse(flag.allowedRoles)
        } catch {
          // ignore malformed
        }
      }
      setEditAllowedRoles(parsedRoles)
      setOverrideEmail('')
      setOverrideEnabled(true)
      setOverrideConfig('')
      setOverrideError('')
    },
    [expandedKey]
  )

  const handleSaveEdit = useCallback(() => {
    if (!expandedKey) return
    setEditError('')

    const body: {
      key: string
      config?: string | null
      description?: string | null
      allowedRoles?: string[] | null
    } = {
      key: expandedKey,
      description: editDescription.trim() || null,
      allowedRoles: editAllowedRoles.length > 0 ? editAllowedRoles : null,
    }

    if (editConfig.trim()) {
      try {
        JSON.parse(editConfig.trim())
        body.config = editConfig.trim()
      } catch {
        setEditError('Config must be valid JSON')
        return
      }
    } else {
      body.config = null
    }

    updateMutation.mutate(body)
  }, [expandedKey, editDescription, editConfig, editAllowedRoles, updateMutation])

  const handleAddOverride = useCallback(() => {
    if (!expandedKey || !overrideEmail.trim()) return
    setOverrideError('')

    let configStr: string | null = null
    if (overrideConfig.trim()) {
      try {
        JSON.parse(overrideConfig.trim())
        configStr = overrideConfig.trim()
      } catch {
        setOverrideError('Config must be valid JSON')
        return
      }
    }

    addOverrideMutation.mutate({
      flagKey: expandedKey,
      email: overrideEmail.trim(),
      enabled: overrideEnabled,
      config: configStr,
    })
  }, [expandedKey, overrideEmail, overrideEnabled, overrideConfig, addOverrideMutation])

  // Shared input styles
  const inputStyle = css({
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#e6edf3',
    fontSize: '14px',
    outline: 'none',
    '&:focus': { borderColor: '#58a6ff' },
  })

  const editInputStyle = css({
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#e6edf3',
    fontSize: '14px',
    outline: 'none',
    '&:focus': { borderColor: '#58a6ff' },
  })

  const labelStyle = css({
    display: 'block',
    fontSize: '12px',
    color: '#8b949e',
    marginBottom: '4px',
  })

  const greenButtonStyle = css({
    padding: '6px 16px',
    backgroundColor: '#238636',
    color: '#ffffff',
    border: '1px solid #2ea043',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    '&:hover': { backgroundColor: '#2ea043' },
    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
  })

  const cancelButtonStyle = css({
    padding: '6px 16px',
    backgroundColor: '#21262d',
    color: '#e6edf3',
    border: '1px solid #30363d',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    '&:hover': { backgroundColor: '#30363d' },
  })

  return (
    <PageWithNav>
      <div
        data-component="feature-flags-admin"
        className={css({
          minHeight: '100vh',
          backgroundColor: '#0d1117',
          color: '#e6edf3',
        })}
      >
        <AdminNav />
        <div
          className={css({
            maxWidth: '1000px',
            margin: '0 auto',
            padding: '24px',
          })}
        >
          <h1
            className={css({
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '24px',
            })}
          >
            Feature Flags
          </h1>

          {/* Create form */}
          <div
            data-element="create-form"
            className={css({
              backgroundColor: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '6px',
              padding: '16px',
              marginBottom: '24px',
            })}
          >
            <h2
              className={css({
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px',
              })}
            >
              Create Flag
            </h2>
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '12px',
              })}
            >
              <div>
                <label className={labelStyle}>Key</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="billing.enabled"
                  className={inputStyle}
                />
              </div>
              <div>
                <label className={labelStyle}>Description</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Human-readable explanation"
                  className={inputStyle}
                />
              </div>
            </div>
            <div className={css({ marginBottom: '12px' })}>
              <label className={labelStyle}>Config (JSON, optional)</label>
              <textarea
                value={newConfig}
                onChange={(e) => setNewConfig(e.target.value)}
                placeholder='{"maxStudents": 1}'
                rows={3}
                className={css({
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  color: '#e6edf3',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  outline: 'none',
                  resize: 'vertical',
                  '&:focus': { borderColor: '#58a6ff' },
                })}
              />
            </div>
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
              })}
            >
              <label
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                })}
              >
                <input
                  type="checkbox"
                  checked={newEnabled}
                  onChange={(e) => setNewEnabled(e.target.checked)}
                  className={css({ cursor: 'pointer' })}
                />
                Enabled
              </label>
              <span className={css({ color: '#30363d' })}>|</span>
              <span className={css({ fontSize: '12px', color: '#8b949e' })}>Visible to:</span>
              {ALL_ROLES.map((role) => (
                <label
                  key={role}
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  })}
                >
                  <input
                    type="checkbox"
                    checked={newAllowedRoles.includes(role)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewAllowedRoles((prev) => [...prev, role])
                      } else {
                        setNewAllowedRoles((prev) => prev.filter((r) => r !== role))
                      }
                    }}
                    className={css({ cursor: 'pointer' })}
                  />
                  {role}
                </label>
              ))}
              {newAllowedRoles.length === 0 && (
                <span className={css({ fontSize: '11px', color: '#6e7681' })}>(all)</span>
              )}
              <button
                data-action="create-flag"
                onClick={handleCreate}
                disabled={!newKey.trim() || createMutation.isPending}
                className={greenButtonStyle}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              {createError && (
                <span className={css({ color: '#f85149', fontSize: '13px' })}>{createError}</span>
              )}
            </div>
          </div>

          {/* Flags table */}
          {isLoading ? (
            <div className={css({ color: '#8b949e', padding: '24px', textAlign: 'center' })}>
              Loading flags...
            </div>
          ) : flags.length === 0 ? (
            <div className={css({ color: '#8b949e', padding: '24px', textAlign: 'center' })}>
              No feature flags yet. Create one above.
            </div>
          ) : (
            <div
              data-element="flags-table"
              className={css({
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '6px',
                overflow: 'hidden',
              })}
            >
              {/* Header */}
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr 80px 1fr 80px',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: '1px solid #30363d',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#8b949e',
                  textTransform: 'uppercase',
                })}
              >
                <span>Key</span>
                <span>Description</span>
                <span>Enabled</span>
                <span>Config</span>
                <span>Actions</span>
              </div>

              {/* Rows */}
              {flags.map((flag) => (
                <div key={flag.key}>
                  <div
                    data-element="flag-row"
                    data-flag-key={flag.key}
                    className={css({
                      display: 'grid',
                      gridTemplateColumns: '1fr 2fr 80px 1fr 80px',
                      gap: '12px',
                      padding: '12px 16px',
                      borderBottom: '1px solid #21262d',
                      alignItems: 'center',
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: '#1c2128' },
                    })}
                    onClick={() => handleExpand(flag)}
                  >
                    <span
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexWrap: 'wrap',
                      })}
                    >
                      <span
                        className={css({
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          color: '#58a6ff',
                        })}
                      >
                        {flag.key}
                      </span>
                      {flag.allowedRoles &&
                        (() => {
                          try {
                            const roles = JSON.parse(flag.allowedRoles) as string[]
                            return roles.map((role) => (
                              <span
                                key={role}
                                className={css({
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  backgroundColor: '#30363d',
                                  color: '#8b949e',
                                  textTransform: 'capitalize',
                                })}
                              >
                                {role}
                              </span>
                            ))
                          } catch {
                            return null
                          }
                        })()}
                    </span>
                    <span
                      className={css({
                        fontSize: '13px',
                        color: '#8b949e',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      })}
                    >
                      {flag.description || '—'}
                    </span>
                    <span>
                      <button
                        data-action="toggle-flag"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleMutation.mutate({ key: flag.key, enabled: !flag.enabled })
                        }}
                        className={css({
                          width: '44px',
                          height: '24px',
                          borderRadius: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background-color 0.2s',
                          backgroundColor: flag.enabled ? '#238636' : '#30363d',
                        })}
                      >
                        <span
                          className={css({
                            position: 'absolute',
                            top: '2px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#ffffff',
                            transition: 'left 0.2s',
                            left: flag.enabled ? '22px' : '2px',
                          })}
                        />
                      </button>
                    </span>
                    <span
                      className={css({
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: '#8b949e',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      })}
                    >
                      {flag.config
                        ? flag.config.length > 40
                          ? flag.config.slice(0, 40) + '...'
                          : flag.config
                        : '—'}
                    </span>
                    <span>
                      {deleteConfirmKey === flag.key ? (
                        <div
                          className={css({
                            display: 'flex',
                            gap: '4px',
                          })}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            data-action="confirm-delete"
                            onClick={() => deleteMutation.mutate(flag.key)}
                            disabled={deleteMutation.isPending}
                            className={css({
                              padding: '2px 8px',
                              backgroundColor: '#da3633',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              '&:hover': { backgroundColor: '#f85149' },
                            })}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteConfirmKey(null)}
                            className={css({
                              padding: '2px 8px',
                              backgroundColor: '#30363d',
                              color: '#e6edf3',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                            })}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          data-action="delete-flag"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmKey(flag.key)
                          }}
                          className={css({
                            padding: '2px 8px',
                            backgroundColor: 'transparent',
                            color: '#f85149',
                            border: '1px solid #da3633',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: '#da363322' },
                          })}
                        >
                          Delete
                        </button>
                      )}
                    </span>
                  </div>

                  {/* Expanded edit panel */}
                  {expandedKey === flag.key && (
                    <div
                      data-element="edit-panel"
                      className={css({
                        padding: '16px',
                        backgroundColor: '#0d1117',
                        borderBottom: '1px solid #21262d',
                      })}
                    >
                      <div className={css({ marginBottom: '12px' })}>
                        <label className={labelStyle}>Description</label>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className={editInputStyle}
                        />
                      </div>
                      <div className={css({ marginBottom: '12px' })}>
                        <label className={labelStyle}>Config (JSON)</label>
                        <textarea
                          value={editConfig}
                          onChange={(e) => setEditConfig(e.target.value)}
                          rows={5}
                          className={css({
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: '#161b22',
                            border: '1px solid #30363d',
                            borderRadius: '6px',
                            color: '#e6edf3',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            outline: 'none',
                            resize: 'vertical',
                            '&:focus': { borderColor: '#58a6ff' },
                          })}
                        />
                      </div>
                      <div
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '20px',
                        })}
                      >
                        <button
                          data-action="save-edit"
                          onClick={handleSaveEdit}
                          disabled={updateMutation.isPending}
                          className={greenButtonStyle}
                        >
                          {updateMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setExpandedKey(null)} className={cancelButtonStyle}>
                          Cancel
                        </button>
                        {editError && (
                          <span className={css({ color: '#f85149', fontSize: '13px' })}>
                            {editError}
                          </span>
                        )}
                      </div>

                      {/* Access control section — who sees this flag */}
                      <div
                        data-element="access-section"
                        className={css({
                          borderTop: '1px solid #21262d',
                          paddingTop: '16px',
                        })}
                      >
                        <h3
                          className={css({
                            fontSize: '14px',
                            fontWeight: '600',
                            marginBottom: '12px',
                            color: '#e6edf3',
                          })}
                        >
                          Access
                        </h3>

                        {/* Role gating */}
                        <div className={css({ marginBottom: '16px' })}>
                          <label
                            className={css({
                              display: 'block',
                              fontSize: '12px',
                              color: '#8b949e',
                              marginBottom: '6px',
                            })}
                          >
                            Visible to roles{' '}
                            <span className={css({ color: '#6e7681' })}>
                              (none checked = all roles)
                            </span>
                          </label>
                          <div className={css({ display: 'flex', gap: '12px' })}>
                            {ALL_ROLES.map((role) => (
                              <label
                                key={role}
                                className={css({
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  textTransform: 'capitalize',
                                })}
                              >
                                <input
                                  type="checkbox"
                                  checked={editAllowedRoles.includes(role)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditAllowedRoles((prev) => [...prev, role])
                                    } else {
                                      setEditAllowedRoles((prev) => prev.filter((r) => r !== role))
                                    }
                                  }}
                                  className={css({ cursor: 'pointer' })}
                                />
                                {role}
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Per-user overrides */}
                        <div data-element="overrides-section">
                          <h4
                            className={css({
                              fontSize: '13px',
                              fontWeight: '600',
                              marginBottom: '10px',
                              color: '#8b949e',
                            })}
                          >
                            Per-User Overrides
                          </h4>

                          {/* Existing overrides list */}
                          {overridesLoading ? (
                            <div
                              className={css({
                                color: '#8b949e',
                                fontSize: '13px',
                                marginBottom: '12px',
                              })}
                            >
                              Loading overrides...
                            </div>
                          ) : overrides.length === 0 ? (
                            <div
                              className={css({
                                color: '#8b949e',
                                fontSize: '13px',
                                marginBottom: '12px',
                              })}
                            >
                              No user overrides for this flag.
                            </div>
                          ) : (
                            <div className={css({ marginBottom: '12px' })}>
                              {overrides.map((override) => (
                                <div
                                  key={override.userId}
                                  data-element="override-row"
                                  className={css({
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '8px 12px',
                                    backgroundColor: '#161b22',
                                    border: '1px solid #21262d',
                                    borderRadius: '6px',
                                    marginBottom: '6px',
                                    fontSize: '13px',
                                  })}
                                >
                                  <span
                                    className={css({
                                      flex: '1',
                                      color: '#e6edf3',
                                      fontFamily: 'monospace',
                                    })}
                                  >
                                    {override.userEmail ?? override.userId}
                                  </span>
                                  <span
                                    className={css({
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      backgroundColor: override.enabled ? '#23863633' : '#da363333',
                                      color: override.enabled ? '#3fb950' : '#f85149',
                                      border: `1px solid ${override.enabled ? '#23863666' : '#da363366'}`,
                                    })}
                                  >
                                    {override.enabled ? 'ON' : 'OFF'}
                                  </span>
                                  {override.config && (
                                    <span
                                      className={css({
                                        fontFamily: 'monospace',
                                        fontSize: '11px',
                                        color: '#8b949e',
                                        maxWidth: '200px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      })}
                                    >
                                      {override.config}
                                    </span>
                                  )}
                                  <button
                                    data-action="delete-override"
                                    onClick={() =>
                                      deleteOverrideMutation.mutate({
                                        flagKey: flag.key,
                                        userId: override.userId,
                                      })
                                    }
                                    disabled={deleteOverrideMutation.isPending}
                                    className={css({
                                      padding: '2px 8px',
                                      backgroundColor: 'transparent',
                                      color: '#f85149',
                                      border: '1px solid #da3633',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      '&:hover': { backgroundColor: '#da363322' },
                                      '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                                    })}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add override form */}
                          <div
                            data-element="add-override-form"
                            className={css({
                              display: 'flex',
                              alignItems: 'flex-end',
                              gap: '8px',
                              flexWrap: 'wrap',
                            })}
                          >
                            <div className={css({ flex: '1', minWidth: '200px' })}>
                              <label className={labelStyle}>User email</label>
                              <input
                                type="email"
                                value={overrideEmail}
                                onChange={(e) => setOverrideEmail(e.target.value)}
                                placeholder="user@example.com"
                                className={editInputStyle}
                              />
                            </div>
                            <div className={css({ minWidth: '120px' })}>
                              <label className={labelStyle}>Override config (JSON)</label>
                              <input
                                type="text"
                                value={overrideConfig}
                                onChange={(e) => setOverrideConfig(e.target.value)}
                                placeholder="null = inherit"
                                className={editInputStyle}
                              />
                            </div>
                            <label
                              className={css({
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '13px',
                                cursor: 'pointer',
                                paddingBottom: '8px',
                              })}
                            >
                              <input
                                type="checkbox"
                                checked={overrideEnabled}
                                onChange={(e) => setOverrideEnabled(e.target.checked)}
                                className={css({ cursor: 'pointer' })}
                              />
                              Enabled
                            </label>
                            <button
                              data-action="add-override"
                              onClick={handleAddOverride}
                              disabled={!overrideEmail.trim() || addOverrideMutation.isPending}
                              className={css({
                                padding: '6px 14px',
                                backgroundColor: '#238636',
                                color: '#ffffff',
                                border: '1px solid #2ea043',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                '&:hover': { backgroundColor: '#2ea043' },
                                '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                              })}
                            >
                              {addOverrideMutation.isPending ? 'Adding...' : 'Add Override'}
                            </button>
                          </div>
                          {overrideError && (
                            <div
                              className={css({
                                color: '#f85149',
                                fontSize: '13px',
                                marginTop: '6px',
                              })}
                            >
                              {overrideError}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWithNav>
  )
}
