'use client'

import { useFeatureFlag, useFeatureFlags } from '@/hooks/useFeatureFlag'
import { css } from '../../../../styled-system/css'

function SingleFlagDemo({ flagKey }: { flagKey: string }) {
  const { enabled, config, isLoading } = useFeatureFlag(flagKey)

  return (
    <div
      data-element="single-flag-demo"
      className={css({
        padding: '16px',
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
      })}
    >
      <div
        className={css({ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' })}
      >
        <code className={css({ color: '#58a6ff', fontSize: '14px' })}>{flagKey}</code>
        {isLoading ? (
          <span className={css({ color: '#8b949e', fontSize: '13px' })}>loading...</span>
        ) : (
          <span
            className={css({
              fontSize: '12px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '12px',
              color: enabled ? '#3fb950' : '#f85149',
              backgroundColor: enabled ? '#23863622' : '#da363322',
              border: '1px solid',
              borderColor: enabled ? '#23863644' : '#da363344',
            })}
          >
            {enabled ? 'ON' : 'OFF'}
          </span>
        )}
      </div>
      {config !== null && (
        <pre
          className={css({
            fontSize: '12px',
            color: '#8b949e',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            margin: '0',
          })}
        >
          config: {JSON.stringify(config, null, 2)}
        </pre>
      )}
    </div>
  )
}

function BillingGateDemo() {
  const { enabled, config } = useFeatureFlag('billing.enabled')
  const { config: limits } = useFeatureFlag('billing.free_tier_limits')

  return (
    <div
      data-element="billing-gate-demo"
      className={css({
        padding: '20px',
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
      })}
    >
      <h3 className={css({ fontSize: '16px', fontWeight: '600', marginBottom: '12px' })}>
        Billing gate demo
      </h3>
      <p className={css({ color: '#8b949e', fontSize: '14px', marginBottom: '16px' })}>
        This simulates how a component would conditionally render based on feature flags.
      </p>

      {enabled ? (
        <div
          className={css({
            padding: '16px',
            backgroundColor: '#23863622',
            border: '1px solid #23863644',
            borderRadius: '6px',
            color: '#3fb950',
          })}
        >
          Billing is enabled. Paywall and subscription UI would render here.
          {config !== null && (
            <pre
              className={css({
                fontSize: '12px',
                marginTop: '8px',
                color: '#8b949e',
                fontFamily: 'monospace',
              })}
            >
              billing config: {JSON.stringify(config, null, 2)}
            </pre>
          )}
        </div>
      ) : (
        <div
          className={css({
            padding: '16px',
            backgroundColor: '#30363d44',
            border: '1px solid #30363d',
            borderRadius: '6px',
            color: '#8b949e',
          })}
        >
          Billing is disabled. Showing free experience — no paywall, no upgrade prompts.
          {limits !== null && (
            <pre className={css({ fontSize: '12px', marginTop: '8px', fontFamily: 'monospace' })}>
              free tier limits (inactive): {JSON.stringify(limits, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function AllFlagsDemo() {
  const { flags, isLoading } = useFeatureFlags()
  const entries = Object.entries(flags)

  return (
    <div
      data-element="all-flags-demo"
      className={css({
        padding: '20px',
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
      })}
    >
      <h3 className={css({ fontSize: '16px', fontWeight: '600', marginBottom: '12px' })}>
        useFeatureFlags() — all flags
      </h3>
      {isLoading ? (
        <span className={css({ color: '#8b949e' })}>Loading...</span>
      ) : entries.length === 0 ? (
        <span className={css({ color: '#8b949e' })}>No flags defined.</span>
      ) : (
        <pre
          className={css({
            fontSize: '13px',
            fontFamily: 'monospace',
            color: '#e6edf3',
            whiteSpace: 'pre-wrap',
            margin: '0',
          })}
        >
          {JSON.stringify(flags, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function FeatureFlagsDemoPage() {
  return (
    <div
      data-component="feature-flags-demo"
      className={css({
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        color: '#e6edf3',
        padding: '40px 24px',
      })}
    >
      <div className={css({ maxWidth: '700px', margin: '0 auto' })}>
        <h1 className={css({ fontSize: '24px', fontWeight: '600', marginBottom: '8px' })}>
          Feature Flags Demo
        </h1>
        <p className={css({ color: '#8b949e', fontSize: '14px', marginBottom: '32px' })}>
          Flag values are prefetched server-side and hydrated — no client fetch, no loading flash.
          Toggle flags in{' '}
          <a href="/admin/feature-flags" className={css({ color: '#58a6ff' })}>
            /admin/feature-flags
          </a>{' '}
          and refresh to see changes.
        </p>

        <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
          <h2 className={css({ fontSize: '18px', fontWeight: '600' })}>useFeatureFlag(key)</h2>
          <SingleFlagDemo flagKey="billing.enabled" />
          <SingleFlagDemo flagKey="billing.free_tier_limits" />
          <SingleFlagDemo flagKey="nonexistent.flag" />

          <h2 className={css({ fontSize: '18px', fontWeight: '600', marginTop: '16px' })}>
            Conditional rendering
          </h2>
          <BillingGateDemo />

          <h2 className={css({ fontSize: '18px', fontWeight: '600', marginTop: '16px' })}>
            Bulk read
          </h2>
          <AllFlagsDemo />
        </div>
      </div>
    </div>
  )
}
