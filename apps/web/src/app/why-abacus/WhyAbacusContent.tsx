'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { AbacusReact, ABACUS_THEMES, useAbacusConfig } from '@soroban/abacus-react'
import { css } from '../../../styled-system/css'
import { container, grid, hstack, stack } from '../../../styled-system/patterns'

// ─── Cycling abacus hook ─────────────────────────────────────────────
function useCyclingValue(values: number[], intervalMs: number) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % values.length)
    }, intervalMs)
    return () => clearInterval(id)
  }, [values, intervalMs])
  return values[index]
}

// ─── Section wrapper ─────────────────────────────────────────────────
function Section({
  children,
  id,
  dark,
}: {
  children: React.ReactNode
  id: string
  dark?: boolean
}) {
  return (
    <section
      data-section={id}
      className={css({
        py: { base: '48px', md: '80px' },
        px: { base: '16px', md: '24px' },
        bg: dark ? 'gray.900' : 'transparent',
        color: dark ? 'white' : 'inherit',
      })}
    >
      <div className={container({ maxW: '4xl' })}>{children}</div>
    </section>
  )
}

// ─── Section 1: Hook ─────────────────────────────────────────────────
function HookSection() {
  const t = useTranslations('whyAbacus.hook')
  return (
    <Section id="hook">
      <div className={stack({ gap: '24px', align: 'center', textAlign: 'center' })}>
        <h1
          className={css({
            fontSize: { base: '2xl', md: '4xl' },
            fontWeight: 'bold',
            lineHeight: '1.2',
            maxW: '3xl',
            mx: 'auto',
            background: 'linear-gradient(135deg, #d97706, #f59e0b, #fbbf24)',
            backgroundClip: 'text',
            color: 'transparent',
          })}
        >
          {t('headline')}
        </h1>
        <p
          className={css({
            fontSize: { base: 'md', md: 'lg' },
            lineHeight: '1.7',
            maxW: '2xl',
            mx: 'auto',
            color: 'gray.600',
            _dark: { color: 'gray.300' },
          })}
        >
          {t('p1')}
        </p>
        <p
          className={css({
            fontSize: { base: 'md', md: 'lg' },
            lineHeight: '1.7',
            maxW: '2xl',
            mx: 'auto',
            color: 'gray.600',
            _dark: { color: 'gray.300' },
          })}
        >
          {t('p2')}
        </p>
      </div>
    </Section>
  )
}

// ─── Section 2: How the Abacus Represents Numbers ────────────────────
function RepresentSection() {
  const t = useTranslations('whyAbacus.represent')
  const appConfig = useAbacusConfig()
  const structuralStyles = ABACUS_THEMES.light
  const [singleValue, setSingleValue] = useState(0)
  const cyclingValue = useCyclingValue([42, 137, 508], 2500)

  const handleValueChange = useCallback((v: number | bigint) => {
    setSingleValue(Number(v))
  }, [])

  return (
    <Section id="represent" dark>
      <div className={stack({ gap: '40px' })}>
        <h2
          className={css({
            fontSize: { base: 'xl', md: '3xl' },
            fontWeight: 'bold',
            textAlign: 'center',
          })}
        >
          {t('headline')}
        </h2>

        {/* Interactive single-column abacus */}
        <div
          className={css({
            display: 'flex',
            flexDirection: { base: 'column', md: 'row' },
            gap: '32px',
            alignItems: 'center',
          })}
        >
          <div className={css({ flex: 1, maxW: '480px' })}>
            <p
              className={css({
                fontSize: 'md',
                lineHeight: '1.7',
                color: 'gray.300',
              })}
            >
              {t('description')}
            </p>
          </div>
          <div
            className={css({
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            })}
            data-element="interactive-abacus"
          >
            <AbacusReact
              value={singleValue}
              columns={1}
              beadShape={appConfig.beadShape}
              showNumbers={true}
              interactive={true}
              animated={true}
              customStyles={structuralStyles}
              onValueChange={handleValueChange}
            />
            <p
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                fontVariantNumeric: 'tabular-nums',
              })}
            >
              {t('currentValue', { value: singleValue })}
            </p>
          </div>
        </div>

        {/* Cycling 3-column abacus */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            pt: '24px',
            borderTop: '1px solid',
            borderColor: 'gray.700',
          })}
          data-element="cycling-abacus"
        >
          <AbacusReact
            value={cyclingValue}
            columns={3}
            beadShape={appConfig.beadShape}
            showNumbers={true}
            interactive={false}
            animated={true}
            customStyles={structuralStyles}
          />
          <p
            className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              fontVariantNumeric: 'tabular-nums',
            })}
          >
            {cyclingValue}
          </p>
        </div>
      </div>
    </Section>
  )
}

// ─── Section 3: Friends of 5 and Friends of 10 ──────────────────────
function FriendsSection() {
  const t = useTranslations('whyAbacus.friends')
  const appConfig = useAbacusConfig()
  const structuralStyles = ABACUS_THEMES.light

  const friends5Value = useCyclingValue([1, 4, 2, 3], 2000)
  const friends10Value = useCyclingValue([2, 8, 3, 7], 2000)

  return (
    <Section id="friends">
      <div className={stack({ gap: '40px' })}>
        <h2
          className={css({
            fontSize: { base: 'xl', md: '3xl' },
            fontWeight: 'bold',
            textAlign: 'center',
          })}
        >
          {t('headline')}
        </h2>
        <p
          className={css({
            fontSize: 'md',
            lineHeight: '1.7',
            textAlign: 'center',
            maxW: '2xl',
            mx: 'auto',
            color: 'gray.600',
            _dark: { color: 'gray.300' },
          })}
        >
          {t('description')}
        </p>

        <div
          className={grid({
            columns: { base: 1, md: 2 },
            gap: '24px',
          })}
        >
          {/* Friends of 5 card */}
          <div
            className={css({
              p: '24px',
              borderRadius: 'xl',
              border: '1px solid',
              borderColor: 'gray.200',
              _dark: { borderColor: 'gray.700', bg: 'gray.800' },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            })}
            data-element="friends-of-5"
          >
            <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>{t('friendsOf5')}</h3>
            <AbacusReact
              value={friends5Value}
              columns={1}
              beadShape={appConfig.beadShape}
              showNumbers={true}
              interactive={false}
              animated={true}
              customStyles={structuralStyles}
            />
            <p
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                fontVariantNumeric: 'tabular-nums',
              })}
            >
              {friends5Value} + {5 - friends5Value} = 5
            </p>
            <p
              className={css({
                fontSize: 'sm',
                color: 'gray.500',
                _dark: { color: 'gray.400' },
                textAlign: 'center',
              })}
            >
              {t('friendsOf5Desc')}
            </p>
          </div>

          {/* Friends of 10 card */}
          <div
            className={css({
              p: '24px',
              borderRadius: 'xl',
              border: '1px solid',
              borderColor: 'gray.200',
              _dark: { borderColor: 'gray.700', bg: 'gray.800' },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            })}
            data-element="friends-of-10"
          >
            <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>{t('friendsOf10')}</h3>
            <AbacusReact
              value={friends10Value}
              columns={2}
              beadShape={appConfig.beadShape}
              showNumbers={true}
              interactive={false}
              animated={true}
              customStyles={structuralStyles}
            />
            <p
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                fontVariantNumeric: 'tabular-nums',
              })}
            >
              {friends10Value} + {10 - friends10Value} = 10
            </p>
            <p
              className={css({
                fontSize: 'sm',
                color: 'gray.500',
                _dark: { color: 'gray.400' },
                textAlign: 'center',
              })}
            >
              {t('friendsOf10Desc')}
            </p>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── Section 4: The Progression ──────────────────────────────────────
function ProgressionSection() {
  const t = useTranslations('whyAbacus.progression')
  const appConfig = useAbacusConfig()
  const structuralStyles = ABACUS_THEMES.light

  return (
    <Section id="progression" dark>
      <div className={stack({ gap: '40px' })}>
        <h2
          className={css({
            fontSize: { base: 'xl', md: '3xl' },
            fontWeight: 'bold',
            textAlign: 'center',
          })}
        >
          {t('headline')}
        </h2>
        <p
          className={css({
            fontSize: 'md',
            lineHeight: '1.7',
            textAlign: 'center',
            maxW: '2xl',
            mx: 'auto',
            color: 'gray.300',
          })}
        >
          {t('description')}
        </p>

        <div className={grid({ columns: { base: 1, md: 3 }, gap: '24px' })}>
          {/* Physical */}
          <div
            className={css({
              p: '24px',
              borderRadius: 'xl',
              bg: 'gray.800',
              border: '1px solid',
              borderColor: 'gray.700',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              textAlign: 'center',
            })}
            data-element="stage-physical"
          >
            <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>{t('physical')}</h3>
            <AbacusReact
              value={7}
              columns={1}
              beadShape={appConfig.beadShape}
              showNumbers={false}
              interactive={false}
              animated={false}
              customStyles={structuralStyles}
            />
            <p className={css({ fontSize: 'sm', color: 'gray.400' })}>{t('physicalDesc')}</p>
          </div>

          {/* Visualization */}
          <div
            className={css({
              p: '24px',
              borderRadius: 'xl',
              bg: 'gray.800',
              border: '1px solid',
              borderColor: 'gray.700',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              textAlign: 'center',
            })}
            data-element="stage-visualization"
          >
            <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>
              {t('visualization')}
            </h3>
            <div className={css({ opacity: 0.3, filter: 'blur(2px)' })}>
              <AbacusReact
                value={7}
                columns={1}
                beadShape={appConfig.beadShape}
                showNumbers={false}
                interactive={false}
                animated={false}
                customStyles={structuralStyles}
              />
            </div>
            <p className={css({ fontSize: 'sm', color: 'gray.400' })}>{t('visualizationDesc')}</p>
          </div>

          {/* Anzan */}
          <div
            className={css({
              p: '24px',
              borderRadius: 'xl',
              bg: 'gray.800',
              border: '1px solid',
              borderColor: 'gray.700',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              textAlign: 'center',
              justifyContent: 'center',
            })}
            data-element="stage-anzan"
          >
            <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>{t('anzan')}</h3>
            <p
              className={css({
                fontSize: '5xl',
                fontWeight: 'bold',
                fontVariantNumeric: 'tabular-nums',
                color: '#f59e0b',
              })}
            >
              7
            </p>
            <p className={css({ fontSize: 'sm', color: 'gray.400' })}>{t('anzanDesc')}</p>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── Section 5: Research ─────────────────────────────────────────────
function ResearchSection() {
  const t = useTranslations('whyAbacus.research')
  return (
    <Section id="research">
      <div className={stack({ gap: '24px', maxW: '2xl', mx: 'auto' })}>
        <h2
          className={css({
            fontSize: { base: 'xl', md: '3xl' },
            fontWeight: 'bold',
            textAlign: 'center',
          })}
        >
          {t('headline')}
        </h2>
        <p
          className={css({
            fontSize: 'md',
            lineHeight: '1.7',
            color: 'gray.600',
            _dark: { color: 'gray.300' },
          })}
        >
          {t('p1')}
        </p>
        <p
          className={css({
            fontSize: 'md',
            lineHeight: '1.7',
            color: 'gray.600',
            _dark: { color: 'gray.300' },
          })}
        >
          {t('p2')}
        </p>
        <Link
          href="/blog/why-abacus-never-reached-us-schools"
          className={css({
            color: '#d97706',
            fontWeight: 'semibold',
            textDecoration: 'underline',
            textUnderlineOffset: '4px',
            _hover: { color: '#f59e0b' },
          })}
          data-action="read-blog-post"
        >
          {t('blogLink')}
        </Link>
      </div>
    </Section>
  )
}

// ─── Section 6: Objections FAQ ───────────────────────────────────────
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={css({
        borderBottom: '1px solid',
        borderColor: 'gray.200',
        _dark: { borderColor: 'gray.700' },
      })}
      data-element="faq-item"
    >
      <button
        onClick={() => setOpen(!open)}
        className={css({
          w: '100%',
          py: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          fontSize: { base: 'md', md: 'lg' },
          fontWeight: 'semibold',
          textAlign: 'left',
          bg: 'transparent',
          border: 'none',
          color: 'inherit',
        })}
        data-action="toggle-faq"
        aria-expanded={open}
      >
        {question}
        <span
          className={css({
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
            ml: '12px',
          })}
          aria-hidden="true"
        >
          &#x25BC;
        </span>
      </button>
      {open && (
        <p
          className={css({
            pb: '16px',
            fontSize: 'md',
            lineHeight: '1.7',
            color: 'gray.600',
            _dark: { color: 'gray.300' },
          })}
        >
          {answer}
        </p>
      )}
    </div>
  )
}

function ObjectionsSection() {
  const t = useTranslations('whyAbacus.objections')
  const items = [
    { q: t('q1'), a: t('a1') },
    { q: t('q2'), a: t('a2') },
    { q: t('q3'), a: t('a3') },
    { q: t('q4'), a: t('a4') },
  ]

  return (
    <Section id="objections" dark>
      <div className={stack({ gap: '16px', maxW: '2xl', mx: 'auto' })}>
        <h2
          className={css({
            fontSize: { base: 'xl', md: '3xl' },
            fontWeight: 'bold',
            textAlign: 'center',
            mb: '16px',
          })}
        >
          {t('headline')}
        </h2>
        {items.map((item, i) => (
          <FAQItem key={i} question={item.q} answer={item.a} />
        ))}
      </div>
    </Section>
  )
}

// ─── Section 7: CTA ──────────────────────────────────────────────────
function CTASection() {
  const t = useTranslations('whyAbacus.cta')
  return (
    <Section id="cta">
      <div
        className={stack({
          gap: '24px',
          align: 'center',
          textAlign: 'center',
        })}
      >
        <h2
          className={css({
            fontSize: { base: 'xl', md: '3xl' },
            fontWeight: 'bold',
          })}
        >
          {t('headline')}
        </h2>
        <p
          className={css({
            fontSize: 'md',
            color: 'gray.600',
            _dark: { color: 'gray.300' },
            maxW: 'lg',
          })}
        >
          {t('description')}
        </p>
        <div className={hstack({ gap: '16px', justify: 'center', flexWrap: 'wrap' })}>
          <Link
            href="/practice"
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              px: '24px',
              py: '12px',
              borderRadius: 'lg',
              fontWeight: 'semibold',
              fontSize: 'md',
              bg: '#d97706',
              color: 'white',
              textDecoration: 'none',
              transition: 'background 0.2s',
              _hover: { bg: '#b45309' },
            })}
            data-action="cta-practice"
          >
            {t('primaryButton')}
          </Link>
          <Link
            href="/guide"
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              px: '24px',
              py: '12px',
              borderRadius: 'lg',
              fontWeight: 'semibold',
              fontSize: 'md',
              bg: 'transparent',
              border: '2px solid',
              borderColor: '#d97706',
              color: '#d97706',
              textDecoration: 'none',
              transition: 'all 0.2s',
              _hover: { bg: '#d97706', color: 'white' },
            })}
            data-action="cta-guide"
          >
            {t('secondaryButton')}
          </Link>
        </div>
        <Link
          href="/for-teachers"
          data-action="for-teachers"
          className={css({
            color: 'gray.500',
            _dark: { color: 'gray.400' },
            fontSize: 'sm',
            transition: 'color 0.2s',
            _hover: { color: '#d97706' },
          })}
        >
          {t('forTeachers')}
        </Link>
      </div>
    </Section>
  )
}

// ─── Main Component ──────────────────────────────────────────────────
export default function WhyAbacusContent() {
  return (
    <div
      data-component="why-abacus-page"
      className={css({
        minH: '100vh',
        pt: 'var(--app-nav-height-full)',
      })}
    >
      <HookSection />
      <RepresentSection />
      <FriendsSection />
      <ProgressionSection />
      <ResearchSection />
      <ObjectionsSection />
      <CTASection />
    </div>
  )
}
