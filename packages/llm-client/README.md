# @soroban/llm-client

Type-safe LLM client with multi-provider support, Zod schema validation, and retry logic with validation feedback.

## Features

- **Multi-provider support**: OpenAI, Anthropic (more coming)
- **Type-safe responses**: Zod schema validation with full TypeScript inference
- **Schema-driven prompts**: Zod `.describe()` annotations are automatically included in prompts
- **Retry with feedback**: Failed validations are fed back to the LLM for correction
- **Vision support**: Pass images for multimodal requests
- **Progress callbacks**: Track LLM call progress for UI feedback
- **Environment-based config**: Configure providers via env vars

## Installation

```bash
pnpm add @soroban/llm-client zod
```

## Configuration

Set environment variables for your providers:

```bash
# Default provider
LLM_DEFAULT_PROVIDER=openai
LLM_DEFAULT_MODEL=gpt-4o

# OpenAI
LLM_OPENAI_API_KEY=sk-...
LLM_OPENAI_BASE_URL=https://api.openai.com/v1  # optional

# Anthropic
LLM_ANTHROPIC_API_KEY=sk-ant-...
LLM_ANTHROPIC_BASE_URL=https://api.anthropic.com/v1  # optional
```

## Usage

### Basic Usage

```typescript
import { LLMClient } from "@soroban/llm-client";
import { z } from "zod";

const llm = new LLMClient();

// Define your response schema with descriptions
// IMPORTANT: Use .describe() on every field - these are sent to the LLM!
const SentimentSchema = z
  .object({
    sentiment: z
      .enum(["positive", "negative", "neutral"])
      .describe("The overall sentiment detected in the text"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe(
        "How confident the analysis is, from 0 (uncertain) to 1 (certain)",
      ),
    reasoning: z
      .string()
      .describe("Brief explanation of why this sentiment was detected"),
  })
  .describe("Sentiment analysis result");

// Make a type-safe call
const response = await llm.call({
  prompt: 'Analyze the sentiment of: "I love this product!"',
  schema: SentimentSchema,
});

// response.data is fully typed
console.log(response.data.sentiment); // 'positive'
console.log(response.data.confidence); // 0.95
```

### Schema Descriptions (Critical!)

**The `.describe()` method is how you communicate expectations to the LLM.** Every field description you add is automatically extracted and included in the prompt sent to the LLM.

```typescript
// ❌ Bad: No context for the LLM
const BadSchema = z.object({
  value: z.number(),
  items: z.array(z.string()),
});

// ✅ Good: Rich context guides LLM responses
const GoodSchema = z
  .object({
    value: z
      .number()
      .describe("The total price in USD, with up to 2 decimal places"),
    items: z
      .array(z.string().describe("Product name exactly as shown on receipt"))
      .describe("All line items from the receipt"),
  })
  .describe("Parsed receipt data");
```

When you call `llm.call()`, the prompt sent to the LLM includes:

```
[Your prompt here]

## Response Format

Respond with JSON matching the following structure:

### Field Descriptions
- **Response**: Parsed receipt data
- **value**: The total price in USD, with up to 2 decimal places
- **items**: All line items from the receipt
- **items[]**: Product name exactly as shown on receipt

### JSON Schema
[Full JSON schema for validation]
```

This ensures the LLM understands:

1. What each field represents semantically
2. What format/constraints to follow
3. How nested structures should be filled

### Vision Requests

```typescript
const ImageAnalysisSchema = z
  .object({
    description: z
      .string()
      .describe("A detailed description of the main subject"),
    objects: z
      .array(z.string().describe("Name of an object visible in the image"))
      .describe("All distinct objects identified in the image"),
  })
  .describe("Image analysis result");

const response = await llm.vision({
  prompt: "Describe what you see in this image",
  images: ["data:image/jpeg;base64,..."],
  schema: ImageAnalysisSchema,
});
```

### Progress Tracking

```typescript
const response = await llm.call({
  prompt: "Complex analysis...",
  schema: MySchema,
  onProgress: (progress) => {
    console.log(`${progress.stage}: ${progress.message}`);
    // 'calling: Calling LLM...'
    // 'validating: Validating response...'
    // 'retrying: Retry 1/2: fixing sentiment'
  },
});
```

### Provider Selection

```typescript
// Use a specific provider
const response = await llm.call({
  prompt: "Hello!",
  schema: ResponseSchema,
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
});

// Check available providers
console.log(llm.getProviders()); // ['openai', 'anthropic']
console.log(llm.isProviderAvailable("openai")); // true
```

### Retry Configuration

```typescript
const response = await llm.call({
  prompt: "Extract data...",
  schema: StrictSchema,
  maxRetries: 3, // Default is 2
});

// If validation fails, the LLM receives feedback like:
// "PREVIOUS ATTEMPT HAD VALIDATION ERROR:
//  Field: items.0.price
//  Error: Expected number, received string
//  Please correct this error and provide a valid response."
```

## API Reference

### `LLMClient`

Main client class for making LLM calls.

#### Constructor

```typescript
new LLMClient(configOverrides?: Partial<LLMClientConfig>, env?: Record<string, string>)
```

#### Methods

- `call<T>(request: LLMRequest<T>): Promise<LLMResponse<T>>` - Make a structured LLM call
- `vision<T>(request: LLMRequest<T> & { images: string[] }): Promise<LLMResponse<T>>` - Vision call
- `getProviders(): string[]` - List configured providers
- `isProviderAvailable(name: string): boolean` - Check if provider is configured
- `getDefaultProvider(): string` - Get default provider name
- `getDefaultModel(provider?: string): string` - Get default model

### Types

```typescript
interface LLMRequest<T extends z.ZodType> {
  prompt: string;
  images?: string[];
  schema: T;
  provider?: string;
  model?: string;
  maxRetries?: number;
  onProgress?: (progress: LLMProgress) => void;
}

interface LLMResponse<T> {
  data: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  attempts: number;
  provider: string;
  model: string;
}

interface LLMProgress {
  stage: "preparing" | "calling" | "validating" | "retrying";
  attempt: number;
  maxAttempts: number;
  message: string;
  validationError?: ValidationFeedback;
}
```

## Adding Custom Providers

You can extend the `BaseProvider` class to add support for additional LLM providers:

```typescript
import {
  BaseProvider,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
} from "@soroban/llm-client";

class MyProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async call(request: ProviderRequest): Promise<ProviderResponse> {
    const prompt = this.buildPrompt(request); // Includes validation feedback
    // ... make API call
    return {
      content: parsedResponse,
      usage: { promptTokens: 100, completionTokens: 50 },
      finishReason: "stop",
    };
  }
}
```

## License

MIT
