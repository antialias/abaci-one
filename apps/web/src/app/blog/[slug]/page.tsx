import fs from 'fs'
import path from 'path'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BlogContent } from '@/components/blog/BlogContent'
import { HeroComponentBanner } from '@/components/blog/HeroComponentBanner'
import { getAllPostSlugs, getPostBySlug } from '@/lib/blog'
import { css } from '../../../../styled-system/css'

interface EmbedConfig {
  type: 'component' | 'html'
  componentId?: string
}

type EmbedConfigMap = Record<string, EmbedConfig>

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

  // Resolve hero data for rendering
  const contentDir = path.join(process.cwd(), 'content', 'blog')
  const publicDir = path.join(process.cwd(), 'public')
  const heroHtmlDir = path.join(contentDir, 'hero-html')

  let heroImageUrl: string | undefined
  if (post.heroImage) {
    heroImageUrl = post.heroImage
  } else if (fs.existsSync(path.join(publicDir, 'blog', `${params.slug}.png`))) {
    heroImageUrl = `/blog/${params.slug}.png`
  }

  let heroHtml: string | undefined
  if (post.heroType === 'html') {
    const htmlPath = path.join(heroHtmlDir, `${params.slug}.html`)
    if (fs.existsSync(htmlPath)) {
      heroHtml = fs.readFileSync(htmlPath, 'utf8')
    }
  }

  // Load embed config for inline embeds
  let embedConfigs: EmbedConfigMap = {}
  const embedConfigPath = path.join(contentDir, 'embeds', `${params.slug}.json`)
  if (fs.existsSync(embedConfigPath)) {
    try {
      embedConfigs = JSON.parse(fs.readFileSync(embedConfigPath, 'utf8'))
    } catch {
      // Invalid JSON — ignore
    }
  }

  // Pre-load HTML for html-type embeds
  const embedHtmlDir = path.join(contentDir, 'embed-html', params.slug)
  const embedHtmlMap: Record<string, string> = {}
  for (const [embedId, config] of Object.entries(embedConfigs)) {
    if (config.type === 'html') {
      const htmlPath = path.join(embedHtmlDir, `${embedId}.html`)
      if (fs.existsSync(htmlPath)) {
        embedHtmlMap[embedId] = fs.readFileSync(htmlPath, 'utf8')
      }
    }
  }

  const hasHero = !!(post.heroComponentId || heroHtml || heroImageUrl)

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

        {/* Hero Banner */}
        {hasHero && (
          <div
            data-element="post-hero"
            className={css({
              mb: '2rem',
              borderRadius: '0.75rem',
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'border.muted',
            })}
          >
            {post.heroComponentId ? (
              <HeroComponentBanner componentId={post.heroComponentId} />
            ) : heroHtml ? (
              <div
                data-element="html-banner"
                className={css({
                  position: 'relative',
                  width: '100%',
                  aspectRatio: { base: '16 / 9', md: '2.4 / 1' },
                  overflow: 'hidden',
                })}
                dangerouslySetInnerHTML={{ __html: heroHtml }}
              />
            ) : heroImageUrl ? (
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
                  src={heroImageUrl}
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
            ) : null}
          </div>
        )}

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
          <BlogContent html={post.html} embedConfigs={embedConfigs} embedHtmlMap={embedHtmlMap} />
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
