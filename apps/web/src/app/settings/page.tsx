'use client'

import { useAbacusDisplay } from '@soroban/abacus-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CreditCard,
  Crown,
  Home,
  Key,
  Languages,
  LogOut,
  Mail,
  Palette,
  Settings as SettingsIcon,
  Smartphone,
  UserPlus,
  Users,
  Volume2,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { AbacusStylePanel } from '@/components/AbacusDisplayDropdown'
import { AbacusDock } from '@/components/AbacusDock'
import { LanguageSelector } from '@/components/LanguageSelector'
import { PageWithNav } from '@/components/PageWithNav'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAudioManager } from '@/hooks/useAudioManager'
import { useHouseholds, useHousehold, useHouseholdMutations } from '@/hooks/useHousehold'
import { useUserId } from '@/hooks/useUserId'
import { useFamilyCoverage, useTier } from '@/hooks/useTier'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useTheme } from '@/contexts/ThemeContext'
import { billingKeys, notificationSubscriptionKeys } from '@/lib/queryKeys'
import { api } from '@/lib/queryClient'
import { css } from '../../../styled-system/css'

type TabId = 'general' | 'abacus' | 'billing' | 'household' | 'notifications' | 'mcp-keys'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  { id: 'general', label: 'General', icon: <SettingsIcon size={16} /> },
  { id: 'abacus', label: 'Abacus Style', icon: <Palette size={16} /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard size={16} /> },
  { id: 'household', label: 'Household', icon: <Home size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
  { id: 'mcp-keys', label: 'MCP Keys', icon: <Key size={16} /> },
]

/**
 * User settings page for managing preferences across the app.
 */
export default function SettingsPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const searchParams = useSearchParams()
  const initialTab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? (searchParams.get('tab') as TabId)
    : 'general'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  return (
    <PageWithNav>
      <main
        data-component="settings-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '2rem',
        })}
      >
        <div className={css({ maxWidth: '700px', margin: '0 auto' })}>
          {/* Header */}
          <header data-element="settings-header" className={css({ marginBottom: '1.5rem' })}>
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '0.5rem',
              })}
            >
              <SettingsIcon
                size={28}
                className={css({ color: isDark ? 'purple.400' : 'purple.600' })}
              />
              <h1
                className={css({
                  fontSize: '1.75rem',
                  fontWeight: 'bold',
                  color: isDark ? 'white' : 'gray.800',
                })}
              >
                Settings
              </h1>
            </div>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Customize your Abaci One experience
            </p>
          </header>

          {/* Tab Navigation */}
          <div
            data-element="tab-navigation"
            className={css({
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              borderBottom: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              paddingBottom: '0',
            })}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                data-tab={tab.id}
                data-active={activeTab === tab.id}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color:
                    activeTab === tab.id
                      ? isDark
                        ? 'purple.400'
                        : 'purple.600'
                      : isDark
                        ? 'gray.400'
                        : 'gray.600',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: '2px solid',
                  borderColor:
                    activeTab === tab.id ? (isDark ? 'purple.400' : 'purple.600') : 'transparent',
                  marginBottom: '-1px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: {
                    color: isDark ? 'purple.300' : 'purple.700',
                  },
                })}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'general' && <GeneralTab isDark={isDark} />}
          {activeTab === 'abacus' && <AbacusTab isDark={isDark} />}
          {activeTab === 'billing' && <BillingTab isDark={isDark} />}
          {activeTab === 'household' && <HouseholdTab isDark={isDark} />}
          {activeTab === 'notifications' && <NotificationsTab isDark={isDark} />}
          {activeTab === 'mcp-keys' && <McpKeysTab isDark={isDark} />}
        </div>
      </main>
    </PageWithNav>
  )
}

/**
 * General settings tab - Theme, Language
 */
function GeneralTab({ isDark }: { isDark: boolean }) {
  const { isEnabled, setEnabled, volume, setVolume } = useAudioManager()

  return (
    <div data-section="general-tab">
      {/* Appearance Section */}
      <section className={css({ marginBottom: '1.5rem' })}>
        <SectionCard isDark={isDark}>
          <SectionHeader icon={<Palette size={18} />} title="Appearance" isDark={isDark} />
          <SettingRow
            label="Theme"
            description="Choose between light and dark mode"
            isDark={isDark}
            noBorder
          >
            <ThemeToggle />
          </SettingRow>
        </SectionCard>
      </section>

      {/* Language Section */}
      <section className={css({ marginBottom: '1.5rem' })}>
        <SectionCard isDark={isDark}>
          <SectionHeader icon={<Languages size={18} />} title="Language" isDark={isDark} />
          <SettingRow
            label="Display Language"
            description="Choose your preferred language"
            isDark={isDark}
            noBorder
          >
            <LanguageSelector variant="inline" />
          </SettingRow>
        </SectionCard>
      </section>

      {/* Audio Help Section */}
      <section className={css({ marginBottom: '1.5rem' })}>
        <SectionCard isDark={isDark}>
          <SectionHeader icon={<Volume2 size={18} />} title="Audio Help" isDark={isDark} />
          <SettingRow
            label="Read Problems Aloud"
            description="Read math problems and feedback aloud for non-readers"
            isDark={isDark}
          >
            <button
              type="button"
              data-component="audio-help-toggle"
              data-action="toggle-audio-help"
              onClick={() => setEnabled(!isEnabled)}
              className={css({
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                backgroundColor: isEnabled
                  ? isDark
                    ? 'purple.500'
                    : 'purple.600'
                  : isDark
                    ? 'gray.600'
                    : 'gray.300',
                transition: 'background-color 0.2s',
              })}
            >
              <span
                className={css({
                  display: 'block',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  position: 'absolute',
                  top: '3px',
                  transition: 'left 0.2s',
                  left: isEnabled ? '23px' : '3px',
                })}
              />
            </button>
          </SettingRow>
          {isEnabled && (
            <SettingRow
              label="Volume"
              description="Adjust the audio help volume"
              isDark={isDark}
              noBorder
            >
              <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(volume * 100)}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  data-component="audio-help-volume"
                  data-action="change-volume"
                  className={css({
                    width: '100px',
                    cursor: 'pointer',
                    accentColor: isDark ? 'purple.400' : 'purple.600',
                  })}
                />
                <span
                  className={css({
                    fontSize: '0.75rem',
                    color: isDark ? 'gray.400' : 'gray.600',
                    minWidth: '2rem',
                    textAlign: 'right',
                  })}
                >
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </SettingRow>
          )}
        </SectionCard>
      </section>
    </div>
  )
}

/**
 * Abacus Style tab - Full abacus customization
 */
function AbacusTab({ isDark }: { isDark: boolean }) {
  const { requestDock, undock, dock } = useMyAbacus()
  const { config } = useAbacusDisplay()

  // Auto-dock when this tab mounts, auto-undock when it unmounts
  useEffect(() => {
    // Small delay to ensure dock is registered before requesting
    const timer = setTimeout(() => {
      requestDock()
    }, 100)

    return () => {
      clearTimeout(timer)
      undock()
    }
  }, [requestDock, undock])

  return (
    <div
      data-section="abacus-tab"
      className={css({
        display: 'flex',
        flexDirection: { base: 'column', lg: 'row' },
        gap: '1.5rem',
        alignItems: { base: 'stretch', lg: 'flex-start' },
      })}
    >
      {/* Settings Panel - Primary content */}
      <div className={css({ flex: 1, minWidth: 0 })}>
        <SectionCard isDark={isDark}>
          <div className={css({ padding: '1rem 0' })}>
            <AbacusStylePanel isDark={isDark} showHeader={true} />
          </div>
        </SectionCard>
      </div>

      {/* Live Preview - Sticky sidebar with AbacusDock */}
      <div
        className={css({
          width: { base: '100%', lg: '220px' },
          flexShrink: 0,
          position: 'sticky',
          top: '5rem',
          alignSelf: 'flex-start',
          order: { base: -1, lg: 0 },
        })}
      >
        <div
          data-element="abacus-preview"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <span
            className={css({
              fontSize: '0.625rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: isDark ? 'gray.500' : 'gray.400',
            })}
          >
            Preview
          </span>
          <AbacusDock
            id="settings-preview"
            columns={config.physicalAbacusColumns}
            interactive
            showNumbers={false}
            hideUndock
            className={css({
              width: '180px',
              height: '240px',
            })}
          />
          {!dock && (
            <p
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'gray.500' : 'gray.400',
                textAlign: 'center',
              })}
            >
              Abacus will dock here
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Billing Tab - Subscription Management
// ============================================

function BillingTab({ isDark }: { isDark: boolean }) {
  const { tier, limits } = useTier()
  const { isCovered, coveredBy, coveredChildCount, totalChildCount } = useFamilyCoverage()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const billingResult = searchParams.get('billing')
  const sessionId = searchParams.get('session_id')

  // On success redirect, verify the checkout session to sync the subscription
  // locally. This means we don't depend on webhooks reaching the server
  // (critical for local dev, and good defense-in-depth for production).
  useEffect(() => {
    if (billingResult !== 'success' || !sessionId) return
    api('billing/checkout/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: billingKeys.tier() })
    })
  }, [billingResult, sessionId, queryClient])

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await api('billing/portal', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to open billing portal')
      const data = await res.json()
      return data.url as string
    },
    onSuccess: (url) => {
      window.location.href = url
    },
  })

  const isFamily = tier === 'family'
  const tierLabel = tier === 'family' ? 'Family' : tier === 'guest' ? 'Guest' : 'Free'

  return (
    <div data-section="billing-tab">
      {/* Success/cancel banners from Stripe redirect */}
      {billingResult === 'success' && (
        <div
          className={css({
            backgroundColor: isDark ? 'green.900/50' : 'green.50',
            border: '1px solid',
            borderColor: isDark ? 'green.700' : 'green.200',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            color: isDark ? 'green.300' : 'green.800',
          })}
        >
          Subscription activated! You now have access to the Family plan.
        </div>
      )}
      {billingResult === 'canceled' && (
        <div
          className={css({
            backgroundColor: isDark ? 'yellow.900/50' : 'yellow.50',
            border: '1px solid',
            borderColor: isDark ? 'yellow.700' : 'yellow.200',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            color: isDark ? 'yellow.300' : 'yellow.800',
          })}
        >
          Checkout was cancelled. No charges were made.
        </div>
      )}

      {/* Current Plan */}
      <SectionCard isDark={isDark}>
        <SectionHeader icon={<CreditCard size={18} />} title="Current Plan" isDark={isDark} />
        <SettingRow
          label="Plan"
          description={
            isFamily
              ? 'Unlimited students, 20-min sessions, unlimited weekly sessions'
              : '1 student, 10-min sessions, 5 sessions per week'
          }
          isDark={isDark}
          noBorder={!isFamily && !isCovered}
        >
          <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                fontWeight: '600',
                backgroundColor: isFamily
                  ? isDark
                    ? 'purple.900/50'
                    : 'purple.50'
                  : isDark
                    ? 'gray.700'
                    : 'gray.100',
                color: isFamily
                  ? isDark
                    ? 'purple.300'
                    : 'purple.700'
                  : isDark
                    ? 'gray.300'
                    : 'gray.600',
              })}
            >
              {tierLabel}
            </span>
            {isCovered && tier !== 'family' && (
              <span
                data-element="covered-badge"
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                  backgroundColor: isDark ? 'blue.900/50' : 'blue.50',
                  color: isDark ? 'blue.300' : 'blue.700',
                })}
              >
                Covered
              </span>
            )}
          </div>
        </SettingRow>

        {isCovered && tier !== 'family' && coveredBy && (
          <SettingRow
            label="Family Coverage"
            description={`${coveredChildCount} of ${totalChildCount} student${totalChildCount !== 1 ? 's' : ''} covered by ${coveredBy.name}'s Family Plan`}
            isDark={isDark}
            noBorder={!isFamily}
          >
            <span
              className={css({
                fontSize: '0.8125rem',
                color: isDark ? 'blue.300' : 'blue.700',
              })}
            />
          </SettingRow>
        )}

        {isFamily ? (
          <SettingRow
            label="Manage Subscription"
            description="Update payment method, view invoices, or cancel"
            isDark={isDark}
            noBorder
          >
            <button
              type="button"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              data-action="open-billing-portal"
              className={css({
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                backgroundColor: 'transparent',
                color: isDark ? 'white' : 'gray.800',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                _hover: {
                  backgroundColor: isDark ? 'gray.700' : 'gray.50',
                },
                _disabled: {
                  opacity: 0.6,
                  cursor: 'not-allowed',
                },
              })}
            >
              {portalMutation.isPending ? 'Opening...' : 'Manage in Stripe'}
            </button>
          </SettingRow>
        ) : isCovered && coveredBy ? (
          <SettingRow
            label="Upgrade"
            description={`Your students already have Family-tier access via ${coveredBy.name}`}
            isDark={isDark}
            noBorder
          >
            <Link
              href="/pricing"
              data-action="view-pricing"
              className={css({
                display: 'inline-block',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                color: isDark ? 'gray.400' : 'gray.500',
                fontSize: '0.875rem',
                fontWeight: '500',
                textDecoration: 'none',
                _hover: {
                  backgroundColor: isDark ? 'gray.700' : 'gray.50',
                },
              })}
            >
              View Plans
            </Link>
          </SettingRow>
        ) : (
          <SettingRow
            label="Upgrade"
            description="Get unlimited students, longer sessions, and more"
            isDark={isDark}
            noBorder
          >
            <Link
              href="/pricing"
              data-action="view-pricing"
              className={css({
                display: 'inline-block',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                backgroundColor: isDark ? 'purple.600' : 'purple.500',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600',
                textDecoration: 'none',
                _hover: {
                  backgroundColor: isDark ? 'purple.500' : 'purple.600',
                },
              })}
            >
              View Plans
            </Link>
          </SettingRow>
        )}
      </SectionCard>

      {/* Usage summary */}
      <div className={css({ marginTop: '1.5rem' })}>
        <SectionCard isDark={isDark}>
          <SectionHeader icon={<SettingsIcon size={18} />} title="Current Limits" isDark={isDark} />
          <SettingRow label="Students" isDark={isDark}>
            <span
              className={css({ fontSize: '0.875rem', color: isDark ? 'gray.300' : 'gray.700' })}
            >
              {limits.maxPracticeStudents === null ? 'Unlimited' : limits.maxPracticeStudents}
            </span>
          </SettingRow>
          <SettingRow label="Session duration" isDark={isDark}>
            <span
              className={css({ fontSize: '0.875rem', color: isDark ? 'gray.300' : 'gray.700' })}
            >
              Up to {limits.maxSessionMinutes} min
            </span>
          </SettingRow>
          <SettingRow label="Sessions per week" isDark={isDark}>
            <span
              className={css({ fontSize: '0.875rem', color: isDark ? 'gray.300' : 'gray.700' })}
            >
              {limits.maxSessionsPerWeek === null ? 'Unlimited' : limits.maxSessionsPerWeek}
            </span>
          </SettingRow>
          <SettingRow label="Worksheet parsing" isDark={isDark} noBorder>
            <span
              className={css({ fontSize: '0.875rem', color: isDark ? 'gray.300' : 'gray.700' })}
            >
              {limits.maxOfflineParsingPerMonth}/month
            </span>
          </SettingRow>
        </SectionCard>
      </div>
    </div>
  )
}

// ============================================
// Household Tab - Manage Household Membership
// ============================================

function HouseholdTab({ isDark }: { isDark: boolean }) {
  const { data: households, isLoading } = useHouseholds()
  const { data: currentUserId } = useUserId()
  const { tier } = useTier()
  const [createName, setCreateName] = useState('')
  const { create } = useHouseholdMutations()

  if (isLoading) {
    return (
      <div data-section="household-tab">
        <SectionCard isDark={isDark}>
          <div className={css({ padding: '2rem 0', textAlign: 'center' })}>
            <p className={css({ color: isDark ? 'gray.500' : 'gray.500' })}>Loading...</p>
          </div>
        </SectionCard>
      </div>
    )
  }

  const hasHouseholds = households && households.length > 0
  const ownsAHousehold = households?.some((h) => h.role === 'owner') ?? false

  return (
    <div data-section="household-tab">
      {/* Info blurb */}
      <div
        className={css({
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: isDark ? 'blue.900/30' : 'blue.50',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: isDark ? 'blue.800' : 'blue.100',
        })}
      >
        <p className={css({ fontSize: '0.875rem', color: isDark ? 'blue.200' : 'blue.800' })}>
          A household shares a single Family subscription across multiple adults.
          When parents link to the same children via family codes, they are
          automatically added to a household.
        </p>
      </div>

      {/* Existing households */}
      {hasHouseholds ? (
        households.map((h) => (
          <HouseholdCard key={h.id} household={h} isDark={isDark} currentUserId={currentUserId ?? undefined} />
        ))
      ) : (
        <SectionCard isDark={isDark}>
          <SectionHeader icon={<Home size={18} />} title="No Household" isDark={isDark} />
          <div className={css({ padding: '1.5rem 0' })}>
            <p className={css({ color: isDark ? 'gray.400' : 'gray.600', marginBottom: '1rem' })}>
              {tier === 'family'
                ? 'Create a household to share your Family plan with other parents.'
                : 'Households are automatically created when parents share children via family codes. You can also create one manually.'}
            </p>
          </div>
        </SectionCard>
      )}

      {/* Create household form — only shown if user doesn't already own one */}
      {!ownsAHousehold && <div className={css({ marginTop: '1.5rem' })}>
        <SectionCard isDark={isDark}>
          <SectionHeader icon={<UserPlus size={18} />} title="Create Household" isDark={isDark} />
          <div
            className={css({
              display: 'flex',
              gap: '0.75rem',
              padding: '1rem 0',
            })}
          >
            <input
              type="text"
              placeholder="Household name (e.g. The Smith Family)"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && createName.trim()) {
                  create.mutate(createName.trim(), { onSuccess: () => setCreateName('') })
                }
              }}
              data-element="household-name-input"
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
              onClick={() => {
                if (createName.trim()) {
                  create.mutate(createName.trim(), { onSuccess: () => setCreateName('') })
                }
              }}
              disabled={!createName.trim() || create.isPending}
              data-action="create-household"
              className={css({
                padding: '0.75rem 1.5rem',
                backgroundColor: createName.trim() ? (isDark ? 'purple.600' : 'purple.500') : isDark ? 'gray.700' : 'gray.300',
                color: createName.trim() ? 'white' : isDark ? 'gray.500' : 'gray.500',
                borderRadius: '6px',
                border: 'none',
                fontWeight: '600',
                cursor: createName.trim() ? 'pointer' : 'not-allowed',
                _hover: createName.trim() ? { backgroundColor: isDark ? 'purple.500' : 'purple.600' } : {},
              })}
            >
              {create.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
          {create.isError && (
            <p className={css({ color: 'red.500', fontSize: '0.875rem', paddingBottom: '1rem' })}>
              {create.error.message}
            </p>
          )}
        </SectionCard>
      </div>}
    </div>
  )
}

/**
 * Displays a single household with its members.
 */
function HouseholdCard({
  household,
  isDark,
  currentUserId,
}: {
  household: { id: string; name: string; ownerId: string; role: 'owner' | 'member'; memberCount: number }
  isDark: boolean
  currentUserId?: string
}) {
  const { data: detail, isLoading } = useHousehold(household.id)
  const { addMember, removeMember, rename, transferOwnership } = useHouseholdMutations()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(household.name)
  const [addEmail, setAddEmail] = useState('')
  const isOwner = household.role === 'owner'

  return (
    <div className={css({ marginBottom: '1.5rem' })}>
      <SectionCard isDark={isDark}>
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 0',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
            <Home size={18} className={css({ color: isDark ? 'purple.400' : 'purple.600' })} />
            {isEditing ? (
              <div className={css({ display: 'flex', gap: '0.5rem', alignItems: 'center' })}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editName.trim()) {
                      rename.mutate(
                        { householdId: household.id, name: editName.trim() },
                        { onSuccess: () => setIsEditing(false) }
                      )
                    }
                    if (e.key === 'Escape') {
                      setEditName(household.name)
                      setIsEditing(false)
                    }
                  }}
                  className={css({
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.300',
                    backgroundColor: isDark ? 'gray.700' : 'white',
                    color: isDark ? 'white' : 'gray.800',
                    fontSize: '0.875rem',
                  })}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (editName.trim()) {
                      rename.mutate(
                        { householdId: household.id, name: editName.trim() },
                        { onSuccess: () => setIsEditing(false) }
                      )
                    }
                  }}
                  className={css({
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: isDark ? 'purple.600' : 'purple.500',
                    color: 'white',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  })}
                >
                  Save
                </button>
              </div>
            ) : (
              <h3
                className={css({
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isDark ? 'gray.400' : 'gray.500',
                  cursor: isOwner ? 'pointer' : 'default',
                })}
                onClick={() => isOwner && setIsEditing(true)}
                title={isOwner ? 'Click to rename' : undefined}
              >
                {household.name}
              </h3>
            )}
          </div>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                backgroundColor: isOwner
                  ? isDark ? 'purple.900/50' : 'purple.50'
                  : isDark ? 'gray.700' : 'gray.100',
                color: isOwner
                  ? isDark ? 'purple.300' : 'purple.700'
                  : isDark ? 'gray.300' : 'gray.600',
              })}
            >
              {isOwner && <Crown size={12} />}
              {isOwner ? 'Owner' : 'Member'}
            </span>
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                backgroundColor: isDark ? 'gray.700' : 'gray.100',
                color: isDark ? 'gray.300' : 'gray.600',
              })}
            >
              <Users size={12} />
              {household.memberCount}/10
            </span>
          </div>
        </div>

        {/* Member list */}
        {isLoading ? (
          <div className={css({ padding: '1rem 0' })}>
            <p className={css({ color: isDark ? 'gray.500' : 'gray.500', fontSize: '0.875rem' })}>
              Loading members...
            </p>
          </div>
        ) : detail ? (
          <div data-element="household-members">
            {detail.members.map((member) => (
              <div
                key={member.userId}
                data-element="household-member-row"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  _last: { borderBottom: 'none' },
                })}
              >
                <div className={css({ display: 'flex', alignItems: 'center', gap: '0.75rem' })}>
                  {member.image ? (
                    <img
                      src={member.image}
                      alt=""
                      className={css({
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                      })}
                    />
                  ) : (
                    <div
                      className={css({
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: isDark ? 'gray.600' : 'gray.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        color: isDark ? 'gray.400' : 'gray.500',
                      })}
                    >
                      {(member.name || member.email || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div
                      className={css({
                        fontWeight: '500',
                        color: isDark ? 'white' : 'gray.800',
                        fontSize: '0.875rem',
                      })}
                    >
                      {member.name || member.email || 'Unknown'}
                    </div>
                    {member.email && member.name && (
                      <div
                        className={css({
                          fontSize: '0.75rem',
                          color: isDark ? 'gray.500' : 'gray.500',
                        })}
                      >
                        {member.email}
                      </div>
                    )}
                  </div>
                  {member.role === 'owner' && (
                    <Crown
                      size={14}
                      className={css({ color: isDark ? 'yellow.400' : 'yellow.600' })}
                    />
                  )}
                </div>
                <div className={css({ display: 'flex', gap: '0.5rem' })}>
                  {isOwner && member.role !== 'owner' && (
                    <>
                      <button
                        type="button"
                        data-action="transfer-ownership"
                        onClick={() => transferOwnership.mutate({ householdId: household.id, newOwnerId: member.userId })}
                        disabled={transferOwnership.isPending}
                        title="Transfer ownership"
                        className={css({
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: isDark ? 'gray.600' : 'gray.300',
                          backgroundColor: 'transparent',
                          color: isDark ? 'gray.400' : 'gray.600',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          _hover: { backgroundColor: isDark ? 'gray.700' : 'gray.50' },
                        })}
                      >
                        Make Owner
                      </button>
                      <button
                        type="button"
                        data-action="remove-member"
                        onClick={() => removeMember.mutate({ householdId: household.id, userId: member.userId })}
                        disabled={removeMember.isPending}
                        title="Remove from household"
                        className={css({
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: isDark ? 'red.400/50' : 'red.200',
                          backgroundColor: 'transparent',
                          color: isDark ? 'red.400' : 'red.600',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          _hover: { backgroundColor: isDark ? 'red.900/30' : 'red.50' },
                        })}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Add member by email (owner only) */}
        {isOwner && (
          <div
            data-element="add-member-form"
            className={css({
              padding: '1rem 0',
              borderTop: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
            })}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const email = addEmail.trim()
                if (!email) return
                addMember.mutate(
                  { householdId: household.id, email },
                  { onSuccess: () => setAddEmail('') }
                )
              }}
              className={css({ display: 'flex', gap: '0.5rem', alignItems: 'center' })}
            >
              <UserPlus size={16} className={css({ color: isDark ? 'gray.500' : 'gray.400', flexShrink: 0 })} />
              <input
                type="email"
                placeholder="Add member by email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className={css({
                  flex: 1,
                  padding: '0.375rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  color: isDark ? 'white' : 'gray.800',
                  fontSize: '0.875rem',
                  outline: 'none',
                })}
              />
              <button
                type="submit"
                disabled={addMember.isPending || !addEmail.trim()}
                className={css({
                  padding: '0.375rem 0.75rem',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isDark ? 'purple.600' : 'purple.500',
                  color: 'white',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  opacity: addMember.isPending || !addEmail.trim() ? 0.5 : 1,
                  _hover: { backgroundColor: isDark ? 'purple.500' : 'purple.600' },
                })}
              >
                {addMember.isPending ? 'Adding...' : 'Add'}
              </button>
            </form>
            {addMember.isError && (
              <p className={css({ color: 'red.400', fontSize: '0.75rem', marginTop: '0.375rem', marginLeft: '1.5rem' })}>
                {addMember.error?.message || 'Failed to add member'}
              </p>
            )}
          </div>
        )}

        {/* Suggested members based on shared children */}
        {isOwner && detail?.suggestions && detail.suggestions.length > 0 && (
          <div
            data-element="household-suggestions"
            className={css({
              padding: '1rem 0',
              borderTop: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
            })}
          >
            <p className={css({ fontSize: '0.75rem', color: isDark ? 'gray.500' : 'gray.500', marginBottom: '0.5rem' })}>
              People who share children with your household:
            </p>
            {detail.suggestions.map((suggestion) => (
              <div
                key={suggestion.userId}
                data-element="household-suggestion-row"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                })}
              >
                <div className={css({ display: 'flex', alignItems: 'center', gap: '0.75rem' })}>
                  {suggestion.image ? (
                    <img
                      src={suggestion.image}
                      alt=""
                      className={css({ width: '32px', height: '32px', borderRadius: '50%' })}
                    />
                  ) : (
                    <div
                      className={css({
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: isDark ? 'gray.600' : 'gray.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        color: isDark ? 'gray.400' : 'gray.500',
                      })}
                    >
                      {(suggestion.name || suggestion.email || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className={css({ fontWeight: '500', color: isDark ? 'white' : 'gray.800', fontSize: '0.875rem' })}>
                      {suggestion.name || suggestion.email || 'Unknown'}
                    </div>
                    <div className={css({ fontSize: '0.75rem', color: isDark ? 'gray.500' : 'gray.500' })}>
                      Shares {suggestion.sharedChildren.join(', ')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  data-action="add-suggested-member"
                  onClick={() => addMember.mutate({ householdId: household.id, userId: suggestion.userId })}
                  disabled={addMember.isPending}
                  className={css({
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: isDark ? 'purple.400/50' : 'purple.200',
                    backgroundColor: 'transparent',
                    color: isDark ? 'purple.400' : 'purple.600',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    _hover: { backgroundColor: isDark ? 'purple.900/30' : 'purple.50' },
                  })}
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Dissolve button for sole owner */}
        {isOwner && household.memberCount === 1 && currentUserId && (
          <div className={css({ padding: '1rem 0', borderTop: '1px solid', borderColor: isDark ? 'gray.700' : 'gray.200' })}>
            <button
              type="button"
              data-action="dissolve-household"
              onClick={() => {
                if (confirm('Dissolve this household? This cannot be undone.')) {
                  removeMember.mutate({ householdId: household.id, userId: currentUserId })
                }
              }}
              disabled={removeMember.isPending}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: isDark ? 'red.400/50' : 'red.200',
                backgroundColor: 'transparent',
                color: isDark ? 'red.400' : 'red.600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                _hover: { backgroundColor: isDark ? 'red.900/30' : 'red.50' },
              })}
            >
              {removeMember.isPending ? 'Dissolving...' : 'Dissolve Household'}
            </button>
          </div>
        )}

        {/* Leave button for non-owners */}
        {!isOwner && currentUserId && (
          <div className={css({ padding: '1rem 0', borderTop: '1px solid', borderColor: isDark ? 'gray.700' : 'gray.200' })}>
            <button
              type="button"
              data-action="leave-household"
              onClick={() => removeMember.mutate({ householdId: household.id, userId: currentUserId })}
              disabled={removeMember.isPending}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: isDark ? 'red.400/50' : 'red.200',
                backgroundColor: 'transparent',
                color: isDark ? 'red.400' : 'red.600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                _hover: { backgroundColor: isDark ? 'red.900/30' : 'red.50' },
              })}
            >
              <LogOut size={14} />
              Leave Household
            </button>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ============================================
// Notifications Tab - Manage Notification Subscriptions
// ============================================

interface UserSubscription {
  id: string
  playerId: string
  channels: { webPush?: boolean; email?: boolean; inApp?: boolean }
  playerName: string
  playerEmoji: string
}

function NotificationsTab({ isDark }: { isDark: boolean }) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: notificationSubscriptionKeys.mine(),
    queryFn: async (): Promise<UserSubscription[]> => {
      const res = await api('notifications/subscriptions')
      if (!res.ok) return []
      const json = await res.json()
      return json.subscriptions ?? []
    },
  })

  const unsubscribeMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const res = await api(`notifications/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to unsubscribe')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notificationSubscriptionKeys.mine(),
      })
    },
  })

  const subscriptions = data ?? []

  return (
    <div data-section="notifications-tab">
      <SectionCard isDark={isDark}>
        <SectionHeader icon={<Bell size={18} />} title="Practice Notifications" isDark={isDark} />

        {isLoading ? (
          <div className={css({ padding: '1.5rem 0' })}>
            <p className={css({ color: isDark ? 'gray.500' : 'gray.500' })}>Loading...</p>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className={css({ padding: '1.5rem 0' })}>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
                fontStyle: 'italic',
              })}
            >
              No notification subscriptions. You can subscribe from any student&apos;s observation
              page.
            </p>
          </div>
        ) : (
          <div data-element="subscription-list">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                data-element="subscription-row"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '1rem 0',
                  borderBottom: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  _last: { borderBottom: 'none' },
                })}
              >
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flex: 1,
                    minWidth: 0,
                  })}
                >
                  <span className={css({ fontSize: '1.5rem', flexShrink: 0 })}>
                    {sub.playerEmoji}
                  </span>
                  <div className={css({ minWidth: 0 })}>
                    <div
                      className={css({
                        fontWeight: '500',
                        color: isDark ? 'white' : 'gray.800',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      })}
                    >
                      {sub.playerName}
                    </div>
                    <div
                      className={css({
                        display: 'flex',
                        gap: '0.5rem',
                        marginTop: '0.25rem',
                      })}
                    >
                      {sub.channels.webPush && (
                        <span
                          data-element="channel-badge"
                          title="Push notifications"
                          className={css({
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            backgroundColor: isDark ? 'blue.900/50' : 'blue.50',
                            color: isDark ? 'blue.300' : 'blue.700',
                          })}
                        >
                          <Smartphone size={12} />
                          Push
                        </span>
                      )}
                      {sub.channels.email && (
                        <span
                          data-element="channel-badge"
                          title="Email notifications"
                          className={css({
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            backgroundColor: isDark ? 'green.900/50' : 'green.50',
                            color: isDark ? 'green.300' : 'green.700',
                          })}
                        >
                          <Mail size={12} />
                          Email
                        </span>
                      )}
                      {sub.channels.inApp && (
                        <span
                          data-element="channel-badge"
                          title="In-app notifications"
                          className={css({
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            backgroundColor: isDark ? 'purple.900/50' : 'purple.50',
                            color: isDark ? 'purple.300' : 'purple.700',
                          })}
                        >
                          <Bell size={12} />
                          In-app
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  data-action="unsubscribe"
                  onClick={() => unsubscribeMutation.mutate(sub.id)}
                  disabled={unsubscribeMutation.isPending}
                  className={css({
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: isDark ? 'red.400/50' : 'red.200',
                    backgroundColor: 'transparent',
                    color: isDark ? 'red.400' : 'red.600',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    flexShrink: 0,
                    _hover: {
                      backgroundColor: isDark ? 'red.900/30' : 'red.50',
                    },
                    _disabled: {
                      opacity: 0.6,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  {unsubscribeMutation.isPending ? 'Removing...' : 'Unsubscribe'}
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ============================================
// MCP Keys Tab - API Key Management
// ============================================

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

function McpKeysTab({ isDark }: { isDark: boolean }) {
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
    <div data-section="mcp-keys-tab">
      {/* Description */}
      <p
        className={css({
          color: isDark ? 'gray.400' : 'gray.600',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
        })}
      >
        Manage API keys for external tools like Claude Code to access student skill data.
      </p>

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
      <SectionCard isDark={isDark}>
        <h2
          className={css({
            fontWeight: '600',
            color: isDark ? 'white' : 'gray.800',
            padding: '1rem 0',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          Generate New Key
        </h2>
        <div
          className={css({
            display: 'flex',
            gap: '0.75rem',
            padding: '1rem 0',
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
              backgroundColor: newKeyName.trim() ? 'blue.500' : isDark ? 'gray.700' : 'gray.300',
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
      </SectionCard>

      {/* Active Keys List */}
      <div className={css({ marginTop: '1.5rem' })}>
        <SectionCard isDark={isDark}>
          <h2
            className={css({
              fontWeight: '600',
              color: isDark ? 'white' : 'gray.800',
              padding: '1rem 0',
              borderBottom: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
            })}
          >
            Active Keys
          </h2>

          <div className={css({ padding: '1rem 0' })}>
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
        </SectionCard>
      </div>

      {/* Revoked Keys (collapsed by default) */}
      {revokedKeys.length > 0 && (
        <details
          className={css({
            marginTop: '1.5rem',
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

// ============================================
// Shared Components
// ============================================

/**
 * Card wrapper for a section
 */
function SectionCard({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <div
      className={css({
        backgroundColor: isDark ? 'gray.800' : 'white',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
        padding: '0 1.5rem',
      })}
    >
      {children}
    </div>
  )
}

/**
 * Section header with icon
 */
function SectionHeader({
  icon,
  title,
  isDark,
}: {
  icon: React.ReactNode
  title: string
  isDark: boolean
}) {
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '1rem 0',
        borderBottom: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
      })}
    >
      <span className={css({ color: isDark ? 'purple.400' : 'purple.600' })}>{icon}</span>
      <h2
        className={css({
          fontSize: '0.875rem',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        {title}
      </h2>
    </div>
  )
}

/**
 * Individual setting row
 */
function SettingRow({
  label,
  description,
  children,
  isDark,
  noBorder = false,
}: {
  label: string
  description?: string
  children: React.ReactNode
  isDark: boolean
  noBorder?: boolean
}) {
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '1rem 0',
        borderBottom: noBorder ? 'none' : '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
      })}
    >
      <div className={css({ flex: 1 })}>
        <div
          className={css({
            fontWeight: '500',
            color: isDark ? 'white' : 'gray.800',
            marginBottom: description ? '0.25rem' : 0,
          })}
        >
          {label}
        </div>
        {description && (
          <div
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            {description}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}
