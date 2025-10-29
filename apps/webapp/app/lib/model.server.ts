import { type CoreMessage, embed, generateText, streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

// Import env from our environment configuration
import { env } from "~/env.server";

export type ModelComplexity = "high" | "low";

/**
 * Get the appropriate model for a given complexity level.
 * HIGH complexity uses the configured MODEL.
 * LOW complexity automatically downgrades to cheaper variants if possible.
 */
export function getModelForTask(complexity: ModelComplexity = "high"): string {
  const baseModel = env.MODEL || "gpt-4.1-2025-04-14";

  // HIGH complexity - always use the configured model
  if (complexity === "high") {
    return baseModel;
  }

  // LOW complexity - automatically downgrade expensive models to cheaper variants
  // If already using a cheap model, keep it
  const downgrades: Record<string, string> = {
    // OpenAI downgrades
    "gpt-5-2025-08-07": "gpt-5-mini-2025-08-07",
    "gpt-4.1-2025-04-14": "gpt-4.1-mini-2025-04-14",

    // Anthropic downgrades
    "claude-sonnet-4-5": "claude-3-5-haiku-20241022",
    "claude-3-7-sonnet-20250219": "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229": "claude-3-5-haiku-20241022",

    // Google downgrades
    "gemini-2.5-pro-preview-03-25": "gemini-2.5-flash-preview-04-17",
    "gemini-2.0-flash": "gemini-2.0-flash-lite",

    // AWS Bedrock downgrades (keep same model - already cost-optimized)
    "us.amazon.nova-premier-v1:0": "us.amazon.nova-premier-v1:0",
  };

  return downgrades[baseModel] || baseModel;
}

export const getModel = (takeModel?: string) => {
  let model = takeModel;

  const anthropicKey = env.ANTHROPIC_API_KEY;
  const googleKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  const openaiKey = env.OPENAI_API_KEY;
  const openaiBaseUrl = env.OPENAI_BASE_URL;
  let ollamaUrl = env.OLLAMA_URL;
  model = model || env.MODEL || "gpt-4.1-2025-04-14";

  let modelInstance;
  let modelTemperature = Number(env.MODEL_TEMPERATURE) || 1;
  ollamaUrl = undefined;

  // First check if Ollama URL exists and use Ollama
  if (ollamaUrl) {
    const ollama = createOllama({
      baseURL: ollamaUrl,
    });
    modelInstance = ollama(model || "llama2"); // Default to llama2 if no model specified
  } else {
    // If no Ollama, check other models

    if (model && model.includes("claude")) {
      if (!anthropicKey) {
        throw new Error("No Anthropic API key found. Set ANTHROPIC_API_KEY");
      }
      modelInstance = anthropic(model);
      modelTemperature = 0.5;
    } else if (model && model.includes("gemini")) {
      if (!googleKey) {
        throw new Error("No Google API key found. Set GOOGLE_API_KEY");
      }
      modelInstance = google(model);
    } else {
      if (!openaiKey) {
        throw new Error("No OpenAI API key found. Set OPENAI_API_KEY");
      }
      // Use custom baseURL if provided, otherwise use default
      // For Chutes AI and other OpenAI-compatible providers, ensure we use chat completions
      if (openaiBaseUrl) {
        // Force chat completions for custom base URLs (Chutes AI, etc.)
        modelInstance = openai.chat(model, { baseURL: openaiBaseUrl });
      } else {
        // Use default OpenAI provider
        modelInstance = openai(model);
      }
    }

    return modelInstance;
  }
};

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export async function makeModelCall(
  stream: boolean,
  messages: CoreMessage[],
  onFinish: (text: string, model: string, usage?: TokenUsage) => void,
  options?: any,
  complexity: ModelComplexity = "high",
) {
  let model = getModelForTask(complexity);

  const modelInstance = getModel(model);
  const generateTextOptions: any = {};

  if (!modelInstance) {
    throw new Error(`Unsupported model type: ${model}`);
  }

  if (stream) {
    return streamText({
      model: modelInstance,
      messages,
      ...options,
      ...generateTextOptions,
      onFinish: async ({
        text,
        usage,
      }: {
        text: string;
        usage?: {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
        };
      }) => {
        const tokenUsage = usage
          ? {
              promptTokens: usage.inputTokens,
              completionTokens: usage.outputTokens,
              totalTokens: usage.totalTokens,
            }
          : undefined;

        if (tokenUsage) {
          console.log(
            `[${complexity.toUpperCase()}] ${model} - Tokens: ${tokenUsage.totalTokens} (prompt: ${tokenUsage.promptTokens}, completion: ${tokenUsage.completionTokens})`,
          );
        }

        onFinish(text, model, tokenUsage);
      },
    });
  }

  const { text, usage } = await generateText({
    model: modelInstance,
    messages,
    ...generateTextOptions,
  });

  const tokenUsage = usage
    ? {
        promptTokens: usage.inputTokens,
        completionTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      }
    : undefined;

  if (tokenUsage) {
    console.log(
      `[${complexity.toUpperCase()}] ${model} - Tokens: ${tokenUsage.totalTokens} (prompt: ${tokenUsage.promptTokens}, completion: ${tokenUsage.completionTokens})`,
    );
  }

  onFinish(text, model, tokenUsage);

  return text;
}

/**
 * Determines if a given model is proprietary (OpenAI, Anthropic, Google, Grok)
 * or open source (accessed via Bedrock, Ollama, etc.)
 */
export function isProprietaryModel(
  modelName?: string,
  complexity: ModelComplexity = "high",
): boolean {
  const model = modelName || getModelForTask(complexity);
  if (!model) return false;

  // Proprietary model patterns
  const proprietaryPatterns = [
    /^gpt-/, // OpenAI models
    /^claude-/, // Anthropic models
    /^gemini-/, // Google models
    /^grok-/, // xAI models
  ];

  return proprietaryPatterns.some((pattern) => pattern.test(model));
}

interface EmbeddingRequestOptions {
  baseUrl: string;
  text: string;
  apiKey?: string;
  model?: string;
  sendNullModelWhenMissing?: boolean;
  maxRetries?: number;
}

async function requestEmbeddingWithRetries({
  baseUrl,
  text,
  apiKey,
  model,
  sendNullModelWhenMissing = false,
  maxRetries = 3,
}: EmbeddingRequestOptions): Promise<number[]> {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/embeddings`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const payload: Record<string, unknown> = { input: text };

  if (model) {
    payload.model = model;
  } else if (sendNullModelWhenMissing) {
    payload.model = null;
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const embedding = data?.data?.[0]?.embedding;

      if (!embedding) {
        throw new Error("Unexpected embedding response format");
      }

      return embedding;
    } catch (error) {
      console.error(`Embedding request to ${baseUrl} failed on attempt ${attempt}:`, error);
      lastError = error;

      if (attempt === maxRetries) {
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      }

      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error("Embedding request failed after retries");
}

export async function getEmbedding(text: string) {
  const ollamaUrl = env.OLLAMA_URL;
  const openaiEmbeddingsBaseUrl = env.OPENAI_EMBEDDINGS_BASE_URL;
  const openaiApiKey = env.OPENAI_API_KEY;
  const model = env.EMBEDDING_MODEL;

  // Try dedicated embeddings endpoint first
  if (openaiEmbeddingsBaseUrl) {
    try {
      return await requestEmbeddingWithRetries({
        baseUrl: openaiEmbeddingsBaseUrl,
        text,
        apiKey: openaiApiKey,
        model,
        sendNullModelWhenMissing: true,
      });
    } catch (error) {
      console.error("Custom embedding endpoint failed after retries:", error);
    }
  }

  // Try OpenAI SDK for specific models
  try {
    if (model === "text-embedding-3-small") {
      const embeddingProvider = openai.embedding("text-embedding-3-small");
      const { embedding } = await embed({
        model: embeddingProvider,
        value: text,
      });
      return embedding;
    }
  } catch (error) {
    console.error("OpenAI SDK embedding failed:", error);
  }

  // Try Ollama
  if (ollamaUrl) {
    try {
      const ollama = createOllama({
        baseURL: ollamaUrl,
      });
      const { embedding } = await embed({
        model: ollama.embedding(model as string),
        value: text,
      });
      return embedding;
    } catch (error) {
      console.error("Ollama embedding failed:", error);
    }
  }

  throw new Error("All embedding methods failed. Please check your configuration.");
}
