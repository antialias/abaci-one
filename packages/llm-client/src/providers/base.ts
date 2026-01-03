import type {
  LLMProvider,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
} from "../types";
import { LLMJsonParseError } from "../types";
import { buildFeedbackPrompt } from "../retry";

/**
 * Base class for LLM providers
 *
 * Provides common functionality for building prompts and handling
 * validation feedback.
 */
export abstract class BaseProvider implements LLMProvider {
  constructor(protected readonly config: ProviderConfig) {}

  get name(): string {
    return this.config.name;
  }

  /**
   * Make an LLM call
   */
  abstract call(request: ProviderRequest): Promise<ProviderResponse>;

  /**
   * Build the prompt with schema context and validation feedback
   *
   * The prompt is structured as:
   * 1. User's original prompt
   * 2. Schema documentation (extracted from Zod .describe() annotations)
   * 3. Validation feedback (if retrying after a failed attempt)
   */
  protected buildPrompt(request: ProviderRequest): string {
    let prompt = request.prompt;

    // Add schema documentation
    prompt += this.buildSchemaDocumentation(request.jsonSchema);

    // Add validation feedback if retrying
    if (request.validationFeedback) {
      prompt += buildFeedbackPrompt(request.validationFeedback);
    }

    return prompt;
  }

  /**
   * Build human-readable documentation from the JSON schema
   *
   * Extracts descriptions from Zod's .describe() annotations and formats
   * them as clear instructions for the LLM.
   */
  protected buildSchemaDocumentation(schema: Record<string, unknown>): string {
    const docs: string[] = [];
    docs.push("\n\n## Response Format\n");
    docs.push("Respond with JSON matching the following structure:\n");

    // Extract and format field descriptions
    const fieldDocs = this.extractFieldDescriptions(schema);
    if (fieldDocs.length > 0) {
      docs.push("\n### Field Descriptions\n");
      docs.push(fieldDocs.join("\n"));
    }

    // Include the schema structure for reference
    docs.push("\n\n### JSON Schema\n```json\n");
    docs.push(JSON.stringify(schema, null, 2));
    docs.push("\n```");

    return docs.join("");
  }

  /**
   * Recursively extract field descriptions from JSON schema
   */
  protected extractFieldDescriptions(
    schema: Record<string, unknown>,
    path: string = "",
  ): string[] {
    const descriptions: string[] = [];

    // Handle schema description at current level
    if (typeof schema.description === "string" && schema.description) {
      const fieldName = path || "Response";
      descriptions.push(`- **${fieldName}**: ${schema.description}`);
    }

    // Handle object properties
    if (schema.properties && typeof schema.properties === "object") {
      const properties = schema.properties as Record<
        string,
        Record<string, unknown>
      >;
      for (const [key, value] of Object.entries(properties)) {
        const fieldPath = path ? `${path}.${key}` : key;
        descriptions.push(...this.extractFieldDescriptions(value, fieldPath));
      }
    }

    // Handle array items
    if (schema.items && typeof schema.items === "object") {
      const itemPath = path ? `${path}[]` : "items";
      descriptions.push(
        ...this.extractFieldDescriptions(
          schema.items as Record<string, unknown>,
          itemPath,
        ),
      );
    }

    // Handle anyOf/oneOf (for nullable types, unions, etc.)
    for (const key of ["anyOf", "oneOf", "allOf"] as const) {
      const variants = schema[key];
      if (Array.isArray(variants)) {
        for (const variant of variants) {
          if (variant && typeof variant === "object") {
            descriptions.push(
              ...this.extractFieldDescriptions(
                variant as Record<string, unknown>,
                path,
              ),
            );
          }
        }
      }
    }

    return descriptions;
  }

  /**
   * Parse JSON response from LLM
   */
  protected parseJsonResponse(content: string): unknown {
    // Handle markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Unknown parse error";
      throw new LLMJsonParseError(content, errorMessage);
    }
  }

  /**
   * Parse Retry-After header value
   * @returns milliseconds to wait, or undefined if not present
   */
  protected parseRetryAfter(headers: Headers): number | undefined {
    const retryAfter = headers.get("retry-after");
    if (!retryAfter) return undefined;

    // Could be seconds (number) or HTTP date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try parsing as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    return undefined;
  }
}
