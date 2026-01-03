import { describe, it, expect } from "vitest";
import {
  loadConfigFromEnv,
  getProviderConfig,
  getConfiguredProviders,
  isProviderConfigured,
} from "./config";

describe("config", () => {
  describe("loadConfigFromEnv", () => {
    it("should load default configuration when no env vars set", () => {
      const config = loadConfigFromEnv({});

      expect(config.defaultProvider).toBe("openai");
      expect(config.defaultMaxRetries).toBe(2);
      expect(Object.keys(config.providers)).toHaveLength(0);
    });

    it("should load default provider from env", () => {
      const config = loadConfigFromEnv({
        LLM_DEFAULT_PROVIDER: "anthropic",
      });

      expect(config.defaultProvider).toBe("anthropic");
    });

    it("should load default model from env", () => {
      const config = loadConfigFromEnv({
        LLM_DEFAULT_MODEL: "gpt-5",
      });

      expect(config.defaultModel).toBe("gpt-5");
    });

    it("should load max retries from env", () => {
      const config = loadConfigFromEnv({
        LLM_DEFAULT_MAX_RETRIES: "5",
      });

      expect(config.defaultMaxRetries).toBe(5);
    });

    it("should load OpenAI provider configuration", () => {
      const config = loadConfigFromEnv({
        LLM_OPENAI_API_KEY: "sk-test-key",
        LLM_OPENAI_BASE_URL: "https://custom.openai.com",
        LLM_OPENAI_DEFAULT_MODEL: "gpt-4-turbo",
      });

      expect(config.providers.openai).toBeDefined();
      expect(config.providers.openai.apiKey).toBe("sk-test-key");
      expect(config.providers.openai.baseUrl).toBe("https://custom.openai.com");
      expect(config.providers.openai.defaultModel).toBe("gpt-4-turbo");
    });

    it("should use default base URL for OpenAI if not provided", () => {
      const config = loadConfigFromEnv({
        LLM_OPENAI_API_KEY: "sk-test-key",
      });

      expect(config.providers.openai.baseUrl).toBe("https://api.openai.com/v1");
    });

    it("should use default model for OpenAI if not provided", () => {
      const config = loadConfigFromEnv({
        LLM_OPENAI_API_KEY: "sk-test-key",
      });

      expect(config.providers.openai.defaultModel).toBe("gpt-4o");
    });

    it("should load Anthropic provider configuration", () => {
      const config = loadConfigFromEnv({
        LLM_ANTHROPIC_API_KEY: "sk-ant-test",
      });

      expect(config.providers.anthropic).toBeDefined();
      expect(config.providers.anthropic.apiKey).toBe("sk-ant-test");
      expect(config.providers.anthropic.baseUrl).toBe(
        "https://api.anthropic.com/v1",
      );
      expect(config.providers.anthropic.defaultModel).toBe(
        "claude-sonnet-4-20250514",
      );
    });

    it("should load multiple providers", () => {
      const config = loadConfigFromEnv({
        LLM_OPENAI_API_KEY: "sk-openai",
        LLM_ANTHROPIC_API_KEY: "sk-anthropic",
      });

      expect(Object.keys(config.providers)).toHaveLength(2);
      expect(config.providers.openai).toBeDefined();
      expect(config.providers.anthropic).toBeDefined();
    });

    it("should discover custom providers from API key pattern", () => {
      const config = loadConfigFromEnv({
        LLM_CUSTOM_API_KEY: "sk-custom",
        LLM_CUSTOM_BASE_URL: "https://api.custom.com",
        LLM_CUSTOM_DEFAULT_MODEL: "custom-model",
      });

      expect(config.providers.custom).toBeDefined();
      expect(config.providers.custom.apiKey).toBe("sk-custom");
      expect(config.providers.custom.baseUrl).toBe("https://api.custom.com");
      expect(config.providers.custom.defaultModel).toBe("custom-model");
    });

    it("should not create provider config without API key", () => {
      const config = loadConfigFromEnv({
        LLM_OPENAI_BASE_URL: "https://custom.com",
      });

      expect(config.providers.openai).toBeUndefined();
    });
  });

  describe("getProviderConfig", () => {
    it("should return provider config by name", () => {
      const config = loadConfigFromEnv({
        LLM_OPENAI_API_KEY: "sk-test",
      });

      const provider = getProviderConfig(config, "openai");

      expect(provider).toBeDefined();
      expect(provider?.apiKey).toBe("sk-test");
    });

    it("should return default provider config when name not specified", () => {
      const config = loadConfigFromEnv({
        LLM_DEFAULT_PROVIDER: "anthropic",
        LLM_ANTHROPIC_API_KEY: "sk-test",
      });

      const provider = getProviderConfig(config);

      expect(provider).toBeDefined();
      expect(provider?.name).toBe("anthropic");
    });

    it("should be case insensitive", () => {
      const config = loadConfigFromEnv({
        LLM_OPENAI_API_KEY: "sk-test",
      });

      const provider = getProviderConfig(config, "OpenAI");

      expect(provider).toBeDefined();
    });

    it("should return undefined for non-existent provider", () => {
      const config = loadConfigFromEnv({});

      const provider = getProviderConfig(config, "nonexistent");

      expect(provider).toBeUndefined();
    });
  });

  describe("getConfiguredProviders", () => {
    it("should return empty array when no providers configured", () => {
      const config = loadConfigFromEnv({});

      expect(getConfiguredProviders(config)).toEqual([]);
    });

    it("should return list of configured provider names", () => {
      const config = loadConfigFromEnv({
        LLM_OPENAI_API_KEY: "sk-openai",
        LLM_ANTHROPIC_API_KEY: "sk-anthropic",
      });

      const providers = getConfiguredProviders(config);

      expect(providers).toContain("openai");
      expect(providers).toContain("anthropic");
      expect(providers).toHaveLength(2);
    });
  });

  describe("isProviderConfigured", () => {
    it("should return true for configured provider", () => {
      const config = loadConfigFromEnv({
        LLM_OPENAI_API_KEY: "sk-test",
      });

      expect(isProviderConfigured(config, "openai")).toBe(true);
    });

    it("should return false for non-configured provider", () => {
      const config = loadConfigFromEnv({});

      expect(isProviderConfigured(config, "openai")).toBe(false);
    });

    it("should be case insensitive", () => {
      const config = loadConfigFromEnv({
        LLM_OPENAI_API_KEY: "sk-test",
      });

      expect(isProviderConfigured(config, "OPENAI")).toBe(true);
    });
  });
});
