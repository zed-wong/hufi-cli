import { ApiError } from "./errors.ts";

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  retry?: RetryOptions;
}

interface RetryOptions {
  retries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function resolveMessage(payload: unknown, status: number): string {
  let message = `HTTP ${status}`;

  if (payload && typeof payload === "object" && "message" in payload) {
    message = String(payload.message);
  } else if (typeof payload === "string" && payload) {
    message = payload;
  }

  return message;
}

export async function requestJson(
  url: string,
  options: RequestOptions = {}
): Promise<unknown> {
  const retries = options.retry?.retries ?? 2;
  const initialDelayMs = options.retry?.initialDelayMs ?? 250;
  const maxDelayMs = options.retry?.maxDelayMs ?? 3_000;

  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers ?? {}),
        },
        body: options.body,
      });

      const contentType = response.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      const payload = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const message = resolveMessage(payload, response.status);
        if (isRetryableStatus(response.status) && attempt < retries) {
          const delay = Math.min(initialDelayMs * (2 ** attempt), maxDelayMs);
          attempt += 1;
          await sleep(delay);
          continue;
        }
        throw new ApiError(message, response.status, payload);
      }

      return payload;
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }

      if (attempt >= retries) {
        throw err;
      }

      const delay = Math.min(initialDelayMs * (2 ** attempt), maxDelayMs);
      attempt += 1;
      await sleep(delay);
    }
  }
}

export function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}
