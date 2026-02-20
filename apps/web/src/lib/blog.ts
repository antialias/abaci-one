import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'

const postsDirectory = path.join(process.cwd(), 'content', 'blog')
const heroHtmlDirectory = path.join(postsDirectory, 'hero-html')

export interface BlogPost {
  slug: string
  title: string
  description: string
  author: string
  publishedAt: string
  updatedAt: string
  tags: string[]
  featured: boolean
  heroPrompt?: string
  heroImage?: string
  heroAspectRatio?: string
  heroCrop?: string
  heroType?: string
  heroStoryId?: string
  heroComponentId?: string
  content: string
  html: string
}

export interface BlogPostMetadata extends Omit<BlogPost, 'content' | 'html'> {
  excerpt?: string
  heroImageUrl?: string
  heroHtml?: string
}

/**
 * Get all blog post slugs (filenames without .md extension)
 */
export function getAllPostSlugs(): string[] {
  try {
    const fileNames = fs.readdirSync(postsDirectory)
    return fileNames
      .filter((fileName) => fileName.endsWith('.md'))
      .map((fileName) => fileName.replace(/\.md$/, ''))
  } catch {
    // Directory doesn't exist yet or is empty
    return []
  }
}

/**
 * Get metadata for all posts (without full content)
 */
export async function getAllPostsMetadata(): Promise<BlogPostMetadata[]> {
  const publicDir = path.join(process.cwd(), 'public')
  const slugs = getAllPostSlugs()
  const posts = await Promise.all(
    slugs.map(async (slug) => {
      const post = await getPostBySlug(slug)
      const { content, html, ...metadata } = post
      // Create excerpt from first prose paragraph (skip images, headings, HRs, HTML blocks)
      const firstPara = content.split('\n\n').find(
        (p) => {
          const t = p.trim()
          return t && !t.startsWith('![') && !t.startsWith('#') && t !== '---' && !t.includes('<')
        }
      ) ?? ''
      // Strip markdown bold/italic markers for clean display
      const stripped = firstPara.replace(/^#+\s+/, '').replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      const excerpt = `${stripped.substring(0, 200)}...`

      // Resolve hero image URL
      let heroImageUrl: string | undefined
      if (metadata.heroImage) {
        heroImageUrl = metadata.heroImage
      } else if (fs.existsSync(path.join(publicDir, 'blog', `${slug}.png`))) {
        heroImageUrl = `/blog/${slug}.png`
      }

      // Read hero HTML for html-type heroes (raw HTML from file)
      let heroHtml: string | undefined
      if (metadata.heroType === 'html') {
        const htmlPath = path.join(heroHtmlDirectory, `${slug}.html`)
        if (fs.existsSync(htmlPath)) {
          heroHtml = fs.readFileSync(htmlPath, 'utf8')
        }
      }

      // heroComponentId is passed through from frontmatter for component-type heroes
      return { ...metadata, excerpt, heroImageUrl, heroHtml }
    })
  )

  // Sort by published date, newest first
  return posts.sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })
}

/**
 * Get a single post by slug with full content
 */
export async function getPostBySlug(slug: string): Promise<BlogPost> {
  const fullPath = path.join(postsDirectory, `${slug}.md`)
  const fileContents = fs.readFileSync(fullPath, 'utf8')

  // Parse frontmatter
  const { data, content } = matter(fileContents)

  // Convert markdown to HTML
  const processedContent = await remark()
    .use(remarkGfm) // GitHub Flavored Markdown (tables, strikethrough, etc.)
    .use(remarkHtml, { sanitize: false })
    .process(content)

  const html = processedContent.toString()

  return {
    slug,
    title: data.title || 'Untitled',
    description: data.description || '',
    author: data.author || 'Anonymous',
    publishedAt: data.publishedAt || new Date().toISOString(),
    updatedAt: data.updatedAt || data.publishedAt || new Date().toISOString(),
    tags: data.tags || [],
    featured: data.featured || false,
    heroPrompt: data.heroPrompt || undefined,
    heroImage: data.heroImage || undefined,
    heroAspectRatio: data.heroAspectRatio || undefined,
    heroCrop: data.heroCrop || undefined,
    heroType: data.heroType || undefined,
    heroStoryId: data.heroStoryId || undefined,
    heroComponentId: data.heroComponentId || undefined,
    content,
    html,
  }
}

/**
 * Get featured posts for homepage
 */
export async function getFeaturedPosts(): Promise<BlogPostMetadata[]> {
  const allPosts = await getAllPostsMetadata()
  return allPosts.filter((post) => post.featured).slice(0, 3)
}

/**
 * Get posts by tag
 */
export async function getPostsByTag(tag: string): Promise<BlogPostMetadata[]> {
  const allPosts = await getAllPostsMetadata()
  return allPosts.filter((post) => post.tags.includes(tag))
}
