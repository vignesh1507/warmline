import { type AiConfig } from "./config";

export type CompletionRequest = {
  /** Instructions. Gemma on the Gemini API ignores a separate system role, so this is folded in. */
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

export interface GemmaProvider {
  readonly name: string;
  readonly model: string;
  complete(req: CompletionRequest): Promise<string>;
}

export class AiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "AiError";
  }
}

export function createProvider(cfg: AiConfig): GemmaProvider {
  switch (cfg.provider) {
    case "aistudio":
      return aiStudio(cfg);
    case "ollama":
      return ollama(cfg);
    case "openrouter":
      return openRouter(cfg);
  }
}

async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new AiError(`${new URL(url).host} returned ${res.status}: ${text.slice(0, 400)}`, res.status);
    }
    return JSON.parse(text) as any;
  } catch (err) {
    if (err instanceof AiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new AiError(`The model took longer than ${Math.round(timeoutMs / 1000)}s to answer.`);
    }
    throw new AiError((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

function aiStudio(cfg: AiConfig): GemmaProvider {
  return {
    name: "aistudio",
    model: cfg.model,
    async complete({ system, user, temperature = 0.4, maxTokens = 1400 }) {
      if (!cfg.apiKey) throw new AiError("AI_API_KEY is not set — add a Google AI Studio key in your .env.");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
      const data = await postJson(
        url,
        {
          // Gemma models on this endpoint reject systemInstruction, so it is prepended instead.
          contents: [{ role: "user", parts: [{ text: `${system}\n\n---\n\n${user}` }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: "application/json" },
        },
        { "x-goog-api-key": cfg.apiKey },
        cfg.timeoutMs,
      );
      const parts = data?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((p: any) => p?.text ?? "").join("") : "";
      if (!text) throw new AiError(`Empty answer from ${cfg.model} (${data?.candidates?.[0]?.finishReason ?? "no reason given"}).`);
      return text;
    },
  };
}

function ollama(cfg: AiConfig): GemmaProvider {
  return {
    name: "ollama",
    model: cfg.model,
    async complete({ system, user, temperature = 0.4, maxTokens = 1400 }) {
      const data = await postJson(
        `${cfg.baseUrl}/api/chat`,
        {
          model: cfg.model,
          stream: false,
          format: "json",
          options: { temperature, num_predict: maxTokens },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        {},
        cfg.timeoutMs,
      );
      const text = data?.message?.content ?? "";
      if (!text) throw new AiError(`Empty answer from Ollama model ${cfg.model}.`);
      return text;
    },
  };
}

function openRouter(cfg: AiConfig): GemmaProvider {
  return {
    name: "openrouter",
    model: cfg.model,
    async complete({ system, user, temperature = 0.4, maxTokens = 1400 }) {
      if (!cfg.apiKey) throw new AiError("AI_API_KEY is not set — add an OpenRouter key in your .env.");
      const data = await postJson(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: cfg.model,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        { authorization: `Bearer ${cfg.apiKey}` },
        cfg.timeoutMs,
      );
      const text = data?.choices?.[0]?.message?.content ?? "";
      if (!text) throw new AiError(`Empty answer from ${cfg.model}.`);
      return text;
    },
  };
}
