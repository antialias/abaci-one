'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../styled-system/css'

// Card theme configurations
const cardThemes = {
  flashcards: {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    shadowColor: 'rgba(102, 126, 234, 0.4)',
    checkBg: 'purple.100',
    checkColor: 'purple.600',
  },
  worksheets: {
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    shadowColor: 'rgba(16, 185, 129, 0.4)',
    checkBg: 'green.100',
    checkColor: 'green.600',
  },
  calendar: {
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    shadowColor: 'rgba(251, 191, 36, 0.4)',
    checkBg: 'yellow.100',
    checkColor: 'yellow.600',
  },
} as const

type CardType = keyof typeof cardThemes

interface CreatorCardProps {
  type: CardType
  href: string
  emoji: string
  title: string
  description: string
  features: string[]
  buttonText: string
}

function CreatorCard({
  type,
  href,
  emoji,
  title,
  description,
  features,
  buttonText,
}: CreatorCardProps) {
  const theme = cardThemes[type]

  return (
    <Link href={href} className={css({ display: 'block', height: '100%' })}>
      <div
        data-element={`${type}-card`}
        className={css({
          bg: 'bg.surface',
          borderRadius: { base: '2xl', md: '3xl' },
          p: { base: 5, sm: 6, md: 8 },
          border: '1px solid',
          borderColor: 'border.default',
          boxShadow: { base: '0 10px 40px rgba(0,0,0,0.15)', md: '0 20px 60px rgba(0,0,0,0.2)' },
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          _hover: {
            transform: { base: 'translateY(-4px)', md: 'translateY(-8px) scale(1.01)' },
            boxShadow: { base: '0 16px 50px rgba(0,0,0,0.2)', md: '0 30px 80px rgba(0,0,0,0.25)' },
            borderColor: 'border.emphasized',
          },
          _before: {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: { base: '4px', md: '6px' },
            background: theme.gradient,
          },
        })}
      >
        {/* Icon */}
        <div
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: { base: '2xl', sm: '3xl', md: '4xl' },
            mb: { base: 3, md: 5 },
            width: { base: '56px', sm: '64px', md: '80px' },
            height: { base: '56px', sm: '64px', md: '80px' },
            borderRadius: { base: 'xl', md: '2xl' },
            background: theme.gradient,
            boxShadow: `0 8px 24px ${theme.shadowColor}`,
            flexShrink: 0,
          })}
        >
          {emoji}
        </div>

        {/* Title */}
        <h2
          className={css({
            fontSize: { base: 'lg', sm: 'xl', md: '2xl' },
            fontWeight: 'bold',
            mb: { base: 2, md: 3 },
            color: 'text.primary',
            letterSpacing: 'tight',
          })}
        >
          {title}
        </h2>

        {/* Description */}
        <p
          className={css({
            fontSize: { base: 'sm', md: 'md' },
            color: 'text.secondary',
            mb: { base: 3, md: 5 },
            lineHeight: '1.6',
            flex: 1,
          })}
        >
          {description}
        </p>

        {/* Features */}
        <ul
          className={css({
            listStyle: 'none',
            display: { base: 'none', sm: 'flex' },
            flexDirection: 'column',
            gap: { base: 2, md: 3 },
            mb: { base: 4, md: 0 },
          })}
        >
          {features.map((feature, i) => (
            <li
              key={i}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: { base: 2, md: 3 },
                fontSize: { base: 'xs', md: 'sm' },
                color: 'text.secondary',
              })}
            >
              <span
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: { base: '16px', md: '20px' },
                  height: { base: '16px', md: '20px' },
                  borderRadius: 'full',
                  bg: theme.checkBg,
                  color: theme.checkColor,
                  fontSize: 'xs',
                  fontWeight: 'bold',
                  flexShrink: 0,
                })}
              >
                ✓
              </span>
              {feature}
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <div className={css({ mt: { base: 0, sm: 5, md: 7 } })}>
          <div
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              px: { base: 4, md: 6 },
              py: { base: 2, md: 3 },
              borderRadius: 'xl',
              background: theme.gradient,
              color: 'white',
              fontWeight: 'bold',
              fontSize: { base: 'sm', md: 'md' },
              boxShadow: `0 4px 15px ${theme.shadowColor}`,
              transition: 'all 0.3s',
            })}
          >
            <span>{buttonText}</span>
            <span className={css({ fontSize: { base: 'md', md: 'lg' } })}>→</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function CreateHubPage() {
  const t = useTranslations('create.hub')

  return (
    <PageWithNav navTitle="Create" navEmoji="✨">
      <div
        data-component="create-hub"
        className={css({
          minHeight: '100vh',
          bg: 'bg.canvas',
          pt: { base: 20, md: 24 },
          pb: { base: 8, md: 16 },
          px: { base: 4, sm: 6, md: 8 },
        })}
      >
        {/* Header */}
        <div
          className={css({
            textAlign: 'center',
            mb: { base: 8, md: 12, lg: 16 },
            maxWidth: '800px',
            mx: 'auto',
          })}
        >
          <div
            className={css({
              fontSize: { base: '4xl', md: '6xl' },
              mb: { base: 2, md: 4 },
            })}
          >
            ✨
          </div>
          <h1
            className={css({
              fontSize: { base: '2xl', sm: '3xl', md: '4xl', lg: '5xl' },
              fontWeight: 'extrabold',
              mb: { base: 3, md: 5 },
              color: 'text.primary',
              letterSpacing: 'tight',
            })}
          >
            {t('pageTitle')}
          </h1>
          <p
            className={css({
              fontSize: { base: 'md', sm: 'lg', md: 'xl' },
              color: 'text.secondary',
              lineHeight: '1.7',
              px: { base: 2, md: 0 },
            })}
          >
            {t('pageSubtitle')}
          </p>
        </div>

        {/* Creator Cards - Centered Grid */}
        <div
          className={css({
            display: 'flex',
            justifyContent: 'center',
          })}
        >
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: {
                base: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
              },
              gap: { base: 4, sm: 5, md: 6, lg: 8 },
              maxWidth: '1200px',
              width: '100%',
            })}
          >
            <CreatorCard
              type="flashcards"
              href="/create/flashcards"
              emoji="🃏"
              title={t('flashcards.title')}
              description={t('flashcards.description')}
              features={[
                t('flashcards.feature1'),
                t('flashcards.feature2'),
                t('flashcards.feature3'),
              ]}
              buttonText={t('flashcards.button')}
            />

            <CreatorCard
              type="worksheets"
              href="/create/worksheets"
              emoji="📝"
              title={t('worksheets.title')}
              description={t('worksheets.description')}
              features={[
                t('worksheets.feature1'),
                t('worksheets.feature2'),
                t('worksheets.feature3'),
              ]}
              buttonText={t('worksheets.button')}
            />

            <CreatorCard
              type="calendar"
              href="/create/calendar"
              emoji="📅"
              title={t('calendar.title')}
              description={t('calendar.description')}
              features={[t('calendar.feature1'), t('calendar.feature2'), t('calendar.feature3')]}
              buttonText={t('calendar.button')}
            />
          </div>
        </div>
      </div>
    </PageWithNav>
  )
}
