# @soroban/llm-client

Type-safe LLM client for Claude Code (`claude -p`) through the switch proxy, with Zod schema validation and retry logic with validation feedback.

There is one provider, `claude_code`, and no fallback: falling back between
upstreams is the switch proxy's job, not the application's.

## Features

- **Type-safe responses**: Zod schema validation with full TypeScript inference
- **Schema-driven prompts**: Zod `.describe()` annotations are automatically included in prompts
- **Retry with feedback**: Failed validations are fed back to the LLM for correction
- **Vision support**: Pass images for multimodal requests
- **Progress callbacks**: Track LLM call progress for UI feedback
- **Environment-based config**: Configure the provider via env vars

## Installation

```bash
pnpm add @soroban/llm-client zod
```

## Configuration

```bash
LLM_DEFAULT_MODEL=claude-abaci                     # optional, overrides the provider's default
LLM_DEFAULT_MAX_RETRIES=2                          # optional

# Claude Code (`claude -p`) through the claude-switch-proxy
LLM_CLAUDE_CODE_API_KEY=...                        # the proxy's client secret
LLM_CLAUDE_CODE_BASE_URL=http://192.168.86.51:8787 # required; a trailing /v1 is dropped
LLM_CLAUDE_CODE_DEFAULT_MODEL=claude-sonnet-5      # optional
LLM_CLAUDE_CODE_CLI_PATH=/usr/local/bin/claude     # optional, default `claude`
LLM_CLAUDE_CODE_MAX_CONCURRENCY=2                  # optional, CLI processes at once
LLM_CLAUDE_CODE_HOME=/tmp/claude-code-llm          # optional, the CLI's scratch home
```

### The `claude_code` provider

Runs each call as one Claude Code process in print mode (`claude -p --bare`,
no tools, no settings, no session saved), pointed at the switch proxy with the
proxy secret as `ANTHROPIC_AUTH_TOKEN`. The prompt and any images (base64 data
URLs) go in as one `stream-json` user message. The schema goes to
`--json-schema` and the answer comes back as the run's structured output. The
process gets a minimal environment (no app secrets) and a scratch home.

- `call()`, `vision()`, `stream()` and `streamText()`; not `embed()`.
- `stream()` reads `--include-partial-messages`: summarized thinking, and the
  model's prose before its structured answer, arrive as `reasoning` events; the
  answer's JSON arrives as `output_delta`; `complete` carries the validated data.
  Whether there is thinking to show depends on the model that serves the class.
- A request naming an OpenAI model (`gpt-*`, `o1`, `o3`, …) gets the provider's
  default model instead.
- The requested id is declared to Claude Code as a custom model that thinks and
  takes `--effort`; without that, a class id like `claude-abaci` gets neither.
- A refused request (401, 429, 5xx) stops the run at its first retry event
  rather than letting the CLI retry on its own; llm-client's retry decides.
- A usage limit reads as a 429; a CLI that refuses its own arguments as a 400.
- The server needs the `claude` binary: the Dockerfile copies it into the image.

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

### Streaming

```typescript
for await (const event of llm.stream({
  prompt: "Parse this worksheet",
  images: [imageDataUrl],
  schema: WorksheetSchema,
  reasoning: { effort: "medium" },
})) {
  if (event.type === "reasoning") showThinking(event.text);
  else if (event.type === "output_delta") showPartialJson(event.text);
  else if (event.type === "complete") save(event.data); // validated
}

// A free-text reply (a chat), text deltas as they come:
for await (const event of llm.streamText({ system, prompt })) {
  if (event.type === "output_delta") send(event.text);
}
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
- `stream<T>(request: LLMStreamRequest<T>): AsyncGenerator<StreamEvent<T>>` - Streamed structured call
- `streamText(request: LLMTextStreamRequest): AsyncGenerator<StreamEvent<string>>` - Streamed free-text reply
- `isConfigured(): boolean` - Whether `LLM_CLAUDE_CODE_API_KEY` is set
- `getProviderName(): string` - Always `"claude_code"` (as recorded with usage)
- `getDefaultModel(): string` - Get default model

### Types

```typescript
interface LLMRequest<T extends z.ZodType> {
  prompt: string;
  images?: string[];
  schema: T;
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

## License

MIT
