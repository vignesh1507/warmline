export type ProviderName = "aistudio" | "ollama" | "openrouter";

export type AiConfig = {
  provider: ProviderName;
  model: string;
  apiKey?: string;
  /** Ollama base URL; ignored by the other providers. */
  baseUrl?: string;
  timeoutMs: number;
};

const DEFAULT_MODELS: Record<ProviderName, string> = {
  aistudio: "gemma-4-31b-it",
  ollama: "gemma3",
  openrouter: "google/gemma-3-27b-it",
};

export function aiConfigFromEnv(env: Record<string, string | undefined> = process.env): AiConfig {
  const provider = (env.AI_PROVIDER as ProviderName) || "aistudio";
  if (!["aistudio", "ollama", "openrouter"].includes(provider)) {
    throw new Error(`Unknown AI_PROVIDER "${provider}" (expected aistudio, ollama or openrouter)`);
  }
  return {
    provider,
    model: env.AI_MODEL || DEFAULT_MODELS[provider],
    apiKey: env.AI_API_KEY,
    baseUrl: env.OLLAMA_URL || "http://127.0.0.1:11434",
    // Gemma 4 reasons before it answers: 30-50s for a suggestion is normal.
    timeoutMs: Number(env.AI_TIMEOUT_MS || 90_000),
  };
}

/**
 * What the Settings screen tells the user, per provider. Kept here so the
 * disclosure can never drift from the code that actually sends the request.
 */
export const PROVIDER_DISCLOSURE: Record<ProviderName, { label: string; where: string; caution?: string }> = {
  aistudio: {
    label: "Google AI Studio (Gemma)",
    where: "generativelanguage.googleapis.com",
    caution:
      "On Google's free tier, content you send may be used to improve their products. Use a paid key, or switch to Ollama, if you keep real notes about people here.",
  },
  ollama: {
    label: "Ollama (local Gemma)",
    where: "your own machine — nothing leaves it",
  },
  openrouter: {
    label: "OpenRouter (Gemma)",
    where: "openrouter.ai",
    caution: "Requests pass through OpenRouter and the upstream model host.",
  },
};
