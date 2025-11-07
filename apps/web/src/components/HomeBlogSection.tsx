'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { BlogPostMetadata } from '@/lib/blog'
import { css } from '../../styled-system/css'

export function HomeBlogSection() {
  const [featuredPosts, setFeaturedPosts] = useState<BlogPostMetadata[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch featured posts from API
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
    return null // Don't show anything while loading
  }

  if (featuredPosts.length === 0) {
    return null // Don't show section if no posts
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
            color: 'rgba(209, 213, 219, 0.8)',
          })}
        >
          Insights on ed-tech and pedagogy
        </p>
      </div>

      {/* Featured Posts List */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '4',
        })}
      >
        {featuredPosts.map((post) => {
          const publishedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })

          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className={css({
                display: 'block',
                p: '4',
                bg: 'rgba(139, 92, 246, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '0.5rem',
                border: '1px solid',
                borderColor: 'rgba(139, 92, 246, 0.3)',
                transition: 'all 0.3s',
                _hover: {
                  bg: 'rgba(139, 92, 246, 0.15)',
                  borderColor: 'rgba(139, 92, 246, 0.5)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(139, 92, 246, 0.2)',
                },
              })}
            >
              <h3
                className={css({
                  fontSize: { base: 'lg', md: 'xl' },
                  fontWeight: '600',
                  mb: '2',
                  color: 'white',
                  lineHeight: '1.3',
                })}
              >
                {post.title}
              </h3>
              <p
                className={css({
                  color: 'rgba(209, 213, 219, 0.8)',
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
                  color: 'rgba(196, 181, 253, 0.8)',
                })}
              >
                <span>{post.author}</span>
                <span>•</span>
                <time dateTime={post.publishedAt}>{publishedDate}</time>
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
                        bg: 'rgba(139, 92, 246, 0.2)',
                        color: 'rgba(196, 181, 253, 1)',
                        borderRadius: '0.25rem',
                        fontSize: '2xs',
                        fontWeight: '500',
                      })}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          )
        })}
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
            bg: 'rgba(139, 92, 246, 0.2)',
            color: 'rgba(196, 181, 253, 1)',
            fontWeight: '600',
            fontSize: 'sm',
            borderRadius: '0.5rem',
            border: '1px solid',
            borderColor: 'rgba(139, 92, 246, 0.3)',
            transition: 'all 0.2s',
            _hover: {
              bg: 'rgba(139, 92, 246, 0.3)',
              borderColor: 'rgba(139, 92, 246, 0.5)',
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
