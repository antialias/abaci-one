'use client'

import type { Meta, StoryObj } from '@storybook/react'
import React, { useEffect, useState } from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import {
  SessionModeBannerProvider,
  useSessionModeBanner,
} from '@/contexts/SessionModeBannerContext'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { css } from '../../../styled-system/css'
import { ContentBannerSlot, NavBannerSlot, ProjectingBanner } from './BannerSlots'

// =============================================================================
// Mock Data
// =============================================================================

const mockRemediationMode: SessionMode = {
  type: 'remediation',
  weakSkills: [
    { skillId: 'add.3', displayName: '+3', pKnown: 0.45 },
    { skillId: 'add.4', displayName: '+4', pKnown: 0.52 },
    { skillId: 'add.7', displayName: '+7', pKnown: 0.58 },
  ],
  focusDescription: 'Strengthening +3, +4, +7',
  blockedPromotion: undefined,
}

const mockRemediationBlockedMode: SessionMode = {
  type: 'remediation',
  weakSkills: [
    { skillId: 'add.3', displayName: '+3', pKnown: 0.45 },
    { skillId: 'add.4', displayName: '+4', pKnown: 0.52 },
  ],
  focusDescription: 'Strengthen prerequisites to unlock +5',
  blockedPromotion: {
    nextSkill: { skillId: 'heaven.5', displayName: '+5 (Heaven Bead)', pKnown: 0 },
    reason: 'Strengthen +3 and +4 first',
    phase: { id: 'level1-phase2', name: 'Heaven Bead', primarySkillId: 'heaven.5' } as any,
    tutorialReady: false,
  },
}

const mockProgressionMode: SessionMode = {
  type: 'progression',
  nextSkill: { skillId: 'heaven.5', displayName: '+5 (Heaven Bead)', pKnown: 0 },
  phase: { id: 'level1-phase2', name: 'Heaven Bead', primarySkillId: 'heaven.5' } as any,
  tutorialRequired: true,
  skipCount: 0,
  focusDescription: 'Ready to learn +5 (Heaven Bead)',
}

const mockProgressionPracticeMode: SessionMode = {
  type: 'progression',
  nextSkill: { skillId: 'add.6', displayName: '+6', pKnown: 0 },
  phase: { id: 'level1-phase3', name: 'Addition 6-9', primarySkillId: 'add.6' } as any,
  tutorialRequired: false,
  skipCount: 2,
  focusDescription: 'Practice +6',
}

const mockMaintenanceMode: SessionMode = {
  type: 'maintenance',
  skillCount: 12,
  focusDescription: 'All 12 skills mastered - maintenance practice',
}

// =============================================================================
// Helper Components
// =============================================================================

function ActionRegistrar() {
  const { setOnAction } = useSessionModeBanner()
  useEffect(() => {
    setOnAction(() => alert('Practice action triggered!'))
  }, [setOnAction])
  return null
}

// =============================================================================
// Interactive Demo Component
// =============================================================================

interface DemoProps {
  sessionMode: SessionMode
  darkMode?: boolean
}

function BannerSlotsDemo({ sessionMode, darkMode = false }: DemoProps) {
  const [activeView, setActiveView] = useState<'dashboard' | 'other'>('dashboard')

  return (
    <ThemeProvider>
      <SessionModeBannerProvider sessionMode={sessionMode} isLoading={false}>
        <ActionRegistrar />
        {/* Single ProjectingBanner renders at provider level */}
        <ProjectingBanner />

        <div
          className={css({
            minHeight: '600px',
            backgroundColor: darkMode ? '#1a1a2e' : 'gray.50',
            padding: '1rem',
          })}
        >
          {/* Simulated Navigation */}
          <div
            className={css({
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: darkMode ? 'gray.800' : 'white',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: darkMode ? 'gray.700' : 'gray.200',
            })}
          >
            <span
              className={css({
                fontSize: '0.875rem',
                color: darkMode ? 'gray.400' : 'gray.600',
                marginRight: '0.5rem',
              })}
            >
              Simulate navigation:
            </span>
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className={css({
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: activeView === 'dashboard' ? 'bold' : 'normal',
                color: activeView === 'dashboard' ? 'white' : darkMode ? 'gray.300' : 'gray.700',
                backgroundColor:
                  activeView === 'dashboard' ? 'blue.500' : darkMode ? 'gray.700' : 'gray.100',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              })}
            >
              Dashboard (Content Slot)
            </button>
            <button
              type="button"
              onClick={() => setActiveView('other')}
              className={css({
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: activeView === 'other' ? 'bold' : 'normal',
                color: activeView === 'other' ? 'white' : darkMode ? 'gray.300' : 'gray.700',
                backgroundColor:
                  activeView === 'other' ? 'blue.500' : darkMode ? 'gray.700' : 'gray.100',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              })}
            >
              Other Page (Nav Slot)
            </button>
          </div>

          {/* Simulated Sub-Nav with Nav Slot */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: darkMode ? 'gray.800' : 'white',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: darkMode ? 'gray.700' : 'gray.200',
              marginBottom: '1rem',
            })}
          >
            <span
              className={css({
                fontSize: '0.875rem',
                color: darkMode ? 'gray.400' : 'gray.600',
              })}
            >
              Sub-Nav:
            </span>
            <span className={css({ fontSize: '1.25rem' })}>🦄</span>
            <span
              className={css({
                fontWeight: '600',
                color: darkMode ? 'white' : 'gray.800',
              })}
            >
              Sonia
            </span>

            {/* Nav Slot - only rendered when not on dashboard */}
            {activeView === 'other' && (
              <NavBannerSlot
                className={css({
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'center',
                })}
              />
            )}
          </div>

          {/* Simulated Main Content */}
          <div
            className={css({
              padding: '1.5rem',
              backgroundColor: darkMode ? 'gray.800' : 'white',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: darkMode ? 'gray.700' : 'gray.200',
            })}
          >
            <h2
              className={css({
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: darkMode ? 'white' : 'gray.800',
                marginBottom: '1rem',
              })}
            >
              {activeView === 'dashboard' ? 'Dashboard' : 'Other Practice Page'}
            </h2>

            {/* Content Slot - only rendered on dashboard */}
            {activeView === 'dashboard' && (
              <ContentBannerSlot className={css({ marginBottom: '1rem' })} />
            )}

            <p
              className={css({
                color: darkMode ? 'gray.400' : 'gray.600',
              })}
            >
              {activeView === 'dashboard'
                ? 'The full banner appears here in the content area. Click "Other Page" to see it animate to the nav slot.'
                : 'The compact banner now appears in the sub-nav above. Click "Dashboard" to see it animate back to the content area.'}
            </p>
          </div>
        </div>
      </SessionModeBannerProvider>
    </ThemeProvider>
  )
}

// =============================================================================
// Story Configuration
// =============================================================================

const meta: Meta<typeof BannerSlotsDemo> = {
  title: 'Practice/BannerSlots',
  component: BannerSlotsDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The BannerSlots system creates a unified banner that seamlessly animates between positions
using Framer Motion's layoutId feature.

**Key Features:**
- Banner renders in document flow (not fixed positioning)
- Animates between content and nav slots using shared layoutId
- Full banner in content area (Dashboard, Summary)
- Compact banner in nav slot (other practice pages)
- Smooth layout animation during transitions

**How to test:**
1. Click the navigation buttons to simulate page transitions
2. Watch the banner animate between the content slot and nav slot
3. Notice the banner changes from full to compact variant
        `,
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof BannerSlotsDemo>

// =============================================================================
// Stories
// =============================================================================

export const RemediationMode: Story = {
  render: () => <BannerSlotsDemo sessionMode={mockRemediationMode} />,
}

export const RemediationBlocked: Story = {
  name: 'Remediation (Blocked Promotion)',
  render: () => <BannerSlotsDemo sessionMode={mockRemediationBlockedMode} />,
}

export const ProgressionTutorial: Story = {
  name: 'Progression (Tutorial Required)',
  render: () => <BannerSlotsDemo sessionMode={mockProgressionMode} />,
}

export const ProgressionPractice: Story = {
  name: 'Progression (Practice)',
  render: () => <BannerSlotsDemo sessionMode={mockProgressionPracticeMode} />,
}

export const MaintenanceMode: Story = {
  render: () => <BannerSlotsDemo sessionMode={mockMaintenanceMode} />,
}

export const DarkMode: Story = {
  render: () => <BannerSlotsDemo sessionMode={mockRemediationMode} darkMode />,
}

export const DarkModeProgression: Story = {
  name: 'Dark Mode (Progression)',
  render: () => <BannerSlotsDemo sessionMode={mockProgressionMode} darkMode />,
}

export const DarkModeMaintenance: Story = {
  name: 'Dark Mode (Maintenance)',
  render: () => <BannerSlotsDemo sessionMode={mockMaintenanceMode} darkMode />,
}
