import {
  aiConfigFromEnv,
  createProvider,
  PROVIDER_DISCLOSURE,
  type AiConfig,
  type GemmaProvider,
  type ProviderName,
} from "@warmline/ai";

export function aiConfig(): AiConfig {
  return aiConfigFromEnv();
}

export function gemma(): GemmaProvider {
  return createProvider(aiConfig());
}

/** Ollama needs no key; the hosted providers do. */
export function aiReady(cfg: AiConfig = aiConfig()): boolean {
  return cfg.provider === "ollama" ? true : Boolean(cfg.apiKey);
}

export function aiDisclosure(cfg: AiConfig = aiConfig()) {
  return { ...PROVIDER_DISCLOSURE[cfg.provider as ProviderName], model: cfg.model, provider: cfg.provider };
}

export const AI_UNAVAILABLE_MESSAGE =
  "Gemma isn't configured yet. Add AI_API_KEY to your .env (or set AI_PROVIDER=ollama to run it locally), then try again.";
