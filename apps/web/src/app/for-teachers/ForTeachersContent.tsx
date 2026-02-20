'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { css } from '../../../styled-system/css'
import { container, grid, hstack, stack } from '../../../styled-system/patterns'

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

// ─── Section 1: Hook — The remote teaching problem ───────────────────
function HookSection() {
  const t = useTranslations('forTeachers.hook')
  return (
    <Section id="hook" dark>
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
            color: 'gray.300',
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
            color: 'gray.300',
          })}
        >
          {t('p2')}
        </p>
      </div>
    </Section>
  )
}

// ─── Section 2: Abacus Vision ────────────────────────────────────────
function VisionSection() {
  const t = useTranslations('forTeachers.vision')

  const features = [
    { title: t('autoRead'), desc: t('autoReadDesc') },
    { title: t('liveTeaching'), desc: t('liveTeachingDesc') },
    { title: t('playback'), desc: t('playbackDesc') },
  ]

  return (
    <Section id="vision">
      <div className={stack({ gap: '40px' })}>
        <div className={stack({ gap: '16px', align: 'center', textAlign: 'center' })}>
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
              lineHeight: '1.7',
              maxW: '2xl',
              mx: 'auto',
              color: 'gray.600',
              _dark: { color: 'gray.300' },
            })}
          >
            {t('description')}
          </p>
        </div>

        <div className={stack({ gap: '24px' })}>
          {features.map((feature, i) => (
            <div
              key={i}
              data-element={`vision-feature-${i}`}
              className={css({
                p: '24px',
                borderRadius: 'xl',
                border: '1px solid',
                borderColor: 'gray.200',
                _dark: { borderColor: 'gray.700', bg: 'gray.800' },
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              })}
            >
              <h3 className={css({ fontSize: 'md', fontWeight: 'semibold' })}>{feature.title}</h3>
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'gray.500',
                  _dark: { color: 'gray.400' },
                  lineHeight: '1.7',
                })}
              >
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── Section 3: Skill Tracking & BKT ────────────────────────────────
function SkillsSection() {
  const t = useTranslations('forTeachers.skills')

  const points = [
    { title: t('bkt'), desc: t('bktDesc') },
    { title: t('targeting'), desc: t('targetingDesc') },
    { title: t('reporting'), desc: t('reportingDesc') },
  ]

  return (
    <Section id="skills" dark>
      <div className={stack({ gap: '40px' })}>
        <div className={stack({ gap: '16px', align: 'center', textAlign: 'center' })}>
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
              lineHeight: '1.7',
              maxW: '2xl',
              mx: 'auto',
              color: 'gray.300',
            })}
          >
            {t('description')}
          </p>
        </div>

        <div className={stack({ gap: '24px' })}>
          {points.map((point, i) => (
            <div
              key={i}
              data-element={`skills-point-${i}`}
              className={css({
                p: '24px',
                borderRadius: 'xl',
                bg: 'gray.800',
                border: '1px solid',
                borderColor: 'gray.700',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              })}
            >
              <h3 className={css({ fontSize: 'md', fontWeight: 'semibold' })}>{point.title}</h3>
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'gray.400',
                  lineHeight: '1.7',
                })}
              >
                {point.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── Section 4: Adaptive Practice ────────────────────────────────────
function AdaptiveSection() {
  const t = useTranslations('forTeachers.adaptive')

  const capabilities = [t('skillLevel'), t('sessionTime'), t('structure'), t('helpMode')]

  return (
    <Section id="adaptive">
      <div className={stack({ gap: '40px' })}>
        <div className={stack({ gap: '16px', align: 'center', textAlign: 'center' })}>
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
              lineHeight: '1.7',
              maxW: '2xl',
              mx: 'auto',
              color: 'gray.600',
              _dark: { color: 'gray.300' },
            })}
          >
            {t('description')}
          </p>
        </div>

        <ul
          data-element="adaptive-capabilities"
          className={css({
            listStyleType: 'none',
            p: 0,
            m: 0,
            maxW: '2xl',
            mx: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          })}
        >
          {capabilities.map((cap, i) => (
            <li
              key={i}
              className={css({
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                fontSize: 'md',
                lineHeight: '1.6',
                color: 'gray.600',
                _dark: { color: 'gray.300' },
              })}
            >
              <span
                className={css({
                  color: '#f59e0b',
                  flexShrink: 0,
                  mt: '2px',
                })}
                aria-hidden="true"
              >
                &#x2713;
              </span>
              {cap}
            </li>
          ))}
        </ul>

        <p
          className={css({
            fontSize: 'md',
            lineHeight: '1.7',
            maxW: '2xl',
            mx: 'auto',
            color: 'gray.500',
            _dark: { color: 'gray.400' },
            textAlign: 'center',
            fontStyle: 'italic',
          })}
        >
          {t('needsAttention')}
        </p>
      </div>
    </Section>
  )
}

// ─── Section 5: Live Observation ─────────────────────────────────────
function ObservationSection() {
  const t = useTranslations('forTeachers.observation')

  const features = [
    { title: t('remoteControl'), desc: t('remoteControlDesc') },
    { title: t('parentLinks'), desc: t('parentLinksDesc') },
    { title: t('mobile'), desc: t('mobileDesc') },
  ]

  return (
    <Section id="observation" dark>
      <div className={stack({ gap: '40px' })}>
        <div className={stack({ gap: '16px', align: 'center', textAlign: 'center' })}>
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
              lineHeight: '1.7',
              maxW: '2xl',
              mx: 'auto',
              color: 'gray.300',
            })}
          >
            {t('description')}
          </p>
        </div>

        <div className={grid({ columns: { base: 1, md: 3 }, gap: '24px' })}>
          {features.map((feature, i) => (
            <div
              key={i}
              data-element={`observation-feature-${i}`}
              className={css({
                p: '24px',
                borderRadius: 'xl',
                bg: 'gray.800',
                border: '1px solid',
                borderColor: 'gray.700',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              })}
            >
              <h3 className={css({ fontSize: 'md', fontWeight: 'semibold' })}>{feature.title}</h3>
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'gray.400',
                  lineHeight: '1.6',
                })}
              >
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── Section 6: Feature Grid ─────────────────────────────────────────
function FeaturesSection() {
  const t = useTranslations('forTeachers.features')

  const features = [
    { icon: '🔑', title: t('classroom'), desc: t('classroomDesc') },
    { icon: '🖨️', title: t('printable'), desc: t('printableDesc') },
    { icon: '📝', title: t('notes'), desc: t('notesDesc') },
    { icon: '📋', title: t('history'), desc: t('historyDesc') },
    { icon: '👥', title: t('bulk'), desc: t('bulkDesc') },
    { icon: '💻', title: t('devices'), desc: t('devicesDesc') },
  ]

  return (
    <Section id="features">
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

        <div className={grid({ columns: { base: 1, sm: 2, md: 3 }, gap: '20px' })}>
          {features.map((feature, i) => (
            <div
              key={i}
              data-element={`feature-card-${i}`}
              className={css({
                p: '20px',
                borderRadius: 'xl',
                border: '1px solid',
                borderColor: 'gray.200',
                _dark: { borderColor: 'gray.700', bg: 'gray.800' },
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              })}
            >
              <div className={hstack({ gap: '8px', alignItems: 'center' })}>
                <span className={css({ fontSize: 'xl' })} aria-hidden="true">
                  {feature.icon}
                </span>
                <h3 className={css({ fontSize: 'sm', fontWeight: 'semibold' })}>{feature.title}</h3>
              </div>
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'gray.500',
                  _dark: { color: 'gray.400' },
                  lineHeight: '1.5',
                })}
              >
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── Section 7: CTA ──────────────────────────────────────────────────
function CTASection() {
  const t = useTranslations('forTeachers.cta')
  return (
    <Section id="cta" dark>
      <div className={stack({ gap: '24px', align: 'center', textAlign: 'center' })}>
        <h2
          className={css({
            fontSize: { base: 'xl', md: '3xl' },
            fontWeight: 'bold',
          })}
        >
          {t('headline')}
        </h2>
        <div className={hstack({ gap: '16px', justify: 'center', flexWrap: 'wrap' })}>
          <Link
            href="/practice"
            data-action="cta-create-classroom"
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
          >
            {t('primaryButton')}
          </Link>
          <Link
            href="/why-abacus"
            data-action="cta-why-abacus"
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
              color: '#fbbf24',
              textDecoration: 'none',
              transition: 'all 0.2s',
              _hover: { bg: '#d97706', color: 'white' },
            })}
          >
            {t('secondaryButton')}
          </Link>
        </div>
        <p
          className={css({
            fontSize: 'sm',
            color: 'gray.400',
          })}
        >
          {t('reassurance')}
        </p>
      </div>
    </Section>
  )
}

// ─── Main Component ──────────────────────────────────────────────────
export default function ForTeachersContent() {
  return (
    <div
      data-component="for-teachers-page"
      className={css({
        minH: '100vh',
        pt: 'var(--app-nav-height-full)',
      })}
    >
      <HookSection />
      <VisionSection />
      <SkillsSection />
      <AdaptiveSection />
      <ObservationSection />
      <FeaturesSection />
      <CTASection />
    </div>
  )
}
