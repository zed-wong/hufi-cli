import { requestJson, authHeaders } from "../../lib/http.ts";
import type {
  ExchangeApiKey,
  ExchangeRegistration,
  ExchangeInfo,
} from "../../types/exchange.ts";

export async function registerExchangeApiKey(
  baseUrl: string,
  accessToken: string,
  exchangeName: string,
  apiKey: string,
  secretKey: string,
  bitmartMemo?: string
): Promise<ExchangeRegistration> {
  const extras =
    exchangeName === "bitmart" && bitmartMemo
      ? { api_key_memo: bitmartMemo }
      : undefined;

  const payload: ExchangeApiKey = {
    exchange_name: exchangeName,
    api_key: apiKey,
    secret_key: secretKey,
  };

  if (extras) {
    payload.extras = extras;
  }

  return (await requestJson(`${baseUrl}/exchange-api-keys`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  })) as ExchangeRegistration;
}

export async function listExchangeApiKeys(
  baseUrl: string,
  accessToken: string
): Promise<ExchangeInfo[]> {
  return (await requestJson(`${baseUrl}/exchange-api-keys`, {
    method: "GET",
    headers: authHeaders(accessToken),
  })) as ExchangeInfo[];
}
