'use client'

import { css } from '@styled/css'
import { useTranslations } from 'next-intl'
import { CreateToolCard } from '@/components/create/CreateToolCard'
import { PageWithNav } from '@/components/PageWithNav'
import { type CreateToolMeta, getCreateToolsByTier } from '@/lib/create-tools/createToolList'

const PRIMARY_TOOLS = getCreateToolsByTier('primary')
const SECONDARY_TOOLS = getCreateToolsByTier('secondary')

/**
 * The /create hub.
 *
 * `PageWithNav` is used WITHOUT `navTitle` on purpose: that path applies the
 * `var(--app-nav-height)` offset for us (so no magic `pt: 20` here) and skips
 * lazy-loading the ~100KB arcade `GameNavContent` branch, which this page has
 * no use for.
 */
export function CreateHubContent() {
  const t = useTranslations('create.hub')

  const cardCopy = (tool: CreateToolMeta) => ({
    title: t(`${tool.i18nKey}.title`),
    description: t(`${tool.i18nKey}.description`),
    features: Array.from({ length: tool.featureCount }, (_, i) =>
      t(`${tool.i18nKey}.feature${i + 1}`)
    ),
    buttonText: t(`${tool.i18nKey}.button`),
  })

  return (
    <PageWithNav>
      <div
        data-component="create-hub"
        className={css({
          minHeight: '100vh',
          bg: 'bg.canvas',
          pt: { base: 6, md: 10 },
          pb: { base: 10, md: 16 },
          px: { base: 4, sm: 6, md: 8 },
        })}
      >
        {/* Hero */}
        <header
          className={css({
            textAlign: 'center',
            maxWidth: '800px',
            mx: 'auto',
            mb: { base: 8, md: 12 },
          })}
        >
          <div aria-hidden="true" className={css({ fontSize: { base: '4xl', md: '5xl' }, mb: 2 })}>
            ✨
          </div>
          <h1
            className={css({
              fontSize: { base: '2xl', sm: '3xl', md: '4xl', lg: '5xl' },
              fontWeight: 'extrabold',
              mb: { base: 3, md: 4 },
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
            })}
          >
            {t('pageSubtitle')}
          </p>
        </header>

        {/* Primary row — the abacus trio */}
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <div
            data-element="create-tool-grid"
            data-tier="primary"
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
              // the flagship spans the full width at sm (2-up), then settles
              // into a normal third at lg (3-up)
              '& > :first-child': {
                sm: { gridColumn: 'span 2' },
                lg: { gridColumn: 'span 1' },
              },
            })}
          >
            {PRIMARY_TOOLS.map((tool, index) => (
              <CreateToolCard
                key={tool.id}
                tool={tool}
                variant={index === 0 ? 'flagship' : 'default'}
                eyebrow={index === 0 ? t('flagshipEyebrow') : undefined}
                {...cardCopy(tool)}
              />
            ))}
          </div>
        </div>

        {/* Secondary row — more printables */}
        <div
          className={css({
            display: 'flex',
            justifyContent: 'center',
            mt: { base: 10, md: 16 },
          })}
        >
          <section className={css({ maxWidth: '1200px', width: '100%' })}>
            <h2
              className={css({
                fontSize: { base: 'lg', md: 'xl' },
                fontWeight: 'bold',
                color: 'text.primary',
                letterSpacing: 'tight',
              })}
            >
              {t('moreHeading')}
            </h2>
            <p
              className={css({
                fontSize: { base: 'sm', md: 'md' },
                color: 'text.secondary',
                mt: 1,
                mb: { base: 4, md: 6 },
              })}
            >
              {t('moreSubheading')}
            </p>

            <div
              data-element="create-tool-grid"
              data-tier="secondary"
              className={css({
                display: 'grid',
                gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)' },
                gap: { base: 4, md: 6 },
              })}
            >
              {SECONDARY_TOOLS.map((tool) => (
                <CreateToolCard key={tool.id} tool={tool} variant="compact" {...cardCopy(tool)} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageWithNav>
  )
}

export default CreateHubContent
