import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { llm } from '@/lib/llm'
import { withAuth } from '@/lib/auth/withAuth'

const postsDirectory = path.join(process.cwd(), 'content', 'blog')

const SYSTEM_CONTEXT = `You are an expert prompt engineer for AI image generation. You're writing prompts for Abaci.one — an educational platform teaching mental math through the soroban (Japanese abacus). The image will be a hero/banner on the blog listing page displayed at 2.4:1 aspect ratio. Improve the given prompt to be more vivid, specific, and effective for image generation, without changing the subject or adding concepts not already indicated.`

/**
 * POST /api/admin/blog/[slug]/refine-prompt
 *
 * Uses an LLM to refine the current heroPrompt for better image generation.
 */
export const POST = withAuth(async (_request, { params }) => {
  const { slug } = (await params) as { slug: string }

  const filePath = path.join(postsDirectory, `${slug}.md`)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const fileContents = fs.readFileSync(filePath, 'utf8')
  const { data } = matter(fileContents)

  const heroPrompt = data.heroPrompt as string | undefined
  if (!heroPrompt) {
    return NextResponse.json({ error: 'Post has no heroPrompt' }, { status: 400 })
  }

  const title = (data.title as string) || 'Untitled'
  const description = (data.description as string) || ''

  const response = await llm.call({
    prompt: `${SYSTEM_CONTEXT}

Blog post title: "${title}"
Blog post description: "${description}"

Current hero image prompt:
"${heroPrompt}"

Provide an improved version of this prompt.`,
    schema: z.object({
      refined: z.string().describe('The improved image generation prompt'),
    }),
  })

  return NextResponse.json({
    original: heroPrompt,
    refined: response.data.refined,
  })
}, { role: 'admin' })
