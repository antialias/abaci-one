import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPostBySlug, getAllPostSlugs } from '@/lib/blog'
import { css } from '../../../../styled-system/css'
import { SkillDifficultyCharts } from '@/components/blog/SkillDifficultyCharts'
import {
  AutomaticityMultiplierCharts,
  ClassificationCharts,
  EvidenceQualityCharts,
  ThreeWayComparisonCharts,
  ValidationResultsCharts,
} from '@/components/blog/ValidationCharts'

interface ChartInjection {
  component: React.ComponentType
  /** Heading text to insert after (e.g., "### Example Trajectory") */
  insertAfter: string
}

/** Blog posts that have interactive chart sections */
const POSTS_WITH_CHARTS: Record<string, ChartInjection[]> = {
  'conjunctive-bkt-skill-tracing': [
    {
      component: EvidenceQualityCharts,
      insertAfter: '## Evidence Quality Modifiers',
    },
    {
      component: AutomaticityMultiplierCharts,
      insertAfter: '### Automaticity Multipliers',
    },
    {
      component: ClassificationCharts,
      insertAfter: '## Automaticity Classification',
    },
    {
      component: SkillDifficultyCharts,
      insertAfter: '## Skill-Specific Difficulty Model',
    },
    {
      component: ThreeWayComparisonCharts,
      insertAfter: '### 3-Way Comparison: BKT vs Fluency Multipliers',
    },
    {
      component: ValidationResultsCharts,
      insertAfter: '### Convergence Speed Results',
    },
  ],
}

interface Props {
  params: {
    slug: string
  }
}

// Generate static params for all blog posts
export async function generateStaticParams() {
  const slugs = getAllPostSlugs()
  return slugs.map((slug) => ({ slug }))
}

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://abaci.one'
  const postUrl = `${siteUrl}/blog/${params.slug}`

  return {
    title: `${post.title} | Abaci.one Blog`,
    description: post.description,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      url: postUrl,
      siteName: 'Abaci.one',
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
    alternates: {
      canonical: postUrl,
    },
  }
}

export default async function BlogPost({ params }: Props) {
  let post
  try {
    post = await getPostBySlug(params.slug)
  } catch {
    notFound()
  }

  // Format date for display
  const publishedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const updatedDate = new Date(post.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const showUpdatedDate = post.publishedAt !== post.updatedAt

  return (
    <div
      data-component="blog-post-page"
      className={css({
        minH: '100vh',
        bg: 'bg.canvas',
        pt: 'var(--app-nav-height-full)',
      })}
    >
      {/* Background pattern */}
      <div
        className={css({
          position: 'fixed',
          inset: 0,
          opacity: 0.05,
          backgroundImage:
            'radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.15) 1px, transparent 0)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
          zIndex: 0,
        })}
      />

      <div
        className={css({
          position: 'relative',
          zIndex: 1,
          maxW: '48rem',
          mx: 'auto',
          px: { base: '1rem', md: '2rem' },
          py: { base: '2rem', md: '4rem' },
        })}
      >
        {/* Back link */}
        <Link
          href="/blog"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            mb: '2rem',
            color: 'accent.default',
            fontSize: '0.875rem',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'color 0.2s',
            _hover: {
              color: 'accent.emphasis',
            },
          })}
        >
          <span>←</span>
          <span>Back to Blog</span>
        </Link>

        {/* Article */}
        <article data-element="blog-article">
          <header
            data-section="article-header"
            className={css({
              mb: '3rem',
              pb: '2rem',
              borderBottom: '1px solid',
              borderColor: 'border.muted',
            })}
          >
            <h1
              className={css({
                fontSize: { base: '2rem', md: '2.5rem', lg: '3rem' },
                fontWeight: 'bold',
                lineHeight: '1.2',
                mb: '1rem',
                color: 'text.primary',
              })}
            >
              {post.title}
            </h1>

            <p
              className={css({
                fontSize: { base: '1.125rem', md: '1.25rem' },
                color: 'text.secondary',
                lineHeight: '1.6',
                mb: '1.5rem',
              })}
            >
              {post.description}
            </p>

            <div
              data-element="article-meta"
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'center',
                fontSize: '0.875rem',
                color: 'text.muted',
              })}
            >
              <span data-element="author">{post.author}</span>
              <span>•</span>
              <time dateTime={post.publishedAt}>{publishedDate}</time>
              {showUpdatedDate && (
                <>
                  <span>•</span>
                  <span>Updated: {updatedDate}</span>
                </>
              )}
            </div>

            {post.tags.length > 0 && (
              <div
                data-element="tags"
                className={css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  mt: '1rem',
                })}
              >
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className={css({
                      px: '0.75rem',
                      py: '0.25rem',
                      bg: 'accent.muted',
                      color: 'accent.emphasis',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    })}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Article Content */}
          <BlogContent slug={params.slug} html={post.html} />
        </article>

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: post.title,
              description: post.description,
              author: {
                '@type': 'Person',
                name: post.author,
              },
              datePublished: post.publishedAt,
              dateModified: post.updatedAt,
              keywords: post.tags.join(', '),
            }),
          }}
        />
      </div>
    </div>
  )
}

/** Content component that handles chart injection */
function BlogContent({ slug, html }: { slug: string; html: string }) {
  const chartConfigs = POSTS_WITH_CHARTS[slug]

  // If no charts for this post, render full content
  if (!chartConfigs || chartConfigs.length === 0) {
    return (
      <div
        data-section="article-content"
        className={articleContentStyles}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  // Build injection points: find each heading and its position
  const injections: Array<{ position: number; component: React.ComponentType }> = []

  for (const config of chartConfigs) {
    // Convert markdown heading to regex pattern for HTML
    // "### Example Trajectory" → matches <h3...>Example Trajectory</h3>
    const headingLevel = (config.insertAfter.match(/^#+/)?.[0].length || 2).toString()
    const headingText = config.insertAfter.replace(/^#+\s*/, '')
    const escapedText = headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Match the closing tag of the heading
    const pattern = new RegExp(
      `<h${headingLevel}[^>]*>[^<]*${escapedText}[^<]*</h${headingLevel}>`,
      'i'
    )
    const match = html.match(pattern)

    if (match && match.index !== undefined) {
      // Insert after the heading (after closing tag)
      const insertPosition = match.index + match[0].length
      injections.push({ position: insertPosition, component: config.component })
    }
  }

  // Sort by position (ascending) so we process in order
  injections.sort((a, b) => a.position - b.position)

  // If no injections found, render full content
  if (injections.length === 0) {
    return (
      <div
        data-section="article-content"
        className={articleContentStyles}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  // Split HTML at injection points and render with charts
  const segments: React.ReactNode[] = []
  let lastPosition = 0

  for (let i = 0; i < injections.length; i++) {
    const { position, component: ChartComponent } = injections[i]

    // Add HTML segment before this injection
    const htmlSegment = html.slice(lastPosition, position)
    if (htmlSegment) {
      segments.push(
        <div
          key={`html-${i}`}
          data-section={`article-content-${i}`}
          className={articleContentStyles}
          dangerouslySetInnerHTML={{ __html: htmlSegment }}
        />
      )
    }

    // Add the chart component
    segments.push(<ChartComponent key={`chart-${i}`} />)
    lastPosition = position
  }

  // Add remaining HTML after last injection
  const remainingHtml = html.slice(lastPosition)
  if (remainingHtml) {
    segments.push(
      <div
        key="html-final"
        data-section="article-content-final"
        className={articleContentStyles}
        dangerouslySetInnerHTML={{ __html: remainingHtml }}
      />
    )
  }

  return <>{segments}</>
}

const articleContentStyles = css({
  fontSize: { base: '1rem', md: '1.125rem' },
  lineHeight: '1.75',
  color: 'text.primary',

  // Typography styles for markdown content
  '& h1': {
    fontSize: { base: '1.875rem', md: '2.25rem' },
    fontWeight: 'bold',
    mt: '2.5rem',
    mb: '1rem',
    lineHeight: '1.25',
    color: 'text.primary',
  },
  '& h2': {
    fontSize: { base: '1.5rem', md: '1.875rem' },
    fontWeight: 'bold',
    mt: '2rem',
    mb: '0.875rem',
    lineHeight: '1.3',
    color: 'accent.emphasis',
  },
  '& h3': {
    fontSize: { base: '1.25rem', md: '1.5rem' },
    fontWeight: 600,
    mt: '1.75rem',
    mb: '0.75rem',
    lineHeight: '1.4',
    color: 'accent.default',
  },
  '& p': {
    mb: '1.25rem',
  },
  '& strong': {
    fontWeight: 600,
    color: 'text.primary',
  },
  '& a': {
    color: 'accent.emphasis',
    textDecoration: 'underline',
    _hover: {
      color: 'accent.default',
    },
  },
  '& ul, & ol': {
    pl: '1.5rem',
    mb: '1.25rem',
  },
  '& li': {
    mb: '0.5rem',
  },
  '& code': {
    bg: 'bg.muted',
    px: '0.375rem',
    py: '0.125rem',
    borderRadius: '0.25rem',
    fontSize: '0.875em',
    fontFamily: 'monospace',
    color: 'accent.emphasis',
    border: '1px solid',
    borderColor: 'accent.default',
  },
  '& pre': {
    bg: 'bg.surface',
    border: '1px solid',
    borderColor: 'border.default',
    color: 'text.primary',
    p: '1rem',
    borderRadius: '0.5rem',
    overflow: 'auto',
    mb: '1.25rem',
  },
  '& pre code': {
    bg: 'transparent',
    p: '0',
    border: 'none',
    color: 'inherit',
    fontSize: '0.875rem',
  },
  '& blockquote': {
    borderLeft: '4px solid',
    borderColor: 'accent.default',
    pl: '1rem',
    py: '0.5rem',
    my: '1.5rem',
    color: 'text.secondary',
    fontStyle: 'italic',
    bg: 'accent.subtle',
    borderRadius: '0 0.25rem 0.25rem 0',
  },
  '& hr': {
    my: '2rem',
    borderColor: 'border.muted',
  },
  '& table': {
    width: '100%',
    mb: '1.25rem',
    borderCollapse: 'collapse',
  },
  '& th': {
    bg: 'accent.muted',
    px: '1rem',
    py: '0.75rem',
    textAlign: 'left',
    fontWeight: 600,
    borderBottom: '2px solid',
    borderColor: 'accent.default',
    color: 'accent.emphasis',
  },
  '& td': {
    px: '1rem',
    py: '0.75rem',
    borderBottom: '1px solid',
    borderColor: 'border.muted',
    color: 'text.secondary',
  },
  '& tr:hover td': {
    bg: 'accent.subtle',
  },
})
