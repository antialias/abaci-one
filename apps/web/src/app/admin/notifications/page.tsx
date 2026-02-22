'use client'

import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageWithNav } from '@/components/PageWithNav'
import { AdminNav } from '@/components/AdminNav'
import { useTheme } from '@/contexts/ThemeContext'
import { api } from '@/lib/queryClient'
import { css } from '../../../../styled-system/css'

interface NotificationChannelsConfig {
  webPush: { enabled: boolean }
  email: { enabled: boolean; fromName?: string; replyTo?: string }
  inApp: { enabled: boolean }
}

const configKeys = {
  all: ['admin-notifications'] as const,
  config: () => [...configKeys.all, 'config'] as const,
}

async function fetchConfig(): Promise<NotificationChannelsConfig> {
  const res = await api('admin/notifications')
  if (!res.ok) throw new Error('Failed to fetch notification config')
  return res.json()
}

async function updateConfig(
  config: NotificationChannelsConfig
): Promise<NotificationChannelsConfig> {
  const res = await api('admin/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || 'Failed to update config')
  }
  return res.json()
}

async function sendTest(body: {
  channel: string
  targetEmail?: string
}): Promise<{ success: boolean; error?: string }> {
  const res = await api('admin/notifications/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export default function AdminNotificationsPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const queryClient = useQueryClient()

  const { data: config, isLoading } = useQuery({
    queryKey: configKeys.config(),
    queryFn: fetchConfig,
    staleTime: 5 * 60 * 1000,
  })

  // Local form state
  const [localConfig, setLocalConfig] = useState<NotificationChannelsConfig | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testResult, setTestResult] = useState<{ channel: string; message: string } | null>(null)

  if (config && !initialized) {
    setLocalConfig(config)
    setInitialized(true)
  }

  const mutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: (data) => {
      queryClient.setQueryData(configKeys.config(), data)
      setLocalConfig(data)
    },
  })

  const testMutation = useMutation({
    mutationFn: sendTest,
    onSuccess: (data, variables) => {
      setTestResult({
        channel: variables.channel,
        message: data.success ? 'Test sent!' : `Failed: ${data.error}`,
      })
    },
    onError: (err, variables) => {
      setTestResult({
        channel: variables.channel,
        message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    },
  })

  const hasChanges =
    config &&
    localConfig &&
    JSON.stringify(config) !== JSON.stringify(localConfig)

  const handleToggle = useCallback(
    (channel: 'webPush' | 'email' | 'inApp') => {
      if (!localConfig) return
      setLocalConfig({
        ...localConfig,
        [channel]: {
          ...localConfig[channel],
          enabled: !localConfig[channel].enabled,
        },
      })
    },
    [localConfig]
  )

  const handleEmailField = useCallback(
    (field: 'fromName' | 'replyTo', value: string) => {
      if (!localConfig) return
      setLocalConfig({
        ...localConfig,
        email: {
          ...localConfig.email,
          [field]: value || undefined,
        },
      })
    },
    [localConfig]
  )

  const handleSave = useCallback(() => {
    if (localConfig) mutation.mutate(localConfig)
  }, [localConfig, mutation])

  const handleReset = useCallback(() => {
    if (config) setLocalConfig(config)
  }, [config])

  const handleTest = useCallback(
    (channel: 'webPush' | 'email' | 'inApp') => {
      setTestResult(null)
      testMutation.mutate({
        channel,
        targetEmail: channel === 'email' ? testEmail : undefined,
      })
    },
    [testEmail, testMutation]
  )

  const cardStyle = css({
    backgroundColor: isDark ? 'gray.800' : 'white',
    borderRadius: '12px',
    border: '1px solid',
    borderColor: isDark ? 'gray.700' : 'gray.200',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  })

  const labelStyle = css({
    fontWeight: '600',
    color: isDark ? 'white' : 'gray.800',
  })

  const secondaryText = css({
    fontSize: '0.875rem',
    color: isDark ? 'gray.400' : 'gray.600',
  })

  return (
    <PageWithNav>
      <div className={css({ paddingTop: '56px' })}>
        <AdminNav />
      </div>
      <main
        data-component="admin-notifications"
        className={css({
          minHeight: 'calc(100vh - 110px)',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '2rem',
        })}
      >
        <div className={css({ maxWidth: '600px', margin: '0 auto' })}>
          <header className={css({ marginBottom: '2rem' })}>
            <h1
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
              })}
            >
              Notification Channels
            </h1>
            <p className={css({ color: isDark ? 'gray.400' : 'gray.600', marginTop: '0.5rem' })}>
              Enable or disable notification channels globally. Disabled channels will not deliver
              notifications even if subscribers have them enabled.
            </p>
          </header>

          {isLoading || !localConfig ? (
            <p className={css({ color: isDark ? 'gray.500' : 'gray.500' })}>Loading...</p>
          ) : (
            <>
              {/* Channel toggles */}
              {(['webPush', 'email', 'inApp'] as const).map((channel) => {
                const labels: Record<string, { title: string; desc: string }> = {
                  webPush: {
                    title: 'Web Push',
                    desc: 'Browser push notifications via VAPID. Requires VAPID keys to be configured.',
                  },
                  email: {
                    title: 'Email',
                    desc: 'Email notifications via Nodemailer/SMTP. Uses the EMAIL_SERVER env var.',
                  },
                  inApp: {
                    title: 'In-App',
                    desc: 'Real-time toast notifications via Socket.IO for users with the app open.',
                  },
                }
                const { title, desc } = labels[channel]
                const enabled = localConfig[channel].enabled

                return (
                  <div key={channel} data-element={`channel-${channel}`} className={cardStyle}>
                    <div
                      className={css({
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem',
                      })}
                    >
                      <span className={labelStyle}>{title}</span>
                      <button
                        type="button"
                        onClick={() => handleToggle(channel)}
                        data-action={`toggle-${channel}`}
                        className={css({
                          position: 'relative',
                          width: '44px',
                          height: '24px',
                          borderRadius: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: enabled
                            ? '#238636'
                            : isDark
                              ? '#30363d'
                              : '#d1d5db',
                          transition: 'background-color 0.2s',
                        })}
                      >
                        <span
                          className={css({
                            position: 'absolute',
                            top: '2px',
                            left: enabled ? '22px' : '2px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            transition: 'left 0.2s',
                          })}
                        />
                      </button>
                    </div>
                    <p className={secondaryText}>{desc}</p>

                    {/* Email-specific fields */}
                    {channel === 'email' && enabled && (
                      <div className={css({ marginTop: '1rem' })}>
                        <div className={css({ marginBottom: '0.75rem' })}>
                          <label className={css({ display: 'block', marginBottom: '0.25rem' })}>
                            <span className={secondaryText}>From Name (optional)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Abaci One"
                            value={(localConfig.email as { fromName?: string }).fromName ?? ''}
                            onChange={(e) => handleEmailField('fromName', e.target.value)}
                            data-element="email-from-name"
                            className={css({
                              width: '100%',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: isDark ? 'gray.600' : 'gray.300',
                              backgroundColor: isDark ? 'gray.700' : 'white',
                              color: isDark ? 'white' : 'gray.800',
                              fontSize: '0.875rem',
                            })}
                          />
                        </div>
                        <div>
                          <label className={css({ display: 'block', marginBottom: '0.25rem' })}>
                            <span className={secondaryText}>Reply-To (optional)</span>
                          </label>
                          <input
                            type="email"
                            placeholder="hallock@gmail.com"
                            value={(localConfig.email as { replyTo?: string }).replyTo ?? ''}
                            onChange={(e) => handleEmailField('replyTo', e.target.value)}
                            data-element="email-reply-to"
                            className={css({
                              width: '100%',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: isDark ? 'gray.600' : 'gray.300',
                              backgroundColor: isDark ? 'gray.700' : 'white',
                              color: isDark ? 'white' : 'gray.800',
                              fontSize: '0.875rem',
                            })}
                          />
                        </div>
                      </div>
                    )}

                    {/* Test button */}
                    {enabled && (
                      <div className={css({ marginTop: '1rem' })}>
                        {channel === 'email' && (
                          <div className={css({ marginBottom: '0.5rem' })}>
                            <input
                              type="email"
                              placeholder="Test email address"
                              value={testEmail}
                              onChange={(e) => setTestEmail(e.target.value)}
                              data-element="test-email-input"
                              className={css({
                                width: '100%',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: isDark ? 'gray.600' : 'gray.300',
                                backgroundColor: isDark ? 'gray.700' : 'white',
                                color: isDark ? 'white' : 'gray.800',
                                fontSize: '0.875rem',
                              })}
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleTest(channel)}
                          disabled={
                            testMutation.isPending ||
                            (channel === 'email' && !testEmail)
                          }
                          data-action={`test-${channel}`}
                          className={css({
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.8125rem',
                            borderRadius: '6px',
                            border: '1px solid',
                            borderColor: isDark ? 'gray.600' : 'gray.300',
                            backgroundColor: isDark ? '#21262d' : 'gray.100',
                            color: isDark ? '#c9d1d9' : 'gray.700',
                            cursor: 'pointer',
                            _hover: {
                              backgroundColor: isDark ? '#30363d' : 'gray.200',
                            },
                          })}
                        >
                          {testMutation.isPending ? 'Sending...' : `Send Test ${title}`}
                        </button>
                        {testResult?.channel === channel && (
                          <span
                            className={css({
                              marginLeft: '0.75rem',
                              fontSize: '0.8125rem',
                              color: testResult.message.startsWith('Test')
                                ? 'green.500'
                                : 'red.400',
                            })}
                          >
                            {testResult.message}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Save / Reset */}
              <div
                className={css({
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                })}
              >
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasChanges || mutation.isPending}
                  data-action="save-config"
                  className={css({
                    padding: '0.5rem 1rem',
                    backgroundColor: hasChanges ? 'blue.500' : isDark ? 'gray.700' : 'gray.300',
                    color: hasChanges ? 'white' : isDark ? 'gray.500' : 'gray.500',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: hasChanges ? 'pointer' : 'not-allowed',
                    _hover: hasChanges ? { backgroundColor: 'blue.600' } : {},
                  })}
                >
                  {mutation.isPending ? 'Saving...' : 'Save'}
                </button>
                {hasChanges && (
                  <button
                    type="button"
                    onClick={handleReset}
                    data-action="reset-config"
                    className={css({
                      padding: '0.5rem 1rem',
                      backgroundColor: 'transparent',
                      color: isDark ? 'gray.400' : 'gray.600',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isDark ? 'gray.600' : 'gray.300',
                      cursor: 'pointer',
                      _hover: { borderColor: isDark ? 'gray.500' : 'gray.400' },
                    })}
                  >
                    Reset
                  </button>
                )}
                {hasChanges && (
                  <span className={css({ fontSize: '0.875rem', color: 'orange.500' })}>
                    Unsaved changes
                  </span>
                )}
              </div>

              {mutation.isError && (
                <p
                  className={css({
                    color: 'red.500',
                    fontSize: '0.875rem',
                    marginTop: '0.75rem',
                  })}
                >
                  {mutation.error instanceof Error
                    ? mutation.error.message
                    : 'Failed to update config'}
                </p>
              )}

              {mutation.isSuccess && !hasChanges && (
                <p
                  className={css({
                    color: 'green.500',
                    fontSize: '0.875rem',
                    marginTop: '0.75rem',
                  })}
                >
                  Configuration saved.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </PageWithNav>
  )
}
