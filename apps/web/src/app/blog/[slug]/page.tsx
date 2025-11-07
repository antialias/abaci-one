import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPostBySlug, getAllPostSlugs } from '@/lib/blog'
import { css } from '../../../../styled-system/css'

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
            color: 'rgba(196, 181, 253, 0.8)',
            fontSize: '0.875rem',
            fontWeight: '500',
            textDecoration: 'none',
            transition: 'color 0.2s',
            _hover: {
              color: 'rgba(196, 181, 253, 1)',
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
              borderColor: 'rgba(75, 85, 99, 0.5)',
            })}
          >
            <h1
              className={css({
                fontSize: { base: '2rem', md: '2.5rem', lg: '3rem' },
                fontWeight: 'bold',
                lineHeight: '1.2',
                mb: '1rem',
                color: 'white',
              })}
            >
              {post.title}
            </h1>

            <p
              className={css({
                fontSize: { base: '1.125rem', md: '1.25rem' },
                color: 'rgba(209, 213, 219, 0.8)',
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
                color: 'rgba(196, 181, 253, 0.8)',
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
                      bg: 'rgba(139, 92, 246, 0.2)',
                      color: 'rgba(196, 181, 253, 1)',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    })}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Article Content */}
          <div
            data-section="article-content"
            className={css({
              fontSize: { base: '1rem', md: '1.125rem' },
              lineHeight: '1.75',
              color: 'rgba(229, 231, 235, 0.95)',

              // Typography styles for markdown content
              '& h1': {
                fontSize: { base: '1.875rem', md: '2.25rem' },
                fontWeight: 'bold',
                mt: '2.5rem',
                mb: '1rem',
                lineHeight: '1.25',
                color: 'white',
              },
              '& h2': {
                fontSize: { base: '1.5rem', md: '1.875rem' },
                fontWeight: 'bold',
                mt: '2rem',
                mb: '0.875rem',
                lineHeight: '1.3',
                color: 'rgba(196, 181, 253, 1)',
              },
              '& h3': {
                fontSize: { base: '1.25rem', md: '1.5rem' },
                fontWeight: '600',
                mt: '1.75rem',
                mb: '0.75rem',
                lineHeight: '1.4',
                color: 'rgba(196, 181, 253, 0.9)',
              },
              '& p': {
                mb: '1.25rem',
              },
              '& strong': {
                fontWeight: '600',
                color: 'white',
              },
              '& a': {
                color: 'rgba(147, 197, 253, 1)',
                textDecoration: 'underline',
                _hover: {
                  color: 'rgba(59, 130, 246, 1)',
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
                bg: 'rgba(0, 0, 0, 0.4)',
                px: '0.375rem',
                py: '0.125rem',
                borderRadius: '0.25rem',
                fontSize: '0.875em',
                fontFamily: 'monospace',
                color: 'rgba(196, 181, 253, 1)',
                border: '1px solid',
                borderColor: 'rgba(139, 92, 246, 0.3)',
              },
              '& pre': {
                bg: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid',
                borderColor: 'rgba(139, 92, 246, 0.3)',
                color: 'rgba(229, 231, 235, 0.95)',
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
                borderColor: 'rgba(139, 92, 246, 0.5)',
                pl: '1rem',
                py: '0.5rem',
                my: '1.5rem',
                color: 'rgba(209, 213, 219, 0.8)',
                fontStyle: 'italic',
                bg: 'rgba(139, 92, 246, 0.05)',
                borderRadius: '0 0.25rem 0.25rem 0',
              },
              '& hr': {
                my: '2rem',
                borderColor: 'rgba(75, 85, 99, 0.5)',
              },
              '& table': {
                width: '100%',
                mb: '1.25rem',
                borderCollapse: 'collapse',
              },
              '& th': {
                bg: 'rgba(139, 92, 246, 0.2)',
                px: '1rem',
                py: '0.75rem',
                textAlign: 'left',
                fontWeight: '600',
                borderBottom: '2px solid',
                borderColor: 'rgba(139, 92, 246, 0.5)',
                color: 'rgba(196, 181, 253, 1)',
              },
              '& td': {
                px: '1rem',
                py: '0.75rem',
                borderBottom: '1px solid',
                borderColor: 'rgba(75, 85, 99, 0.3)',
                color: 'rgba(209, 213, 219, 0.9)',
              },
              '& tr:hover td': {
                bg: 'rgba(139, 92, 246, 0.05)',
              },
            })}
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
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
