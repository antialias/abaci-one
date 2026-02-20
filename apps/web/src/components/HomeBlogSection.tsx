'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { BlogPostMetadata } from '@/lib/blog'
import { HeroComponentBanner } from '@/components/blog/HeroComponentBanner'
import { css } from '../../styled-system/css'

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function PostCard({ post }: { post: BlogPostMetadata }) {
  const hasComponent = !!post.heroComponentId
  const hasImage = !!post.heroImageUrl
  const hasHtml = !!post.heroHtml
  const hasBanner = hasComponent || hasImage || hasHtml

  return (
    <Link
      key={post.slug}
      href={`/blog/${post.slug}`}
      data-action="view-blog-post"
      className={css({
        display: 'block',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        bg: 'accent.subtle',
        backdropFilter: 'blur(10px)',
        border: '1px solid',
        borderColor: 'accent.muted',
        transition: 'all 0.3s',
        _hover: {
          bg: 'accent.muted',
          borderColor: 'accent.default',
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px token(colors.accent.muted)',
        },
      })}
    >
      {hasBanner && (
        hasComponent ? (
          <HeroComponentBanner componentId={post.heroComponentId!} />
        ) : hasHtml ? (
          <div
            data-element="html-banner"
            className={css({
              position: 'relative',
              width: '100%',
              aspectRatio: { base: '16 / 9', md: '2.4 / 1' },
              overflow: 'hidden',
            })}
            dangerouslySetInnerHTML={{ __html: post.heroHtml! }}
          />
        ) : (
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
      )}
      <div className={css({ p: '4' })}>
        <h3
          className={css({
            fontSize: { base: 'lg', md: 'xl' },
            fontWeight: 600,
            mb: '2',
            color: 'text.primary',
            lineHeight: '1.3',
          })}
        >
          {post.title}
        </h3>
        <p
          className={css({
            color: 'text.secondary',
            mb: '3',
            lineHeight: '1.5',
            fontSize: 'sm',
          })}
        >
          {post.excerpt || post.description}
        </p>
        <div
          className={css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: '2',
            alignItems: 'center',
            fontSize: 'xs',
            color: 'text.muted',
          })}
        >
          <span>{post.author}</span>
          <span>·</span>
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        </div>
        {post.tags.length > 0 && (
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.5',
              mt: '2',
            })}
          >
            {post.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className={css({
                  px: '1.5',
                  py: '0.25',
                  bg: 'accent.muted',
                  color: 'accent.emphasis',
                  borderRadius: '0.25rem',
                  fontSize: '2xs',
                  fontWeight: 500,
                })}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

export function HomeBlogSection() {
  const [featuredPosts, setFeaturedPosts] = useState<BlogPostMetadata[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPosts() {
      try {
        const response = await fetch('/api/blog/featured')
        if (response.ok) {
          const posts = await response.json()
          setFeaturedPosts(posts)
        }
      } catch (error) {
        console.error('Failed to fetch featured blog posts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [])

  if (loading) {
    return null
  }

  if (featuredPosts.length === 0) {
    return null
  }

  return (
    <section
      data-section="blog-preview"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '8',
      })}
    >
      {/* Section Header */}
      <div
        className={css({
          textAlign: 'center',
        })}
      >
        <h2
          className={css({
            fontSize: { base: '2xl', md: '3xl' },
            fontWeight: 'bold',
            mb: '2',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
            backgroundClip: 'text',
            color: 'transparent',
          })}
        >
          From the Blog
        </h2>
        <p
          className={css({
            fontSize: { base: 'sm', md: 'md' },
            color: 'text.secondary',
          })}
        >
          Insights on ed-tech and pedagogy
        </p>
      </div>

      {/* Featured Posts */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '4',
        })}
      >
        {featuredPosts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>

      {/* View All Link */}
      <div
        className={css({
          textAlign: 'center',
        })}
      >
        <Link
          href="/blog"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2',
            px: '4',
            py: '2',
            bg: 'accent.subtle',
            color: 'accent.emphasis',
            fontWeight: 600,
            fontSize: 'sm',
            borderRadius: '0.5rem',
            border: '1px solid',
            borderColor: 'accent.muted',
            transition: 'all 0.2s',
            _hover: {
              bg: 'accent.muted',
              borderColor: 'accent.default',
            },
          })}
        >
          <span>View All Posts</span>
          <span>→</span>
        </Link>
      </div>
    </section>
  )
}
