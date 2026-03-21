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
  exchange_name: string;
  api_key: string;
  is_valid: boolean;
  missing_permissions: string[];
}
