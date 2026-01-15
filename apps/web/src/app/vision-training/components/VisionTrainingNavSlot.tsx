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
          color: 'gray.500',
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
          bg: 'gray.800',
          color: 'white',
          border: 'none',
          borderRadius: 'lg',
          fontSize: 'sm',
          fontWeight: 'semibold',
          cursor: 'pointer',
          boxShadow: 'sm',
          _hover: { bg: 'gray.700' },
          _focus: { outline: 'none', ring: '2px', ringColor: 'blue.500', ringOffset: '2px' },
        })}
      >
        {allModelTypes.map((type) => (
          <option key={type} value={type}>
            {getModelEntry(type).label}
          </option>
        ))}
      </select>

      {/* Separator */}
      <span className={css({ color: 'gray.300', display: { base: 'none', sm: 'block' } })}>|</span>

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
                color: isActive ? 'blue.600' : 'gray.600',
                textDecoration: 'none',
                fontWeight: isActive ? 'semibold' : 'medium',
                fontSize: 'sm',
                borderBottom: '2px solid',
                borderColor: isActive ? 'blue.600' : 'transparent',
                transition: 'all 0.15s ease',
                _hover: {
                  color: isActive ? 'blue.600' : 'gray.900',
                  bg: isActive ? 'transparent' : 'gray.100',
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
