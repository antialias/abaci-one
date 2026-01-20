'use client'

import { useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { css } from '../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import type { ModelType } from '../train/components/wizard/types'
import { useModelType, getValidModelTypes } from '../hooks/useModelType'
import { getModelEntry, TABS, type TabId } from '../registry'

/**
 * Vision Training Navigation Bar
 *
 * Fixed nav bar at top of all vision training pages.
 * - Home link
 * - Model selector (navigates to different model)
 * - Tab links (Data, Train, Test, Sessions)
 *
 * Uses path-based routing: /vision-training/[model]/[tab]
 */
export function VisionTrainingNav() {
  const router = useRouter()
  const pathname = usePathname()
  const modelType = useModelType()
  const allModelTypes = getValidModelTypes()
  const entry = getModelEntry(modelType)

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
    <nav
      data-component="vision-training-nav"
      className={css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bg: 'gray.900',
        borderBottom: '1px solid',
        borderColor: 'gray.800',
        display: 'flex',
        alignItems: 'center',
        px: 4,
        gap: 4,
      })}
      style={{ height: 'var(--app-nav-height, 72px)', zIndex: Z_INDEX.NAV_BAR }}
    >
      {/* Home link */}
      <Link
        href="/"
        data-action="go-home"
        className={css({
          color: 'gray.400',
          textDecoration: 'none',
          fontSize: 'sm',
          _hover: { color: 'gray.200' },
        })}
      >
        ← Home
      </Link>

      <span className={css({ color: 'gray.600' })}>|</span>

      {/* Title */}
      <span
        data-element="nav-title"
        className={css({
          fontSize: 'lg',
          fontWeight: 'bold',
          color: 'gray.100',
          display: { base: 'none', md: 'block' },
        })}
      >
        Vision Training
      </span>

      {/* Model selector */}
      <div
        data-element="model-selector-container"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          ml: { base: 0, md: 'auto' },
        })}
      >
        <span
          className={css({
            fontSize: 'sm',
            color: 'gray.400',
            display: { base: 'none', sm: 'block' },
          })}
        >
          Model:
        </span>
        <select
          value={modelType}
          onChange={(e) => handleModelChange(e.target.value as ModelType)}
          data-action="select-model"
          className={css({
            px: 3,
            py: 2,
            bg: 'gray.800',
            color: 'gray.100',
            border: '1px solid',
            borderColor: 'gray.700',
            borderRadius: 'lg',
            fontSize: 'sm',
            fontWeight: 'medium',
            cursor: 'pointer',
            _hover: { borderColor: 'gray.600' },
            _focus: { outline: 'none', borderColor: 'blue.500' },
          })}
        >
          {allModelTypes.map((type) => (
            <option key={type} value={type}>
              {getModelEntry(type).label}
            </option>
          ))}
        </select>
      </div>

      {/* Tab links */}
      <div
        data-element="tab-links"
        className={css({
          display: 'flex',
          ml: { base: 'auto', md: 0 },
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
                gap: 2,
                px: 3,
                py: 2,
                color: isActive ? 'blue.400' : 'gray.400',
                textDecoration: 'none',
                fontWeight: 'medium',
                fontSize: 'sm',
                borderBottom: '2px solid',
                borderColor: isActive ? 'blue.500' : 'transparent',
                _hover: { color: isActive ? 'blue.400' : 'gray.200' },
              })}
            >
              <span className={css({ display: { base: 'none', sm: 'block' } })}>{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
