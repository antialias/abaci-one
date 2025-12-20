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
    nextSkill: {
      skillId: 'heaven.5',
      displayName: '+5 (Heaven Bead)',
      pKnown: 0,
    },
    reason: 'Strengthen +3 and +4 first',
    phase: {
      id: 'level1-phase2',
      name: 'Heaven Bead',
      primarySkillId: 'heaven.5',
    } as any,
    tutorialReady: false,
  },
}

const mockProgressionMode: SessionMode = {
  type: 'progression',
  nextSkill: {
    skillId: 'heaven.5',
    displayName: '+5 (Heaven Bead)',
    pKnown: 0,
  },
  phase: {
    id: 'level1-phase2',
    name: 'Heaven Bead',
    primarySkillId: 'heaven.5',
  } as any,
  tutorialRequired: true,
  skipCount: 0,
  focusDescription: 'Ready to learn +5 (Heaven Bead)',
}

const mockProgressionPracticeMode: SessionMode = {
  type: 'progression',
  nextSkill: { skillId: 'add.6', displayName: '+6', pKnown: 0 },
  phase: {
    id: 'level1-phase3',
    name: 'Addition 6-9',
    primarySkillId: 'add.6',
  } as any,
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

// =============================================================================
// Scroll-Based Projection Demo
// =============================================================================

const STICKY_NAV_HEIGHT = 60

interface ScrollDemoProps {
  sessionMode: SessionMode
  darkMode?: boolean
}

function ScrollProjectionDemo({ sessionMode, darkMode = false }: ScrollDemoProps) {
  return (
    <ThemeProvider>
      <SessionModeBannerProvider sessionMode={sessionMode} isLoading={false}>
        <ActionRegistrar />
        <ProjectingBanner />

        <div
          data-component="scroll-demo"
          className={css({
            minHeight: '200vh', // Make page scrollable
            backgroundColor: darkMode ? '#1a1a2e' : 'gray.50',
          })}
        >
          {/* Sticky Navigation Bar */}
          <nav
            data-element="sticky-nav"
            className={css({
              position: 'sticky',
              top: 0,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0 1rem',
              height: `${STICKY_NAV_HEIGHT}px`,
              backgroundColor: darkMode ? 'gray.900' : 'white',
              borderBottom: '1px solid',
              borderColor: darkMode ? 'gray.700' : 'gray.200',
              boxShadow: 'sm',
            })}
          >
            <span className={css({ fontSize: '1.25rem' })}>🧮</span>
            <span
              className={css({
                fontWeight: '600',
                color: darkMode ? 'white' : 'gray.800',
              })}
            >
              Practice Dashboard
            </span>
            <span className={css({ flex: 1 })} />
            <span className={css({ fontSize: '1.25rem' })}>🦄</span>
            <span
              className={css({
                fontWeight: '500',
                color: darkMode ? 'gray.300' : 'gray.600',
              })}
            >
              Sonia
            </span>

            {/* Nav Banner Slot - always present */}
            <NavBannerSlot
              className={css({
                marginLeft: '1rem',
              })}
            />
          </nav>

          {/* Main Content Area */}
          <main
            className={css({
              padding: '2rem',
              maxWidth: '800px',
              margin: '0 auto',
            })}
          >
            {/* Header */}
            <h1
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: darkMode ? 'white' : 'gray.800',
                marginBottom: '1rem',
              })}
            >
              Sonia's Progress
            </h1>

            {/* Content Banner Slot - with sticky offset */}
            <ContentBannerSlot
              stickyOffset={STICKY_NAV_HEIGHT}
              className={css({ marginBottom: '1.5rem' })}
            />

            {/* Instruction */}
            <div
              className={css({
                padding: '1rem',
                marginBottom: '1.5rem',
                backgroundColor: darkMode ? 'blue.900' : 'blue.50',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: darkMode ? 'blue.700' : 'blue.200',
              })}
            >
              <p
                className={css({
                  fontSize: '0.875rem',
                  color: darkMode ? 'blue.200' : 'blue.700',
                  fontWeight: '500',
                })}
              >
                👆 Scroll down to see the banner project into the sticky nav!
              </p>
            </div>

            {/* Filler content to enable scrolling */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={css({
                  padding: '1.5rem',
                  marginBottom: '1rem',
                  backgroundColor: darkMode ? 'gray.800' : 'white',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: darkMode ? 'gray.700' : 'gray.200',
                })}
              >
                <h3
                  className={css({
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: darkMode ? 'white' : 'gray.800',
                    marginBottom: '0.5rem',
                  })}
                >
                  Section {i + 1}
                </h3>
                <p
                  className={css({
                    color: darkMode ? 'gray.400' : 'gray.600',
                    fontSize: '0.875rem',
                  })}
                >
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                  exercitation ullamco laboris.
                </p>
              </div>
            ))}
          </main>
        </div>
      </SessionModeBannerProvider>
    </ThemeProvider>
  )
}

export const ScrollProjection: Story = {
  name: 'Scroll Projection',
  render: () => <ScrollProjectionDemo sessionMode={mockRemediationMode} />,
  parameters: {
    docs: {
      description: {
        story: `
Demonstrates scroll-based banner projection.

**How it works:**
1. The banner starts in the content area (full variant)
2. As you scroll down, when the banner goes under the sticky nav, it projects to the nav slot
3. Scrolling back up returns the banner to the content area
4. Uses IntersectionObserver for efficient scroll detection

**Try it:**
1. Scroll down until the banner disappears under the nav
2. Watch it smoothly animate into the nav bar
3. Scroll back up to see it return to the content area
        `,
      },
    },
  },
}

export const ScrollProjectionDark: Story = {
  name: 'Scroll Projection (Dark)',
  render: () => <ScrollProjectionDemo sessionMode={mockRemediationMode} darkMode />,
}

export const ScrollProjectionProgression: Story = {
  name: 'Scroll Projection (Progression)',
  render: () => <ScrollProjectionDemo sessionMode={mockProgressionMode} />,
}
