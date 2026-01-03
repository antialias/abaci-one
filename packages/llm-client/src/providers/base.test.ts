import { describe, it, expect } from "vitest";
import { z } from "zod";
import type {
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
} from "../types";
import { BaseProvider } from "./base";

// Concrete implementation for testing
class TestProvider extends BaseProvider {
  async call(_request: ProviderRequest): Promise<ProviderResponse> {
    throw new Error("Not implemented");
  }

  // Expose protected methods for testing
  public testBuildPrompt(request: ProviderRequest): string {
    return this.buildPrompt(request);
  }

  public testBuildSchemaDocumentation(schema: Record<string, unknown>): string {
    return this.buildSchemaDocumentation(schema);
  }

  public testExtractFieldDescriptions(
    schema: Record<string, unknown>,
    path?: string,
  ): string[] {
    return this.extractFieldDescriptions(schema, path);
  }
}

const testConfig: ProviderConfig = {
  name: "test",
  apiKey: "test-key",
  baseUrl: "https://test.com",
  defaultModel: "test-model",
};

describe("BaseProvider", () => {
  describe("buildSchemaDocumentation", () => {
    it("should include schema in documentation", () => {
      const provider = new TestProvider(testConfig);
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };

      const docs = provider.testBuildSchemaDocumentation(schema);

      expect(docs).toContain("## Response Format");
      expect(docs).toContain("JSON Schema");
      expect(docs).toContain('"type": "object"');
    });

    it("should extract field descriptions from schema", () => {
      const provider = new TestProvider(testConfig);
      const schema = {
        type: "object",
        description: "The analysis result",
        properties: {
          sentiment: {
            type: "string",
            description: "The detected sentiment of the text",
          },
          confidence: {
            type: "number",
            description: "Confidence score between 0 and 1",
          },
        },
      };

      const docs = provider.testBuildSchemaDocumentation(schema);

      expect(docs).toContain("### Field Descriptions");
      expect(docs).toContain("**Response**: The analysis result");
      expect(docs).toContain(
        "**sentiment**: The detected sentiment of the text",
      );
      expect(docs).toContain(
        "**confidence**: Confidence score between 0 and 1",
      );
    });
  });

  describe("extractFieldDescriptions", () => {
    it("should extract top-level description", () => {
      const provider = new TestProvider(testConfig);
      const schema = {
        type: "object",
        description: "Root description",
      };

      const descriptions = provider.testExtractFieldDescriptions(schema);

      expect(descriptions).toContain("- **Response**: Root description");
    });

    it("should extract nested property descriptions", () => {
      const provider = new TestProvider(testConfig);
      const schema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            description: "User information",
            properties: {
              name: {
                type: "string",
                description: "Full name of the user",
              },
              age: {
                type: "number",
                description: "Age in years",
              },
            },
          },
        },
      };

      const descriptions = provider.testExtractFieldDescriptions(schema);

      expect(descriptions).toContain("- **user**: User information");
      expect(descriptions).toContain("- **user.name**: Full name of the user");
      expect(descriptions).toContain("- **user.age**: Age in years");
    });

    it("should extract array item descriptions", () => {
      const provider = new TestProvider(testConfig);
      const schema = {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "List of items",
            items: {
              type: "object",
              description: "A single item",
              properties: {
                id: {
                  type: "number",
                  description: "Unique identifier",
                },
              },
            },
          },
        },
      };

      const descriptions = provider.testExtractFieldDescriptions(schema);

      expect(descriptions).toContain("- **items**: List of items");
      expect(descriptions).toContain("- **items[]**: A single item");
      expect(descriptions).toContain("- **items[].id**: Unique identifier");
    });

    it("should handle anyOf/oneOf for nullable types", () => {
      const provider = new TestProvider(testConfig);
      const schema = {
        type: "object",
        properties: {
          value: {
            anyOf: [
              { type: "number", description: "Numeric value" },
              { type: "null" },
            ],
          },
        },
      };

      const descriptions = provider.testExtractFieldDescriptions(schema);

      expect(descriptions).toContain("- **value**: Numeric value");
    });

    it("should skip fields without descriptions", () => {
      const provider = new TestProvider(testConfig);
      const schema = {
        type: "object",
        properties: {
          withDesc: {
            type: "string",
            description: "Has description",
          },
          withoutDesc: {
            type: "number",
          },
        },
      };

      const descriptions = provider.testExtractFieldDescriptions(schema);

      expect(descriptions).toHaveLength(1);
      expect(descriptions[0]).toContain("withDesc");
    });
  });

  describe("buildPrompt with Zod schemas", () => {
    it("should include Zod describe() annotations in prompt", () => {
      const provider = new TestProvider(testConfig);

      const schema = z
        .object({
          sentiment: z
            .enum(["positive", "negative", "neutral"])
            .describe("The overall sentiment detected in the text"),
          confidence: z
            .number()
            .min(0)
            .max(1)
            .describe("How confident the model is in its assessment (0-1)"),
          keywords: z
            .array(z.string().describe("A relevant keyword"))
            .describe("Key terms that influenced the sentiment"),
        })
        .describe("Sentiment analysis result");

      // Use Zod v4's native toJSONSchema
      const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;

      const prompt = provider.testBuildPrompt({
        prompt: 'Analyze the sentiment of: "I love this product!"',
        jsonSchema,
        model: "test-model",
      });

      // Check original prompt is included
      expect(prompt).toContain("Analyze the sentiment of");

      // Check descriptions are extracted
      expect(prompt).toContain("Sentiment analysis result");
      expect(prompt).toContain("The overall sentiment detected in the text");
      expect(prompt).toContain("How confident the model is in its assessment");
      expect(prompt).toContain("Key terms that influenced the sentiment");
    });

    it("should include validation feedback when retrying", () => {
      const provider = new TestProvider(testConfig);

      const schema = z.object({
        value: z.number().describe("A numeric value"),
      });

      // Use Zod v4's native toJSONSchema
      const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;

      const prompt = provider.testBuildPrompt({
        prompt: "Extract the number",
        jsonSchema,
        model: "test-model",
        validationFeedback: {
          field: "value",
          error: "Expected number, received string",
          received: "five",
        },
      });

      // Check validation feedback is included
      expect(prompt).toContain("PREVIOUS ATTEMPT HAD VALIDATION ERROR");
      expect(prompt).toContain("Field: value");
      expect(prompt).toContain("Expected number, received string");
      expect(prompt).toContain('Received: "five"');
    });
  });

  describe("parseJsonResponse", () => {
    it("should parse plain JSON", () => {
      const provider = new TestProvider(testConfig);
      const result = provider["parseJsonResponse"]('{"value": 42}');
      expect(result).toEqual({ value: 42 });
    });

    it("should parse JSON in markdown code blocks", () => {
      const provider = new TestProvider(testConfig);
      const result = provider["parseJsonResponse"](
        '```json\n{"value": 42}\n```',
      );
      expect(result).toEqual({ value: 42 });
    });

    it("should parse JSON in plain code blocks", () => {
      const provider = new TestProvider(testConfig);
      const result = provider["parseJsonResponse"]('```\n{"value": 42}\n```');
      expect(result).toEqual({ value: 42 });
    });
  });
});
