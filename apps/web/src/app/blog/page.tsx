import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPostsMetadata, type BlogPostMetadata } from '@/lib/blog'
import { css } from '../../../styled-system/css'

export const metadata: Metadata = {
  title: 'Blog | Abaci.one',
  description:
    'Articles about educational technology, pedagogy, and innovative approaches to learning with the abacus.',
  openGraph: {
    title: 'Abaci.one Blog',
    description:
      'Articles about educational technology, pedagogy, and innovative approaches to learning with the abacus.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://abaci.one'}/blog`,
    siteName: 'Abaci.one',
    type: 'website',
  },
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div
      data-element="tags"
      className={css({
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
      })}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className={css({
            px: '0.5rem',
            py: '0.125rem',
            bg: 'bg.muted',
            color: 'text.secondary',
            borderRadius: '0.25rem',
            fontSize: '0.75rem',
            fontWeight: 500,
          })}
        >
          {tag}
        </span>
      ))}
    </div>
  )
}

function HeroBanner({ post }: { post: BlogPostMetadata }) {
  if (post.heroHtml) {
    return (
      <div
        data-element="component-banner"
        className={css({
          position: 'relative',
          width: '100%',
          aspectRatio: { base: '16 / 9', md: '2.4 / 1' },
          overflow: 'hidden',
        })}
        dangerouslySetInnerHTML={{ __html: post.heroHtml }}
      />
    )
  }

  return (
    <div
      data-element="image-banner"
      className={css({
        position: 'relative',
        width: '100%',
        aspectRatio: { base: '16 / 9', md: '2.4 / 1' },
        overflow: 'hidden',
      })}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={post.heroImageUrl}
        alt={post.title}
        style={{ objectPosition: post.heroCrop || 'center' }}
        className={css({
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        })}
      />
    </div>
  )
}

function ImageCard({ post }: { post: BlogPostMetadata }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      data-action="view-post"
      data-component="image-card"
      className={css({
        display: 'block',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        bg: 'bg.surface',
        border: '1px solid',
        borderColor: 'border.muted',
        transition: 'all 0.3s',
        _hover: {
          transform: 'translateY(-2px)',
          borderColor: 'accent.emphasis',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
        },
      })}
    >
      <article>
        <HeroBanner post={post} />
        <div
          className={css({
            p: { base: '1rem', md: '1.5rem' },
          })}
        >
          <h3
            className={css({
              fontSize: { base: '1.5rem', md: '1.875rem' },
              fontWeight: 600,
              mb: '0.5rem',
              color: 'text.primary',
            })}
          >
            {post.title}
          </h3>
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
              fontSize: '0.875rem',
              color: 'text.muted',
              mb: '0.75rem',
            })}
          >
            <span>{post.author}</span>
            <span>·</span>
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          </div>
          <p
            className={css({
              color: 'text.secondary',
              lineHeight: '1.6',
              mb: '1rem',
            })}
          >
            {post.excerpt || post.description}
          </p>
          <Tags tags={post.tags} />
        </div>
      </article>
    </Link>
  )
}

function TextCard({ post }: { post: BlogPostMetadata }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      data-action="view-post"
      data-component="text-card"
      className={css({
        display: 'block',
        borderRadius: '0.5rem',
        bg: 'bg.surface',
        border: '1px solid',
        borderColor: 'border.muted',
        p: { base: '1rem', md: '1.5rem' },
        transition: 'all 0.2s',
        _hover: {
          borderColor: 'border.default',
          '& h3': {
            color: 'accent.emphasis',
          },
        },
      })}
    >
      <article>
        <div
          className={css({
            display: 'flex',
            flexDirection: { base: 'column', md: 'row' },
            alignItems: { md: 'baseline' },
            gap: { base: '0.25rem', md: '0.75rem' },
            mb: '0.5rem',
          })}
        >
          <h3
            className={css({
              fontSize: { base: '1.25rem', md: '1.375rem' },
              fontWeight: 600,
              color: 'text.primary',
              transition: 'color 0.2s',
            })}
          >
            {post.title}
          </h3>
          <div
            className={css({
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              fontSize: '0.8125rem',
              color: 'text.muted',
              flexShrink: 0,
            })}
          >
            <span>{post.author}</span>
            <span>·</span>
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          </div>
        </div>
        <p
          className={css({
            color: 'text.secondary',
            lineHeight: '1.6',
            mb: '0.75rem',
            fontSize: '0.9375rem',
          })}
        >
          {post.excerpt || post.description}
        </p>
        <Tags tags={post.tags} />
      </article>
    </Link>
  )
}

export default async function BlogIndex() {
  const allPosts = await getAllPostsMetadata()

  return (
    <div
      data-component="blog-index-page"
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
          maxW: '64rem',
          mx: 'auto',
          px: { base: '1rem', md: '2rem' },
          py: { base: '2rem', md: '4rem' },
        })}
      >
        {/* Page Header */}
        <header
          data-section="page-header"
          className={css({
            mb: '3rem',
            textAlign: 'center',
          })}
        >
          <h1
            className={css({
              fontSize: { base: '2.5rem', md: '3.5rem' },
              fontWeight: 'bold',
              mb: '1rem',
              background:
                'linear-gradient(135deg, token(colors.amber.400) 0%, token(colors.amber.500) 50%, token(colors.amber.400) 100%)',
              backgroundClip: 'text',
              color: 'transparent',
            })}
          >
            Blog
          </h1>
          <p
            className={css({
              fontSize: { base: '1.125rem', md: '1.25rem' },
              color: 'text.secondary',
              maxW: '42rem',
              mx: 'auto',
            })}
          >
            Exploring educational technology, pedagogy, and innovative approaches to learning.
          </p>
        </header>

        {/* Unified post stream */}
        <section
          data-section="posts"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          })}
        >
          {allPosts.map((post) =>
            post.heroImageUrl || post.heroHtml ? (
              <ImageCard key={post.slug} post={post} />
            ) : (
              <TextCard key={post.slug} post={post} />
            )
          )}
        </section>
      </div>
    </div>
  )
}
