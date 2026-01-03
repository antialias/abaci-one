import type { ProviderConfig, ProviderRequest, ProviderResponse } from '../types'
import { LLMApiError, LLMTruncationError, LLMContentFilterError } from '../types'
import { BaseProvider } from './base'

/**
 * Anthropic content block
 */
interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result'
  text?: string
  source?: {
    type: 'base64'
    media_type: string
    data: string
  }
  id?: string
  name?: string
  input?: unknown
}

/**
 * Anthropic message
 */
interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

/**
 * Anthropic messages response
 */
interface MessagesResponse {
  id: string
  type: 'message' | 'error'
  role: 'assistant'
  content: ContentBlock[]
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

/**
 * Anthropic error response structure
 */
interface AnthropicErrorResponse {
  type?: 'error'
  error?: {
    type?: string
    message?: string
  }
}

/**
 * Anthropic provider implementation
 *
 * Uses the Messages API with tool use for structured output.
 * Falls back to JSON parsing from text if tool use is not available.
 */
export class AnthropicProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  async call(request: ProviderRequest): Promise<ProviderResponse> {
    const prompt = this.buildPrompt(request)
    const messages = this.buildMessages(prompt, request.images)

    // Use tool use for structured output
    const tool = {
      name: 'provide_response',
      description:
        'Provide the response in the required JSON format. Always use this tool.',
      input_schema: request.jsonSchema,
    }

    const requestBody: Record<string, unknown> = {
      model: request.model,
      max_tokens: 4096,
      messages,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'provide_response' },
    }

    const response = await fetch(`${this.config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = errorText
      let errorType: string | undefined

      try {
        const errorJson = JSON.parse(errorText) as AnthropicErrorResponse
        errorMessage = errorJson.error?.message ?? errorText
        errorType = errorJson.error?.type
      } catch {
        // Keep original text
      }

      // Parse Retry-After header for rate limits
      const retryAfterMs = this.parseRetryAfter(response.headers)

      // Check for specific Anthropic error types
      if (errorType === 'invalid_request_error' && errorMessage.includes('content filtering')) {
        throw new LLMContentFilterError(this.name, errorMessage)
      }

      throw new LLMApiError(this.name, response.status, errorMessage, retryAfterMs)
    }

    const data = (await response.json()) as MessagesResponse

    // Check for max_tokens (truncation)
    if (data.stop_reason === 'max_tokens') {
      // Try to extract partial content
      const toolUseBlock = data.content.find((block) => block.type === 'tool_use')
      const textBlock = data.content.find((block) => block.type === 'text')
      const partialContent = toolUseBlock?.input ?? textBlock?.text ?? null

      throw new LLMTruncationError(this.name, partialContent)
    }

    // Find the tool use block
    const toolUseBlock = data.content.find((block) => block.type === 'tool_use')

    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      // Fall back to text content
      const textBlock = data.content.find((block) => block.type === 'text')
      if (textBlock && textBlock.text) {
        // Check if it's a refusal
        const lowerText = textBlock.text.toLowerCase()
        if (
          lowerText.includes("i can't") ||
          lowerText.includes("i cannot") ||
          lowerText.includes("i'm not able") ||
          lowerText.includes("i am not able")
        ) {
          throw new LLMContentFilterError(this.name, textBlock.text)
        }

        return {
          content: this.parseJsonResponse(textBlock.text),
          rawContent: textBlock.text,
          usage: {
            promptTokens: data.usage?.input_tokens ?? 0,
            completionTokens: data.usage?.output_tokens ?? 0,
          },
          finishReason: data.stop_reason ?? 'unknown',
        }
      }
      throw new LLMApiError(this.name, 500, 'No tool use or text content in response')
    }

    return {
      content: toolUseBlock.input,
      rawContent: JSON.stringify(toolUseBlock.input, null, 2),
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
      },
      finishReason: data.stop_reason ?? 'unknown',
    }
  }

  /**
   * Build messages for the request
   */
  private buildMessages(prompt: string, images?: string[]): AnthropicMessage[] {
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
    const content: ContentBlock[] = []

    // Add images first
    for (const imageUrl of images) {
      // Parse data URL to extract base64 and media type
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: match[1],
            data: match[2],
          },
        })
      }
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
