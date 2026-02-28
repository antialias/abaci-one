'use client'

import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageWithNav } from '@/components/PageWithNav'
import { AdminNav } from '@/components/AdminNav'
import { adminSubscriptionKeys } from '@/lib/queryKeys'
import { css } from '../../../../styled-system/css'

interface UserWithSubscription {
  id: string
  email: string | null
  name: string | null
  subscription: { plan: string; status: string } | null
}

async function searchUsers(email: string): Promise<{ users: UserWithSubscription[] }> {
  const res = await fetch(`/api/admin/subscriptions?email=${encodeURIComponent(email)}`)
  if (!res.ok) throw new Error('Failed to search users')
  return res.json()
}

async function setTier(
  userId: string,
  tier: 'free' | 'family'
): Promise<{ tier: string; action: string }> {
  const res = await fetch('/api/admin/subscriptions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, tier }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function SubscriptionsClient() {
  const queryClient = useQueryClient()
  const [searchEmail, setSearchEmail] = useState('')
  const [activeSearch, setActiveSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: adminSubscriptionKeys.search(activeSearch),
    queryFn: () => searchUsers(activeSearch),
    enabled: activeSearch.length > 0,
  })

  const users = data?.users ?? []

  const tierMutation = useMutation({
    mutationFn: ({ userId, tier }: { userId: string; tier: 'free' | 'family' }) =>
      setTier(userId, tier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSubscriptionKeys.all })
    },
  })

  const handleSearch = useCallback(() => {
    const trimmed = searchEmail.trim()
    if (trimmed) {
      setActiveSearch(trimmed)
    }
  }, [searchEmail])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch()
      }
    },
    [handleSearch]
  )

  const inputStyle = css({
    flex: '1',
    padding: '8px 12px',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#e6edf3',
    fontSize: '14px',
    outline: 'none',
    '&:focus': { borderColor: '#58a6ff' },
  })

  const buttonStyle = css({
    padding: '8px 20px',
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

  return (
    <PageWithNav>
      <div
        data-component="subscriptions-admin"
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
            Subscription Tiers
          </h1>

          {/* Search bar */}
          <div
            data-element="search-bar"
            className={css({
              display: 'flex',
              gap: '8px',
              marginBottom: '24px',
            })}
          >
            <input
              type="text"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by email..."
              className={inputStyle}
            />
            <button
              data-action="search"
              onClick={handleSearch}
              disabled={!searchEmail.trim()}
              className={buttonStyle}
            >
              Search
            </button>
          </div>

          {/* Results */}
          {!activeSearch ? (
            <div
              className={css({
                color: '#8b949e',
                padding: '24px',
                textAlign: 'center',
              })}
            >
              Enter an email to search for users.
            </div>
          ) : isLoading ? (
            <div
              className={css({
                color: '#8b949e',
                padding: '24px',
                textAlign: 'center',
              })}
            >
              Searching...
            </div>
          ) : users.length === 0 ? (
            <div
              className={css({
                color: '#8b949e',
                padding: '24px',
                textAlign: 'center',
              })}
            >
              No users found matching &quot;{activeSearch}&quot;.
            </div>
          ) : (
            <div
              data-element="results-table"
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
                  gridTemplateColumns: '2fr 1fr 100px 100px 140px',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: '1px solid #30363d',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#8b949e',
                  textTransform: 'uppercase',
                })}
              >
                <span>Email</span>
                <span>Name</span>
                <span>Tier</span>
                <span>Status</span>
                <span>Action</span>
              </div>

              {/* Rows */}
              {users.map((user) => {
                const currentTier = user.subscription?.plan ?? 'free'
                const status = user.subscription?.status ?? '—'
                const isMutating =
                  tierMutation.isPending && tierMutation.variables?.userId === user.id

                return (
                  <div
                    key={user.id}
                    data-element="user-row"
                    className={css({
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 100px 100px 140px',
                      gap: '12px',
                      padding: '12px 16px',
                      borderBottom: '1px solid #21262d',
                      alignItems: 'center',
                      '&:last-child': { borderBottom: 'none' },
                    })}
                  >
                    <span
                      className={css({
                        fontSize: '13px',
                        color: '#e6edf3',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      })}
                    >
                      {user.email}
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
                      {user.name || '—'}
                    </span>
                    <span>
                      <span
                        className={css({
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: currentTier === 'family' ? '#23863633' : '#30363d',
                          color: currentTier === 'family' ? '#3fb950' : '#8b949e',
                          border: `1px solid ${currentTier === 'family' ? '#23863666' : '#30363d'}`,
                        })}
                      >
                        {currentTier}
                      </span>
                    </span>
                    <span
                      className={css({
                        fontSize: '12px',
                        color: '#8b949e',
                      })}
                    >
                      {status}
                    </span>
                    <span>
                      {currentTier === 'family' ? (
                        <button
                          data-action="reset-to-free"
                          onClick={() =>
                            tierMutation.mutate({
                              userId: user.id,
                              tier: 'free',
                            })
                          }
                          disabled={isMutating}
                          className={css({
                            padding: '4px 12px',
                            backgroundColor: 'transparent',
                            color: '#f85149',
                            border: '1px solid #da3633',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: '#da363322' },
                            '&:disabled': {
                              opacity: 0.5,
                              cursor: 'not-allowed',
                            },
                          })}
                        >
                          {isMutating ? 'Resetting...' : 'Reset to Free'}
                        </button>
                      ) : (
                        <button
                          data-action="set-family"
                          onClick={() =>
                            tierMutation.mutate({
                              userId: user.id,
                              tier: 'family',
                            })
                          }
                          disabled={isMutating}
                          className={css({
                            padding: '4px 12px',
                            backgroundColor: '#238636',
                            color: '#ffffff',
                            border: '1px solid #2ea043',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: '#2ea043' },
                            '&:disabled': {
                              opacity: 0.5,
                              cursor: 'not-allowed',
                            },
                          })}
                        >
                          {isMutating ? 'Setting...' : 'Set Family'}
                        </button>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Mutation feedback */}
          {tierMutation.isSuccess && (
            <div
              data-element="success-feedback"
              className={css({
                marginTop: '12px',
                padding: '8px 12px',
                backgroundColor: '#23863622',
                border: '1px solid #23863644',
                borderRadius: '6px',
                color: '#3fb950',
                fontSize: '13px',
              })}
            >
              Tier updated: {tierMutation.data.tier} ({tierMutation.data.action})
            </div>
          )}
          {tierMutation.isError && (
            <div
              data-element="error-feedback"
              className={css({
                marginTop: '12px',
                padding: '8px 12px',
                backgroundColor: '#da363322',
                border: '1px solid #da363344',
                borderRadius: '6px',
                color: '#f85149',
                fontSize: '13px',
              })}
            >
              Error: {tierMutation.error.message}
            </div>
          )}
        </div>
      </div>
    </PageWithNav>
  )
}
