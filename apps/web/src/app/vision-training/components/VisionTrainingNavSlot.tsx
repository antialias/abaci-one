'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { css } from '../../../../styled-system/css'
import { getValidModelTypes, useModelType } from '../hooks/useModelType'
import { getModelEntry, TABS, type TabId } from '../registry'
import type { ModelType } from '../train/components/wizard/types'

/**
 * Vision Training Nav Slot
 *
 * Content for the minimal nav's center slot when on vision training pages.
 * Contains:
 * - Model selector dropdown
 * - Tab links (Data, Train, Test, Sessions)
 *
 * Used with PageWithNav's navSlot prop.
 */
export function VisionTrainingNavSlot() {
  const router = useRouter()
  const pathname = usePathname()
  const modelType = useModelType()
  const allModelTypes = getValidModelTypes()

  // Determine active tab from pathname
  const getActiveTab = (): TabId => {
    if (pathname.includes('/train')) return 'train'
    if (pathname.includes('/test')) return 'test'
    if (pathname.includes('/sessions')) return 'sessions'
    return 'data'
  }

  const activeTab = getActiveTab()

  // Handle model change - preserve current tab
  const handleModelChange = useCallback(
    (newModel: ModelType) => {
      // Get current path suffix (e.g., /train, /test, /sessions)
      const pathParts = pathname.split('/')
      const modelIndex = pathParts.indexOf(modelType)
      const suffix = pathParts.slice(modelIndex + 1).join('/')

      // Navigate to new model path with same suffix
      const newPath = suffix
        ? `/vision-training/${newModel}/${suffix}`
        : `/vision-training/${newModel}`

      router.push(newPath)
    },
    [pathname, modelType, router]
  )

  // Get tab path
  const getTabPath = (tabId: TabId): string => {
    const basePath = `/vision-training/${modelType}`
    if (tabId === 'data') return basePath
    return `${basePath}/${tabId}`
  }

  return (
    <div
      data-component="vision-training-nav-slot"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: 3,
      })}
    >
      {/* Title - hidden on small screens */}
      <span
        className={css({
          fontSize: 'sm',
          fontWeight: 'semibold',
          color: 'rgba(196, 181, 253, 0.8)',
          display: { base: 'none', md: 'block' },
          whiteSpace: 'nowrap',
        })}
      >
        Vision Training
      </span>

      {/* Model selector - dark accent dropdown */}
      <select
        value={modelType}
        onChange={(e) => handleModelChange(e.target.value as ModelType)}
        data-action="select-model"
        className={css({
          px: 3,
          py: 1.5,
          bg: 'rgba(139, 92, 246, 0.25)',
          color: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid',
          borderColor: 'rgba(139, 92, 246, 0.4)',
          borderRadius: 'lg',
          fontSize: 'sm',
          fontWeight: 'semibold',
          cursor: 'pointer',
          _hover: { bg: 'rgba(139, 92, 246, 0.35)' },
          _focus: {
            outline: 'none',
            ring: '2px',
            ringColor: 'rgba(139, 92, 246, 0.6)',
            ringOffset: '2px',
          },
        })}
      >
        {allModelTypes.map((type) => (
          <option key={type} value={type}>
            {getModelEntry(type).label}
          </option>
        ))}
      </select>

      {/* Separator */}
      <span
        className={css({
          color: 'rgba(139, 92, 246, 0.4)',
          display: { base: 'none', sm: 'block' },
        })}
      >
        |
      </span>

      {/* Tab links */}
      <div
        data-element="tab-links"
        className={css({
          display: 'flex',
          gap: 0,
        })}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <Link
              key={tab.id}
              href={getTabPath(tab.id)}
              data-action={`tab-${tab.id}`}
              data-active={isActive ? 'true' : 'false'}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2.5,
                py: 1.5,
                color: isActive ? 'rgba(196, 181, 253, 1)' : 'rgba(209, 213, 219, 0.9)',
                textDecoration: 'none',
                fontWeight: isActive ? 'semibold' : 'medium',
                fontSize: 'sm',
                borderBottom: '2px solid',
                borderColor: isActive ? 'rgba(139, 92, 246, 0.8)' : 'transparent',
                transition: 'all 0.15s ease',
                _hover: {
                  color: 'rgba(196, 181, 253, 1)',
                  bg: isActive ? 'transparent' : 'rgba(139, 92, 246, 0.15)',
                  borderRadius: isActive ? '0' : 'md',
                },
              })}
            >
              <span className={css({ display: { base: 'none', sm: 'block' } })}>{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
