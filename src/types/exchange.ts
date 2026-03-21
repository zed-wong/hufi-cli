export interface ExchangeApiKey {
  exchange_name: string;
  api_key: string;
  secret_key: string;
  extras?: Record<string, string>;
}

export interface ExchangeRegistration {
  id: string;
  exchange_name: string;
}

export interface ExchangeInfo {
  id: string;
  exchange_name: string;
  created_at?: string;
}
