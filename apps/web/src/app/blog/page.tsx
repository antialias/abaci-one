import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPostsMetadata, getFeaturedPosts } from '@/lib/blog'
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

export default async function BlogIndex() {
  const featuredPosts = await getFeaturedPosts()
  const allPosts = await getAllPostsMetadata()

  return (
    <div
      data-component="blog-index-page"
      className={css({
        minH: '100vh',
        bg: 'gray.900',
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
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
              backgroundClip: 'text',
              color: 'transparent',
            })}
          >
            Blog
          </h1>
          <p
            className={css({
              fontSize: { base: '1.125rem', md: '1.25rem' },
              color: 'rgba(209, 213, 219, 0.8)',
              maxW: '42rem',
              mx: 'auto',
            })}
          >
            Exploring educational technology, pedagogy, and innovative approaches to learning.
          </p>
        </header>

        {/* Featured Posts */}
        {featuredPosts.length > 0 && (
          <section
            data-section="featured-posts"
            className={css({
              mb: '4rem',
            })}
          >
            <h2
              className={css({
                fontSize: { base: '1.5rem', md: '1.875rem' },
                fontWeight: 'bold',
                mb: '1.5rem',
                color: 'rgba(196, 181, 253, 1)',
              })}
            >
              Featured
            </h2>
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: { base: '1fr', md: 'repeat(auto-fit, minmax(300px, 1fr))' },
                gap: '1.5rem',
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
                    data-action="view-featured-post"
                    className={css({
                      display: 'block',
                      p: '1.5rem',
                      bg: 'rgba(139, 92, 246, 0.1)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '0.75rem',
                      border: '1px solid',
                      borderColor: 'rgba(139, 92, 246, 0.3)',
                      transition: 'all 0.3s',
                      _hover: {
                        bg: 'rgba(139, 92, 246, 0.15)',
                        borderColor: 'rgba(139, 92, 246, 0.5)',
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 24px rgba(139, 92, 246, 0.2)',
                      },
                    })}
                  >
                    <h3
                      className={css({
                        fontSize: { base: '1.25rem', md: '1.5rem' },
                        fontWeight: '600',
                        mb: '0.5rem',
                        color: 'white',
                      })}
                    >
                      {post.title}
                    </h3>
                    <p
                      className={css({
                        color: 'rgba(209, 213, 219, 0.8)',
                        mb: '1rem',
                        lineHeight: '1.6',
                      })}
                    >
                      {post.excerpt || post.description}
                    </p>
                    <div
                      className={css({
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        alignItems: 'center',
                        fontSize: '0.875rem',
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
                          gap: '0.5rem',
                          mt: '1rem',
                        })}
                      >
                        {post.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className={css({
                              px: '0.5rem',
                              py: '0.125rem',
                              bg: 'rgba(139, 92, 246, 0.2)',
                              color: 'rgba(196, 181, 253, 1)',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
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
          </section>
        )}

        {/* All Posts */}
        <section data-section="all-posts">
          <h2
            className={css({
              fontSize: { base: '1.5rem', md: '1.875rem' },
              fontWeight: 'bold',
              mb: '1.5rem',
              color: 'rgba(196, 181, 253, 1)',
            })}
          >
            All Posts
          </h2>
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem',
            })}
          >
            {allPosts.map((post) => {
              const publishedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })

              return (
                <article
                  key={post.slug}
                  data-element="post-preview"
                  className={css({
                    pb: '2rem',
                    borderBottom: '1px solid',
                    borderColor: 'rgba(75, 85, 99, 0.5)',
                    _last: {
                      borderBottom: 'none',
                    },
                  })}
                >
                  <Link
                    href={`/blog/${post.slug}`}
                    data-action="view-post"
                    className={css({
                      display: 'block',
                      _hover: {
                        '& h3': {
                          color: 'rgba(196, 181, 253, 1)',
                        },
                      },
                    })}
                  >
                    <h3
                      className={css({
                        fontSize: { base: '1.5rem', md: '1.875rem' },
                        fontWeight: '600',
                        mb: '0.5rem',
                        color: 'white',
                        transition: 'color 0.2s',
                      })}
                    >
                      {post.title}
                    </h3>
                  </Link>

                  <div
                    className={css({
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      alignItems: 'center',
                      fontSize: '0.875rem',
                      color: 'rgba(196, 181, 253, 0.7)',
                      mb: '1rem',
                    })}
                  >
                    <span>{post.author}</span>
                    <span>•</span>
                    <time dateTime={post.publishedAt}>{publishedDate}</time>
                  </div>

                  <p
                    className={css({
                      color: 'rgba(209, 213, 219, 0.8)',
                      lineHeight: '1.6',
                      mb: '1rem',
                    })}
                  >
                    {post.excerpt || post.description}
                  </p>

                  {post.tags.length > 0 && (
                    <div
                      className={css({
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      })}
                    >
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className={css({
                            px: '0.5rem',
                            py: '0.125rem',
                            bg: 'rgba(75, 85, 99, 0.5)',
                            color: 'rgba(209, 213, 219, 0.8)',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                          })}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
