import type { ProviderConfig, ProviderRequest, ProviderResponse } from '../types'
import { LLMApiError, LLMTruncationError, LLMContentFilterError } from '../types'
import { BaseProvider } from './base'

/**
 * OpenAI message content item
 */
interface ContentItem {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
}

/**
 * OpenAI chat message
 */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentItem[]
}

/**
 * OpenAI chat completion response
 */
interface ChatCompletionResponse {
  id: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      refusal?: string | null
    }
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'function_call' | null
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * OpenAI error response structure
 */
interface OpenAIErrorResponse {
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

/**
 * OpenAI provider implementation
 *
 * Supports both text and vision models using the chat completions API
 * with JSON mode for structured output.
 */
export class OpenAIProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  async call(request: ProviderRequest): Promise<ProviderResponse> {
    const prompt = this.buildPrompt(request)
    const messages = this.buildMessages(prompt, request.images)

    const requestBody: Record<string, unknown> = {
      model: request.model,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          schema: request.jsonSchema,
          strict: true,
        },
      },
    }

    // Add reasoning_effort for GPT-5.2+ models
    if (request.reasoningEffort) {
      requestBody.reasoning_effort = request.reasoningEffort
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = errorText
      try {
        const errorJson = JSON.parse(errorText) as OpenAIErrorResponse
        errorMessage = errorJson.error?.message ?? errorText
      } catch {
        // Keep original text
      }

      // Parse Retry-After header for rate limits
      const retryAfterMs = this.parseRetryAfter(response.headers)

      throw new LLMApiError(this.name, response.status, errorMessage, retryAfterMs)
    }

    const data = (await response.json()) as ChatCompletionResponse

    if (!data.choices || data.choices.length === 0) {
      throw new LLMApiError(this.name, 500, 'No response choices returned')
    }

    const choice = data.choices[0]

    // Check for content filter refusal
    if (choice.finish_reason === 'content_filter') {
      throw new LLMContentFilterError(
        this.name,
        choice.message.refusal ?? 'Content was filtered by the model'
      )
    }

    // Check for model refusal (new in GPT-4o)
    if (choice.message.refusal) {
      throw new LLMContentFilterError(this.name, choice.message.refusal)
    }

    // Check for truncation due to token limits
    if (choice.finish_reason === 'length') {
      // Try to parse whatever we got
      let partialContent: unknown = null
      if (choice.message.content) {
        try {
          partialContent = this.parseJsonResponse(choice.message.content)
        } catch {
          partialContent = choice.message.content
        }
      }
      throw new LLMTruncationError(this.name, partialContent)
    }

    // Check for null content
    if (!choice.message.content) {
      throw new LLMApiError(this.name, 500, 'Empty response content')
    }

    // Store raw content before parsing
    const rawContent = choice.message.content

    // Parse JSON response
    const parsedContent = this.parseJsonResponse(rawContent)

    return {
      content: parsedContent,
      rawContent,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      },
      finishReason: choice.finish_reason ?? 'unknown',
    }
  }

  /**
   * Build chat messages for the request
   */
  private buildMessages(prompt: string, images?: string[]): ChatMessage[] {
    // If no images, simple text message
    if (!images || images.length === 0) {
      return [
        {
          role: 'user',
          content: prompt,
        },
      ]
    }

    // Vision request: combine images and text
    const content: ContentItem[] = []

    // Add images first
    for (const imageUrl of images) {
      content.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
          detail: 'high',
        },
      })
    }

    // Add text prompt
    content.push({
      type: 'text',
      text: prompt,
    })

    return [
      {
        role: 'user',
        content,
      },
    ]
  }
}
