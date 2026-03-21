export interface LauncherCampaign {
  chain_id: number;
  address: string;
  type: string;
  exchange_name: string;
  symbol: string;
  status: string;
  fund_amount: string;
  fund_token: string;
  fund_token_symbol: string;
  fund_token_decimals: number;
  balance: string;
  amount_paid: string;
  start_date: string;
  end_date: string;
  launcher: string;
  exchange_oracle: string;
  recording_oracle: string;
  reputation_oracle: string;
  details?: Record<string, unknown>;
  intermediate_results_url?: string | null;
  final_results_url?: string | null;
  created_at?: number;
}

export interface LauncherCampaignList {
  has_more: boolean;
  results: LauncherCampaign[];
}
