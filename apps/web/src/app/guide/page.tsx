'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../styled-system/css'
import { container, hstack } from '../../../styled-system/patterns'
import { ArithmeticOperationsGuide } from './components/ArithmeticOperationsGuide'
import { ReadingNumbersGuide } from './components/ReadingNumbersGuide'

type TabType = 'reading' | 'arithmetic'

export default function GuidePage() {
  const t = useTranslations('guide.page')
  const [activeTab, setActiveTab] = useState<TabType>('reading')

  return (
    <PageWithNav navTitle={t('navTitle')} navEmoji="📖">
      <div className={`with-fixed-nav ${css({ minHeight: '100vh', bg: 'bg.canvas' })}`}>
        {/* Hero Section */}
        <div
          className={css({
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'text.inverse',
            textAlign: 'center',
            py: '20',
          })}
        >
          <div className={container({ maxW: '4xl', px: '4' })}>
            <h1
              className={css({
                fontSize: '4xl',
                fontWeight: 'bold',
                mb: '4',
                textShadow: '0 4px 20px rgba(0,0,0,0.3)',
              })}
            >
              {t('hero.title')}
            </h1>
            <p
              className={css({
                fontSize: 'xl',
                opacity: '0.95',
                maxW: '2xl',
                mx: 'auto',
                lineHeight: 'relaxed',
              })}
            >
              {t('hero.subtitle')}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={css({
            bg: 'bg.surface',
            borderBottom: '1px solid',
            borderColor: 'border.default',
          })}
        >
          <div className={container({ maxW: '7xl', px: '4' })}>
            <div className={hstack({ gap: '0' })}>
              <button
                onClick={() => setActiveTab('reading')}
                className={css({
                  px: '6',
                  py: '4',
                  fontWeight: 'medium',
                  borderBottom: '2px solid',
                  borderColor: activeTab === 'reading' ? 'accent.emphasis' : 'transparent',
                  color: activeTab === 'reading' ? 'accent.emphasis' : 'text.secondary',
                  bg: activeTab === 'reading' ? 'accent.subtle' : 'transparent',
                  transition: 'all',
                  cursor: 'pointer',
                  _hover: {
                    bg: activeTab === 'reading' ? 'accent.subtle' : 'bg.muted',
                    color: activeTab === 'reading' ? 'accent.emphasis' : 'text.primary',
                  },
                })}
              >
                {t('tabs.reading')}
              </button>
              <button
                onClick={() => setActiveTab('arithmetic')}
                className={css({
                  px: '6',
                  py: '4',
                  fontWeight: 'medium',
                  borderBottom: '2px solid',
                  borderColor: activeTab === 'arithmetic' ? 'accent.emphasis' : 'transparent',
                  color: activeTab === 'arithmetic' ? 'accent.emphasis' : 'text.secondary',
                  bg: activeTab === 'arithmetic' ? 'accent.subtle' : 'transparent',
                  transition: 'all',
                  cursor: 'pointer',
                  _hover: {
                    bg: activeTab === 'arithmetic' ? 'accent.subtle' : 'bg.muted',
                    color: activeTab === 'arithmetic' ? 'accent.emphasis' : 'text.primary',
                  },
                })}
              >
                {t('tabs.arithmetic')}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={container({ maxW: '6xl', px: '4', py: '12' })}>
          <div
            className={css({
              bg: 'bg.default',
              rounded: '2xl',
              shadow: 'card',
              p: '10',
            })}
          >
            {activeTab === 'reading' ? <ReadingNumbersGuide /> : <ArithmeticOperationsGuide />}
          </div>
        </div>
      </div>
    </PageWithNav>
  )
}
