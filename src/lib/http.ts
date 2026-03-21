import { ApiError } from "./errors.ts";

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export async function requestJson(
  url: string,
  options: RequestOptions = {}
): Promise<unknown> {
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
    let message = `HTTP ${response.status}`;

    if (payload && typeof payload === "object" && "message" in payload) {
      message = String(payload.message);
    } else if (typeof payload === "string" && payload) {
      message = payload;
    }

    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

export function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}
