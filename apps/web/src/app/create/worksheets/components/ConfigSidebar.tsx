'use client'

import { css } from '@styled/css'
import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { StudentNameInput } from './config-panel/StudentNameInput'
import { ContentTab } from './config-sidebar/ContentTab'
import { DifficultyTab } from './config-sidebar/DifficultyTab'
import { LayoutTab } from './config-sidebar/LayoutTab'
import { ScaffoldingTab } from './config-sidebar/ScaffoldingTab'
import { TabNavigation } from './config-sidebar/TabNavigation'
import { useWorksheetConfig } from './WorksheetConfigContext'

interface ConfigSidebarProps {
  isSaving: boolean
  lastSaved: Date | null
}

export function ConfigSidebar({ isSaving, lastSaved }: ConfigSidebarProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [activeTab, setActiveTab] = useState('operator')
  const { formState, onChange } = useWorksheetConfig()

  return (
    <div
      data-component="config-sidebar"
      className={css({
        h: 'full',
        bg: isDark ? 'gray.800' : 'white',
        p: '4',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      {/* Header */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: '3',
          borderBottom: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
          mb: '4',
        })}
      >
        <h2
          className={css({
            fontSize: 'lg',
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.900',
          })}
        >
          Worksheet Studio
        </h2>
        <div
          className={css({
            fontSize: 'xs',
            color: isSaving
              ? isDark
                ? 'gray.400'
                : 'gray.500'
              : isDark
                ? 'green.400'
                : 'green.600',
          })}
        >
          {isSaving ? 'Saving...' : lastSaved ? '✓ Saved' : ''}
        </div>
      </div>

      {/* Student Name - Global field above tabs */}
      <div className={css({ mb: '4' })}>
        <StudentNameInput
          value={formState.name}
          onChange={(name) => onChange({ name })}
          isDark={isDark}
        />
      </div>

      {/* Tab Navigation */}
      <div className={css({ mb: '4' })}>
        <TabNavigation
          activeTab={activeTab}
          onChange={setActiveTab}
          operator={formState.operator}
        />
      </div>

      {/* Tab Content */}
      <div
        className={css({
          flex: 1,
          bg: isDark ? 'gray.750' : 'gray.50',
          rounded: 'lg',
          p: '4',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        })}
      >
        {activeTab === 'operator' && <ContentTab />}
        {activeTab === 'layout' && <LayoutTab />}
        {activeTab === 'scaffolding' && <ScaffoldingTab />}
        {activeTab === 'difficulty' && <DifficultyTab />}
      </div>
    </div>
  )
}
