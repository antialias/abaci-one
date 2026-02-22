'use client'

import Link from 'next/link'
import { TIER_LIMITS } from '@/lib/tier-limits'
import { css } from '../../../../styled-system/css'
import { container, grid, stack } from '../../../../styled-system/patterns'

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

// ─── Section 1: Hero ─────────────────────────────────────────────────
function HeroSection() {
  return (
    <Section id="hero" dark>
      <div className={stack({ gap: '24px', align: 'center', textAlign: 'center' })}>
        <h1
          data-element="hero-headline"
          className={css({
            fontSize: { base: '2xl', md: '4xl' },
            fontWeight: 'bold',
            lineHeight: '1.2',
            maxW: '3xl',
            mx: 'auto',
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa, #c4b5fd)',
            backgroundClip: 'text',
            color: 'transparent',
          })}
        >
          From Paper to Practice
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
          Turn paper math worksheets into structured skill data. Snap a photo, and vision AI
          transcribes every problem — feeding results directly into your child&apos;s adaptive
          practice model.
        </p>
        <Link
          href="/practice"
          data-action="hero-cta"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            px: '24px',
            py: '12px',
            borderRadius: 'lg',
            fontWeight: 'semibold',
            fontSize: 'md',
            bg: '#7c3aed',
            color: 'white',
            textDecoration: 'none',
            transition: 'background 0.2s',
            _hover: { bg: '#6d28d9' },
          })}
        >
          Try It Now
        </Link>
      </div>
    </Section>
  )
}

// ─── Section 2: The Problem ──────────────────────────────────────────
function ProblemSection() {
  const problems = [
    {
      title: 'Paper worksheets',
      desc: 'Practiced offline, never recorded. Your child solves 20 problems at the kitchen table and none of it reaches the skill model.',
    },
    {
      title: 'Incomplete picture',
      desc: 'The adaptive engine only sees digital sessions. It stays blind to skills practiced on paper, making inaccurate mastery estimates.',
    },
    {
      title: 'Redundant practice',
      desc: 'Without knowing what was drilled offline, the next session reteaches skills your child already mastered on paper.',
    },
  ]

  return (
    <Section id="problem">
      <div className={stack({ gap: '40px' })}>
        <div className={stack({ gap: '16px', align: 'center', textAlign: 'center' })}>
          <h2
            className={css({
              fontSize: { base: 'xl', md: '3xl' },
              fontWeight: 'bold',
            })}
          >
            Most math practice is invisible
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
            Kids do math on paper every day — at school, in workbooks, on scrap paper. None of that
            practice feeds back into adaptive learning.
          </p>
        </div>

        <div className={grid({ columns: { base: 1, md: 3 }, gap: '24px' })}>
          {problems.map((problem, i) => (
            <div
              key={i}
              data-element={`problem-card-${i}`}
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
              <h3 className={css({ fontSize: 'md', fontWeight: 'semibold' })}>{problem.title}</h3>
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'gray.500',
                  _dark: { color: 'gray.400' },
                  lineHeight: '1.7',
                })}
              >
                {problem.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── Section 3: How It Works ─────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      icon: '1',
      title: 'Snap',
      desc: 'Take a photo of a completed worksheet — handwritten or printed.',
    },
    {
      icon: '2',
      title: 'Parse',
      desc: 'Vision AI reads each problem and answer, transcribing faithfully without interpretation.',
    },
    {
      icon: '3',
      title: 'Review',
      desc: 'High-confidence results auto-approve. Flagged items get your quick review with inline editing.',
    },
    {
      icon: '4',
      title: 'Learn',
      desc: 'Parsed results feed the BKT skill model. The next practice session adapts automatically.',
    },
  ]

  return (
    <Section id="how-it-works" dark>
      <div className={stack({ gap: '40px' })}>
        <div className={stack({ gap: '16px', align: 'center', textAlign: 'center' })}>
          <h2
            className={css({
              fontSize: { base: 'xl', md: '3xl' },
              fontWeight: 'bold',
            })}
          >
            Four steps to close the loop
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
            From paper to adaptive model in under a minute.
          </p>
        </div>

        <div className={grid({ columns: { base: 1, sm: 2, md: 4 }, gap: '24px' })}>
          {steps.map((step, i) => (
            <div
              key={i}
              data-element={`step-${i}`}
              className={css({
                p: '24px',
                borderRadius: 'xl',
                bg: 'gray.800',
                border: '1px solid',
                borderColor: 'gray.700',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                textAlign: 'center',
              })}
            >
              <span
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  bg: '#7c3aed',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 'lg',
                  mx: 'auto',
                })}
              >
                {step.icon}
              </span>
              <h3 className={css({ fontSize: 'md', fontWeight: 'semibold' })}>{step.title}</h3>
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'gray.400',
                  lineHeight: '1.6',
                })}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── Section 4: AI Parsing ───────────────────────────────────────────
function AiParsingSection() {
  const cards = [
    {
      title: 'Faithful transcription',
      desc: 'The AI reads what\'s on the page — no "fixing" answers or guessing intent. Anti-sycophancy by design.',
    },
    {
      title: 'Confidence scoring',
      desc: 'Every parsed problem gets a confidence score. High-confidence results auto-approve; uncertain ones get flagged for your review.',
    },
    {
      title: 'Live streaming',
      desc: "Watch the AI's reasoning in real time as it processes each problem. Full transparency into what it sees and how it interprets the worksheet.",
    },
    {
      title: 'Operator detection',
      desc: 'Distinguishes addition from subtraction, multiplication from division — even in messy handwriting.',
    },
  ]

  return (
    <Section id="ai-parsing">
      <div className={stack({ gap: '40px' })}>
        <div className={stack({ gap: '16px', align: 'center', textAlign: 'center' })}>
          <h2
            className={css({
              fontSize: { base: 'xl', md: '3xl' },
              fontWeight: 'bold',
            })}
          >
            Vision AI that reads, not interprets
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
            Built to transcribe faithfully — not to impress you with corrections.
          </p>
        </div>

        <div className={grid({ columns: { base: 1, sm: 2 }, gap: '24px' })}>
          {cards.map((card, i) => (
            <div
              key={i}
              data-element={`ai-card-${i}`}
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
              <h3 className={css({ fontSize: 'md', fontWeight: 'semibold' })}>{card.title}</h3>
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'gray.500',
                  _dark: { color: 'gray.400' },
                  lineHeight: '1.7',
                })}
              >
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── Section 5: Review Workflow ──────────────────────────────────────
function ReviewWorkflowSection() {
  const points = [
    'Auto-approval at 85% confidence — most problems need zero intervention',
    'Bounding box highlights show exactly which part of the image each problem came from',
    'Inline editing lets you correct a parsed answer without re-uploading',
    'Re-parse with hints when the AI misses a problem — give it a nudge and retry',
    'Resumable review: leave and come back without losing progress',
  ]

  return (
    <Section id="review-workflow" dark>
      <div className={stack({ gap: '40px' })}>
        <div className={stack({ gap: '16px', align: 'center', textAlign: 'center' })}>
          <h2
            className={css({
              fontSize: { base: 'xl', md: '3xl' },
              fontWeight: 'bold',
            })}
          >
            Human in the loop
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
            You stay in control. The AI does the heavy lifting, but you approve what matters.
          </p>
        </div>

        <ul
          data-element="review-points"
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
          {points.map((point, i) => (
            <li
              key={i}
              className={css({
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                fontSize: 'md',
                lineHeight: '1.6',
                color: 'gray.300',
              })}
            >
              <span
                className={css({
                  color: '#a78bfa',
                  flexShrink: 0,
                  mt: '2px',
                })}
                aria-hidden="true"
              >
                &#x2713;
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

// ─── Section 6: Skill Integration ────────────────────────────────────
function SkillIntegrationSection() {
  const flowSteps = [
    { label: 'Worksheet', color: '#7c3aed' },
    { label: 'Parse', color: '#8b5cf6' },
    { label: 'Skill Model', color: '#a78bfa' },
    { label: 'Smarter Practice', color: '#c4b5fd' },
  ]

  return (
    <Section id="skill-integration">
      <div className={stack({ gap: '40px' })}>
        <div className={stack({ gap: '16px', align: 'center', textAlign: 'center' })}>
          <h2
            className={css({
              fontSize: { base: 'xl', md: '3xl' },
              fontWeight: 'bold',
            })}
          >
            Every problem counts
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
            Parsed worksheet problems feed directly into the Bayesian Knowledge Tracing model. The
            next adaptive session already knows what your child practiced on paper.
          </p>
        </div>

        {/* Flow diagram */}
        <div
          data-element="skill-flow"
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { base: '8px', md: '16px' },
            flexWrap: 'wrap',
            maxW: '3xl',
            mx: 'auto',
          })}
        >
          {flowSteps.map((step, i) => (
            <div
              key={i}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: { base: '8px', md: '16px' },
              })}
            >
              <span
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  px: { base: '12px', md: '20px' },
                  py: { base: '8px', md: '10px' },
                  borderRadius: 'lg',
                  fontSize: { base: 'xs', md: 'sm' },
                  fontWeight: 'semibold',
                  color: 'white',
                })}
                style={{ backgroundColor: step.color }}
              >
                {step.label}
              </span>
              {i < flowSteps.length - 1 && (
                <span
                  className={css({
                    color: 'gray.400',
                    _dark: { color: 'gray.500' },
                    fontSize: 'lg',
                    flexShrink: 0,
                  })}
                  aria-hidden="true"
                >
                  &rarr;
                </span>
              )}
            </div>
          ))}
        </div>

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
          The skill model updates in real time — no waiting for the next session to reflect offline
          work.
        </p>
      </div>
    </Section>
  )
}

// ─── Section 7: Plans ────────────────────────────────────────────────
function PlansSection() {
  const freeParsings = TIER_LIMITS.free.maxOfflineParsingPerMonth
  const familyParsings = TIER_LIMITS.family.maxOfflineParsingPerMonth

  const plans = [
    {
      name: 'Free',
      parsings: `${freeParsings}/month`,
      desc: 'Enough to try it out and parse an occasional worksheet.',
      highlighted: false,
    },
    {
      name: 'Family',
      parsings: `${familyParsings}/month`,
      desc: 'For families who do regular offline practice and want every problem to count.',
      highlighted: true,
    },
  ]

  return (
    <Section id="plans" dark>
      <div className={stack({ gap: '40px' })}>
        <div className={stack({ gap: '16px', align: 'center', textAlign: 'center' })}>
          <h2
            className={css({
              fontSize: { base: 'xl', md: '3xl' },
              fontWeight: 'bold',
            })}
          >
            Parsing limits by plan
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
            Every plan includes worksheet parsing. Upgrade for more.
          </p>
        </div>

        <div
          className={grid({ columns: { base: 1, md: 2 }, gap: '24px', maxW: '2xl', mx: 'auto' })}
        >
          {plans.map((plan, i) => (
            <div
              key={i}
              data-element={`plan-card-${i}`}
              className={css({
                p: '24px',
                borderRadius: 'xl',
                bg: 'gray.800',
                border: '2px solid',
                borderColor: plan.highlighted ? '#7c3aed' : 'gray.700',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              })}
            >
              <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>{plan.name}</h3>
              <span
                className={css({
                  fontSize: '2xl',
                  fontWeight: 'bold',
                  color: plan.highlighted ? '#a78bfa' : 'gray.300',
                })}
              >
                {plan.parsings}
              </span>
              <p
                className={css({
                  fontSize: 'sm',
                  color: 'gray.400',
                  lineHeight: '1.6',
                })}
              >
                {plan.desc}
              </p>
            </div>
          ))}
        </div>

        <div className={css({ textAlign: 'center' })}>
          <Link
            href="/pricing"
            data-action="plans-cta"
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
              borderColor: '#7c3aed',
              color: '#c4b5fd',
              textDecoration: 'none',
              transition: 'all 0.2s',
              _hover: { bg: '#7c3aed', color: 'white' },
            })}
          >
            Compare All Plans
          </Link>
        </div>
      </div>
    </Section>
  )
}

// ─── Main Component ──────────────────────────────────────────────────
export default function WorksheetParsingContent() {
  return (
    <div data-component="worksheet-parsing-page">
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <AiParsingSection />
      <ReviewWorkflowSection />
      <SkillIntegrationSection />
      <PlansSection />
    </div>
  )
}
